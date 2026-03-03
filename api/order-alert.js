export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const order = req.body;

  const html = `
    <h2>New Order - Bright Accessories</h2>
    <table style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
      <tr><td style="padding:6px 12px; font-weight:bold;">Product</td><td style="padding:6px 12px;">${order.productName}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold;">Quantity</td><td style="padding:6px 12px;">${order.quantity}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold;">Total</td><td style="padding:6px 12px; color:#C9973A; font-weight:bold;">N${Number(order.total).toLocaleString()}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold;">Name</td><td style="padding:6px 12px;">${order.customerName}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold;">Phone</td><td style="padding:6px 12px;">${order.customerPhone}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold;">Address</td><td style="padding:6px 12px;">${order.deliveryAddress}</td></tr>
      ${order.notes ? `<tr><td style="padding:6px 12px; font-weight:bold;">Notes</td><td style="padding:6px 12px;">${order.notes}</td></tr>` : ""}
      <tr><td style="padding:6px 12px; font-weight:bold;">Payment</td><td style="padding:6px 12px;">Cash on Delivery</td></tr>
    </table>
    <p style="margin-top:16px; font-size:13px; color:#888;">Ordered at: ${order.createdAt}</p>
  `;

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Bright Accessories", email: "cchughiefe@gmail.com" },
        to: [{ email: "tribaluncle@gmail.com", name: "Bright Admin" }],
        subject: `New Order: ${order.productName} - N${Number(order.total).toLocaleString()}`,
        htmlContent: html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Brevo error:", err);
      return res.status(500).json({ error: "Email failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
