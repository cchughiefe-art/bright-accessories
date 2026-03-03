export default async function handler(req, res) {
  const token = req.query.token;
  if (token !== process.env.WEEKLY_REPORT_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }

    const db = getFirestore();
    const productsSnap = await db.collection("products").get();
    const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const ordersSnap = await db.collection("orders").get();
    const allOrders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekOrders = allOrders.filter((o) => {
      if (!o.createdAt) return false;
      const t = o.createdAt._seconds ? o.createdAt._seconds * 1000 : new Date(o.createdAt).getTime();
      return t >= weekAgo.getTime();
    });

    const successfulOrders = weekOrders.filter((o) => o.status === "successful");
    const pendingOrders = allOrders.filter((o) => o.status === "pending");

    const revenue = successfulOrders.reduce((s, o) => s + (o.total || 0), 0);
    const cogs = successfulOrders.reduce((s, o) => s + ((o.costPrice || 0) * (o.quantity || 1)), 0);
    const deliveryCosts = successfulOrders.reduce((s, o) => s + ((o.deliveryCost || 0) * (o.quantity || 1)), 0);
    const profit = revenue - cogs - deliveryCosts;

    const lowStock = products.filter((p) => p.availableQuantity < 5);
    const fmt = (n) => `N${Number(n).toLocaleString()}`;

    const html = `
      <h2>Bright Accessories - Weekly Report</h2>
      <p style="color:#888; font-size:13px;">Week ending ${new Date().toLocaleDateString()}</p>
      <h3 style="margin-top:20px;">Financial Summary (Last 7 Days)</h3>
      <table style="border-collapse:collapse; font-family:sans-serif; font-size:14px; width:100%; max-width:400px;">
        <tr style="background:#f9f5f0;">
          <td style="padding:8px 12px; font-weight:bold;">Revenue</td>
          <td style="padding:8px 12px; color:green; font-weight:bold;">${fmt(revenue)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;">Cost of Goods</td>
          <td style="padding:8px 12px; color:#D94040;">-${fmt(cogs)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;">Delivery Costs</td>
          <td style="padding:8px 12px; color:#D94040;">-${fmt(deliveryCosts)}</td>
        </tr>
        <tr style="background:#f0fdf4; font-weight:bold; font-size:15px;">
          <td style="padding:10px 12px; border-top:2px solid #ccc;">NET PROFIT</td>
          <td style="padding:10px 12px; border-top:2px solid #ccc; color:${profit >= 0 ? "green" : "red"};">${fmt(profit)}</td>
        </tr>
      </table>
      <h3 style="margin-top:24px;">Orders This Week</h3>
      <p>Successful deliveries: <strong>${successfulOrders.length}</strong></p>
      <p>Still pending: <strong>${pendingOrders.length}</strong></p>
      ${lowStock.length > 0 ? `
        <h3 style="margin-top:24px; color:#D97706;">Low Stock Alert</h3>
        <ul style="font-family:sans-serif; font-size:14px;">
          ${lowStock.map((p) => `<li><strong>${p.name}</strong> - ${p.availableQuantity} units left</li>`).join("")}
        </ul>
      ` : "<p style='color:green; margin-top:20px;'>All products have sufficient stock.</p>"}
      <h3 style="margin-top:24px;">All Products Stock</h3>
      <table style="border-collapse:collapse; font-family:sans-serif; font-size:13px; width:100%;">
        <tr style="background:#1A1A1A; color:white;">
          <th style="padding:8px 12px; text-align:left;">Product</th>
          <th style="padding:8px 12px; text-align:right;">Stock</th>
          <th style="padding:8px 12px; text-align:right;">Price</th>
        </tr>
        ${products.map((p, i) => `
          <tr style="background:${i % 2 === 0 ? "#f9f5f0" : "white"};">
            <td style="padding:8px 12px;">${p.name}</td>
            <td style="padding:8px 12px; text-align:right; color:${p.availableQuantity < 5 ? "#D97706" : "#2E7D55"}; font-weight:bold;">${p.availableQuantity}</td>
            <td style="padding:8px 12px; text-align:right;">${fmt(p.sellingPrice)}</td>
          </tr>
        `).join("")}
      </table>
      <p style="margin-top:30px; font-size:12px; color:#aaa;">Sent automatically by Bright Accessories</p>
    `;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Bright Accessories", email: "cchughiefe@gmail.com" },
        to: [{ email: "tribaluncle@gmail.com", name: "Bright Admin" }],
        subject: `Weekly Report - Profit: ${fmt(profit)}`,
        htmlContent: html,
      }),
    });

    return res.status(200).json({ ok: true, profit, successfulOrders: successfulOrders.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
