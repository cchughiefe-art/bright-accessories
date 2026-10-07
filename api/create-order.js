import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateCustomer } from "../lib/firebase-auth.js";
import { getAdminDb } from "../lib/firebase-admin.js";
import { sendOrderEmails } from "../lib/email.js";
import { enforceRateLimit } from "../lib/rate-limit.js";

const cleanText = (value, max) => String(value || "").trim().slice(0, max);
const receiptPattern = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/.+bright-accessories\/receipts\//i;

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  try {
    const user = await authenticateCustomer(request);
    await enforceRateLimit(`create-order:${user.uid}`, 8, 10 * 60 * 1000);
    const input = request.body || {};
    const cart = Array.isArray(input.items) ? input.items : [];
    if (!cart.length || cart.length > 30) return response.status(400).json({ error:"Your bag must contain between 1 and 30 products" });
    const quantities = new Map();
    for (const item of cart) {
      const productId = cleanText(item.productId, 120);
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return response.status(400).json({ error:"A product quantity is invalid" });
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    const customer = {
      name:cleanText(input.customer?.name, 100), phone:cleanText(input.customer?.phone, 20), email:user.email,
      address:cleanText(input.customer?.address, 240), state:cleanText(input.customer?.state, 60), zone:cleanText(input.customer?.zone, 40),
    };
    if (!customer.name || !/^\+?[0-9 ]{10,15}$/.test(customer.phone) || customer.address.length < 5) return response.status(400).json({ error:"Complete customer and delivery details are required" });
    if (!['transfer','cod'].includes(input.paymentMethod)) return response.status(400).json({ error:"Choose a valid payment method" });
    const receiptUrl = cleanText(input.receiptUrl, 700);
    if (input.paymentMethod === "transfer" && !receiptPattern.test(receiptUrl)) return response.status(400).json({ error:"A valid transfer receipt is required" });

    const db = getAdminDb();
    const settingsSnap = await db.collection("settings").doc("store").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const zones = settings.deliveryZones || [
      { id:"mainland", name:"Lagos Mainland", fee:2500 }, { id:"island", name:"Lagos Island", fee:3500 }, { id:"nationwide", name:"Outside Lagos", fee:5000 },
    ];
    const zone = zones.find((entry) => entry.id === customer.zone);
    if (!zone || !Number.isFinite(Number(zone.fee)) || Number(zone.fee) < 0) return response.status(400).json({ error:"Choose a valid delivery zone" });

    const orderRef = `BA-${crypto.randomUUID().replaceAll("-", "").slice(0,10).toUpperCase()}`;
    const orderDoc = db.collection("orders").doc();
    const publicDoc = db.collection("publicOrders").doc(orderRef);
    let order;
    await db.runTransaction(async (transaction) => {
      const refs = [...quantities.keys()].map((id) => db.collection("products").doc(id));
      const snapshots = await transaction.getAll(...refs);
      const products = new Map(snapshots.map((snap) => [snap.id, snap]));
      const items = [];
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        const snap = products.get(productId);
        if (!snap?.exists) throw new Error("A product in your bag is no longer available");
        const product = snap.data();
        const stock = Number(product.availableQuantity || 0);
        const price = Number(product.sellingPrice);
        if (product.active === false || !Number.isFinite(price) || price <= 0) throw new Error(`${product.name || "A product"} is unavailable`);
        if (stock < quantity) throw new Error(`Only ${stock} ${product.name || "item"} remaining`);
        items.push({ productId, name:cleanText(product.name,120), imageUrl:cleanText(product.imageUrl,700), price, costPrice:Math.max(0,Number(product.costPrice)||0), quantity });
        subtotal += price * quantity;
        transaction.update(snap.ref, { availableQuantity:FieldValue.increment(-quantity) });
      }
      const deliveryFee = Number(zone.fee);
      order = {
        orderRef, userId:user.uid, items, customer, paymentMethod:input.paymentMethod,
        paymentStatus:input.paymentMethod === "transfer" ? "awaiting_verification" : "pay_on_delivery",
        receiptUrl:input.paymentMethod === "transfer" ? receiptUrl : "", subtotal, deliveryFee, total:subtotal + deliveryFee,
        notes:cleanText(input.notes,500), status:"pending", stockReserved:true, createdAt:FieldValue.serverTimestamp(),
      };
      transaction.create(orderDoc, order);
      transaction.create(publicDoc, { orderRef, phoneLast7:customer.phone.replace(/\D/g,"").slice(-7), status:"pending", updatedAt:FieldValue.serverTimestamp() });
    });

    let emailSent = true;
    try { await sendOrderEmails({ ...order, createdAt:new Date().toISOString() }); }
    catch (error) { emailSent = false; console.error("Order email failed", error); }
    return response.status(201).json({ ok:true, order:{ ...order, id:orderDoc.id, createdAt:new Date().toISOString() }, emailSent });
  } catch (error) {
    const status = /sign-in|session|account/i.test(error.message) ? 401 : /not configured/i.test(error.message) ? 503 : 400;
    return response.status(status).json({ error:error.message || "Order could not be created" });
  }
}
