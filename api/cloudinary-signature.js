import crypto from "node:crypto";

async function authenticate(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing administrator session");

  // Let the deployed Firestore rules make the authorization decision. The
  // orders collection is admin-only, so a successful one-item query proves
  // this Firebase session has the same access as the admin dashboard.
  const response = await fetch(
    "https://firestore.googleapis.com/v1/projects/bright-accessories/databases/(default)/documents/orders?pageSize=1",
    { headers:{ authorization:`Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Administrator access required. Sign out and sign in again.");
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
