const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

async function brevo(payload) {
  if (!process.env.BREVO_API_KEY) throw new Error("Email is not configured");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:"POST",
    headers:{ "content-type":"application/json", "api-key":process.env.BREVO_API_KEY },
    body:JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider rejected the message (${response.status})${detail ? `: ${detail.slice(0,120)}` : ""}`);
  }
}

export async function sendOrderEmails(order) {
  const sender = { name:"Bright Accessories", email:process.env.BREVO_SENDER_EMAIL || "cchughiefe@gmail.com" };
  const rows = order.items.map((item) => `<tr><td style="padding:7px 12px">${escapeHtml(item.name)} × ${Number(item.quantity)}</td><td style="padding:7px 12px;text-align:right">₦${Number(item.price * item.quantity).toLocaleString("en-NG")}</td></tr>`).join("");
  const adminHtml = `<div style="font-family:Arial,sans-serif;max-width:640px"><h2>New Bright Accessories order</h2><p><b>Reference:</b> ${escapeHtml(order.orderRef)}</p><table style="border-collapse:collapse;width:100%">${rows}</table><p><b>Total:</b> ₦${Number(order.total).toLocaleString("en-NG")}</p><p><b>Customer:</b> ${escapeHtml(order.customer.name)}<br><b>Phone:</b> ${escapeHtml(order.customer.phone)}<br><b>Address:</b> ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.state)}</p><p><b>Payment:</b> ${order.paymentMethod === "transfer" ? "Bank transfer, receipt awaiting verification" : "Cash on delivery"}</p></div>`;
  const customerHtml = `<div style="font-family:Arial,sans-serif;max-width:640px"><h2>We received your order</h2><p>Hello ${escapeHtml(order.customer.name)},</p><p>Your order <b>${escapeHtml(order.orderRef)}</b> has been received and is awaiting confirmation.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p style="font-size:18px"><b>Total: ₦${Number(order.total).toLocaleString("en-NG")}</b></p><p>You can follow its progress from My Account.</p></div>`;
  await Promise.all([
    brevo({ sender, to:[{ email:process.env.ORDER_ALERT_EMAIL || "tribaluncle@gmail.com", name:"Bright Admin" }], subject:`New order ${order.orderRef} · ₦${Number(order.total).toLocaleString("en-NG")}`, htmlContent:adminHtml }),
    brevo({ sender, to:[{ email:order.customer.email, name:order.customer.name }], subject:`Order received · ${order.orderRef}`, htmlContent:customerHtml }),
  ]);
}

export { escapeHtml, brevo };
