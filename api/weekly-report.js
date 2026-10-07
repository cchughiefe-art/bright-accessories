import { getAdminDb } from "../lib/firebase-admin.js";
import { brevo, escapeHtml } from "../lib/email.js";

const value = (input) => Number(input || 0);
const money = (input) => `₦${value(input).toLocaleString("en-NG")}`;

export default async function handler(req, res) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET || process.env.WEEKLY_REPORT_TOKEN;
  if (!expected || (bearer !== expected && req.query.token !== expected)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getAdminDb();
    const [productsSnap, ordersSnap] = await Promise.all([
      db.collection("products").get(),
      db.collection("orders").where("createdAt", ">=", new Date(Date.now() - 7 * 86400000)).get(),
    ]);
    const products = productsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const orders = ordersSnap.docs.map((doc) => doc.data());
    const delivered = orders.filter((order) => order.status === "delivered");
    const pending = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
    const revenue = delivered.reduce((sum, order) => sum + value(order.total), 0);
    const cogs = delivered.reduce((sum, order) => sum + (order.items || []).reduce(
      (itemSum, item) => itemSum + value(item.costPrice) * value(item.quantity), 0,
    ), 0);
    const delivery = delivered.reduce((sum, order) => sum + value(order.deliveryFee), 0);
    const profit = revenue - cogs - delivery;
    const lowStock = products.filter((product) => value(product.availableQuantity) < 5);
    const rows = products.map((product) => `<tr><td>${escapeHtml(product.name)}</td><td>${value(product.availableQuantity)}</td><td>${money(product.sellingPrice)}</td></tr>`).join("");
    const low = lowStock.map((product) => `<li>${escapeHtml(product.name)} — ${value(product.availableQuantity)} left</li>`).join("");
    const htmlContent = `<h2>Bright Accessories weekly report</h2><p>Week ending ${new Date().toLocaleDateString("en-NG")}</p><h3>Financial summary</h3><p>Revenue: <strong>${money(revenue)}</strong><br>Cost of goods: ${money(cogs)}<br>Delivery: ${money(delivery)}<br>Net profit: <strong>${money(profit)}</strong></p><h3>Orders</h3><p>Delivered: ${delivered.length}<br>Still active: ${pending.length}</p>${low ? `<h3>Low stock</h3><ul>${low}</ul>` : "<p>All products have sufficient stock.</p>"}<h3>Inventory</h3><table cellpadding="8" cellspacing="0" border="1"><tr><th>Product</th><th>Stock</th><th>Price</th></tr>${rows}</table>`;
    await brevo({
      sender: { name: "Bright Accessories", email: process.env.BREVO_SENDER_EMAIL || "cchughiefe@gmail.com" },
      to: [{ email: process.env.ORDER_ALERT_EMAIL || "tribaluncle@gmail.com", name: "Bright Admin" }],
      subject: `Weekly report — profit ${money(profit)}`,
      htmlContent,
    });
    return res.status(200).json({ ok: true, profit, delivered: delivered.length });
  } catch (error) {
    console.error("weekly-report", error);
    return res.status(500).json({ error: "Weekly report could not be sent." });
  }
}
