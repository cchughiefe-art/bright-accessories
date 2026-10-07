import { FieldValue } from "firebase-admin/firestore";
import { authenticateCustomer } from "../lib/firebase-auth.js";
import { getAdminDb } from "../lib/firebase-admin.js";

const ADMIN_EMAIL = "cchughiefe@gmail.com";
const transitions = { pending:"confirmed", confirmed:"processing", processing:"shipped", shipped:"delivered" };

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  try {
    const user = await authenticateCustomer(request);
    const orderId = String(request.body?.orderId || "").slice(0,150);
    const action = String(request.body?.action || "");
    if (!orderId || !["advance","cancelled"].includes(action)) return response.status(400).json({ error:"Invalid order action" });
    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    let nextStatus;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists) throw new Error("Order not found");
      const order = snap.data();
      const isAdmin = user.email === ADMIN_EMAIL;
      if (!isAdmin && order.userId !== user.uid) throw new Error("You cannot change this order");
      if (!isAdmin && (action !== "cancelled" || order.status !== "pending")) throw new Error("This order can no longer be cancelled");
      nextStatus = action === "cancelled" ? "cancelled" : transitions[order.status];
      if (!nextStatus || (!isAdmin && action === "advance")) throw new Error("This status change is not allowed");
      const patch = { status:nextStatus, updatedAt:FieldValue.serverTimestamp() };
      if (nextStatus === "confirmed" && order.paymentMethod === "transfer") patch.paymentStatus = "verified";
      if (nextStatus === "cancelled" && order.stockReserved !== false) {
        for (const item of order.items || []) transaction.update(db.collection("products").doc(item.productId), { availableQuantity:FieldValue.increment(Number(item.quantity)||0) });
        patch.stockReserved = false;
        patch.cancelledAt = FieldValue.serverTimestamp();
      }
      transaction.update(orderRef, patch);
      if (order.orderRef) transaction.set(db.collection("publicOrders").doc(order.orderRef), { status:nextStatus, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    });
    return response.status(200).json({ ok:true, status:nextStatus });
  } catch (error) {
    const status = /sign-in|session/i.test(error.message) ? 401 : /cannot|allowed/i.test(error.message) ? 403 : 400;
    return response.status(status).json({ error:error.message || "Order could not be updated" });
  }
}
