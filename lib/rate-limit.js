import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin.js";

export async function enforceRateLimit(key, maximum, windowMs) {
  const db = getAdminDb();
  const safeKey = Buffer.from(String(key)).toString("base64url").slice(0, 180);
  const ref = db.collection("rateLimits").doc(safeKey);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (!current || Number(current.expiresAt || 0) <= now) {
      transaction.set(ref, { count:1, expiresAt:now + windowMs, updatedAt:FieldValue.serverTimestamp() });
      return;
    }
    if (Number(current.count || 0) >= maximum) throw new Error("Too many requests. Please wait and try again.");
    transaction.update(ref, { count:FieldValue.increment(1), updatedAt:FieldValue.serverTimestamp() });
  });
}
