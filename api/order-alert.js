const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  if (!process.env.BREVO_API_KEY) return res.status(503).json({ error:"Email is not configured" });
  const o = req.body || {};
  if (!Array.isArray(o.items) || !o.customer || !Number.isFinite(Number(o.total))) return res.status(400).json({ error:"Invalid order" });
  const items = o.items.map(i => `<tr><td style="padding:6px 12px">${escapeHtml(i.name)} × ${Number(i.quantity)}</td><td style="padding:6px 12px">₦${Number(i.price*i.quantity).toLocaleString()}</td></tr>`).join("");
  const html = `<h2>New Bright Accessories order</h2><p><b>Reference:</b> ${escapeHtml(o.orderRef)}</p><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${items}</table><p><b>Total:</b> ₦${Number(o.total).toLocaleString()}</p><p><b>Customer:</b> ${escapeHtml(o.customer.name)}<br><b>Phone:</b> ${escapeHtml(o.customer.phone)}<br><b>Address:</b> ${escapeHtml(o.customer.address)}, ${escapeHtml(o.customer.state)}</p><p><b>Payment:</b> ${o.paymentMethod === "transfer" ? "Bank transfer, receipt awaiting verification" : "Cash on delivery"}</p>`;
  try {
    const send = (payload) => fetch("https://api.brevo.com/v3/smtp/email", {
      method:"POST", headers:{"Content-Type":"application/json","api-key":process.env.BREVO_API_KEY},
      body:JSON.stringify(payload)
    });
    const sender = { name:"Bright Accessories", email:process.env.BREVO_SENDER_EMAIL || "cchughiefe@gmail.com" };
    const sends = [send({sender,to:[{email:process.env.ORDER_ALERT_EMAIL || "tribaluncle@gmail.com",name:"Bright Admin"}],subject:`New order ${o.orderRef} · ₦${Number(o.total).toLocaleString()}`,htmlContent:html})];
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.customer.email || "")) {
      const customerHtml = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>We received your order</h2><p>Hello ${escapeHtml(o.customer.name)},</p><p>Your order <b>${escapeHtml(o.orderRef)}</b> has been received and is awaiting confirmation.</p><table style="border-collapse:collapse;width:100%">${items}</table><p style="font-size:18px"><b>Total: ₦${Number(o.total).toLocaleString()}</b></p><p>Payment: ${o.paymentMethod === "transfer" ? "Bank transfer receipt awaiting verification" : "Cash on delivery"}.</p><p>Keep your order reference and phone number safe. You can use them to track your delivery on the Bright Accessories website.</p></div>`;
      sends.push(send({sender,to:[{email:o.customer.email,name:o.customer.name}],subject:`Order received · ${o.orderRef}`,htmlContent:customerHtml}));
    }
    const responses = await Promise.all(sends);
    if (!responses[0].ok) return res.status(502).json({ error:"Notification failed" });
    return res.status(200).json({ ok:true });
  } catch { return res.status(502).json({ error:"Notification failed" }); }
}
