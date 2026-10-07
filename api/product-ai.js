const ADMIN_EMAIL = "cchughiefe@gmail.com";

async function authenticateAdmin(request) {
  const idToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!idToken) throw new Error("Administrator sign-in required");
  const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBS-6-QNtNvS6AwPIn4zorzEhqSeDZSZiQ";
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ idToken }),
  });
  const data = await lookup.json();
  if (!lookup.ok || String(data.users?.[0]?.email || "").toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Administrator access required");
  }
}

function extractJson(value = "") {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI returned an invalid suggestion");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function findSuggestion(value) {
  const texts = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node === "string") { texts.push(node); return; }
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (typeof node === "object") {
      for (const [key, child] of Object.entries(node)) {
        if (["text", "output_text"].includes(key) && typeof child === "string") texts.unshift(child);
        else if (!["input", "model"].includes(key)) visit(child);
      }
    }
  };
  visit(value?.output ?? value?.candidates ?? value);
  for (const text of texts) {
    try { return extractJson(text); } catch { /* try the next Gemini content block */ }
  }
  throw new Error("Gemini could not produce a product draft. Try a clearer product image.");
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  try {
    await authenticateAdmin(request);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Vercel");
    const image = request.body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 9_000_000) {
      return response.status(400).json({ error:"Choose a JPG, PNG or WebP image smaller than 6MB" });
    }
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return response.status(400).json({ error:"The selected image format is not supported" });
    const model = process.env.GEMINI_PRODUCT_MODEL || "gemini-3.8-flash";
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method:"POST",
      headers:{ "x-goog-api-key":apiKey, "content-type":"application/json" },
      body:JSON.stringify({
        model,
        input:[
          { type:"text", text:"You are a catalogue assistant for Bright Accessories, a Nigerian phone and electronics accessories shop. Inspect the attached product image. Respond with one valid JSON object only, with these keys: name, category, description, confidence, notes. Category must be one of Audio, Chargers, Cables, Power Banks, Phone Cases, Smart Watches, Storage, Other. Description must be two concise persuasive sentences. Confidence must be an integer from 0 to 100. Never invent a brand, model compatibility, capacity, wattage, or technical specification that is not clearly visible." },
          { type:"image", data:match[2], mime_type:match[1] },
        ],
      }),
    });
    const data = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(data.error?.message || "Gemini analysis failed");
    const suggestion = findSuggestion(data);
    return response.status(200).json({
      name:String(suggestion.name || "").slice(0,100), category:String(suggestion.category || "Other").slice(0,50),
      description:String(suggestion.description || "").slice(0,700), confidence:Math.max(0,Math.min(100,Number(suggestion.confidence)||0)),
      notes:String(suggestion.notes || "Check the generated details before publishing.").slice(0,240),
    });
  } catch (error) {
    const status = /access|required|sign-in/i.test(error.message) ? 401 : /not configured/i.test(error.message) ? 503 : 500;
    return response.status(status).json({ error:error.message || "Could not analyse this product" });
  }
}
