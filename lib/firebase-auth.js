export async function authenticateCustomer(request) {
  const idToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!idToken) throw new Error("Customer sign-in required");
  const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBS-6-QNtNvS6AwPIn4zorzEhqSeDZSZiQ";
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type":"application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await lookup.json();
  const user = data.users?.[0];
  if (!lookup.ok || !user?.localId) throw new Error("Customer session is invalid or expired");
  return { uid:user.localId, email:String(user.email || "").toLowerCase() };
}
