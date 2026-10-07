import { getAdminDb } from "../lib/firebase-admin.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  const orderRef = String(request.body?.orderRef || "").trim().toUpperCase();
  const phoneLast7 = String(request.body?.phone || "").replace(/\D/g,"").slice(-7);
  if (!/^BA-[A-Z0-9]{8,16}$/.test(orderRef) || phoneLast7.length !== 7) return response.status(400).json({ error:"Enter a valid order reference and phone number" });
  try {
    const snap = await getAdminDb().collection("publicOrders").doc(orderRef).get();
    const data = snap.exists ? snap.data() : null;
    if (!data || data.phoneLast7 !== phoneLast7) return response.status(404).json({ error:"Order not found. Check the reference and phone number." });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ orderRef:data.orderRef, status:data.status, updatedAt:data.updatedAt?.toDate?.()?.toISOString?.() || null });
  } catch { return response.status(500).json({ error:"Tracking is temporarily unavailable" }); }
}
