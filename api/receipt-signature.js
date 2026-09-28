import crypto from "node:crypto";

const clean = (value) => String(value || "").replace(/[^A-Z0-9-]/gi, "").slice(0, 40);

export default function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return response.status(500).json({ error:"Receipt storage is not configured" });
  const orderRef = clean(request.body?.orderRef);
  if (!/^BA-[A-Z0-9]{8,16}$/.test(orderRef)) return response.status(400).json({ error:"Invalid order reference" });
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "bright-accessories/receipts";
  const publicId = `${orderRef}-${crypto.randomUUID()}`;
  const signature = crypto.createHash("sha1").update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ cloudName, apiKey, timestamp, folder, publicId, signature });
}
