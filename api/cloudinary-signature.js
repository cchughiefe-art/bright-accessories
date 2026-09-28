import crypto from "node:crypto";

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBS-6-QNtNvS6AwPIn4zorzEhqSeDZSZiQ";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "cchughiefe@gmail.com").toLowerCase();

async function authenticate(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing administrator session");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ idToken:token }) },
  );
  const data = await response.json();
  const email = data.users?.[0]?.email?.toLowerCase();
  if (!response.ok || email !== ADMIN_EMAIL) throw new Error("Administrator access required");
}

const safePublicId = (value) => String(value || "image")
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 100) || "image";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });

  try {
    await authenticate(request);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary environment variables are missing");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "bright-accessories/products";
    const publicId = safePublicId(request.body?.publicId);
    const overwrite = "true";
    const toSign = `folder=${folder}&overwrite=${overwrite}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ cloudName, apiKey, timestamp, folder, publicId, overwrite, signature });
  } catch (error) {
    return response.status(error.message.includes("access") || error.message.includes("session") ? 401 : 500)
      .json({ error:error.message || "Could not authorize upload" });
  }
}
