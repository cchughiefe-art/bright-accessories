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

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error:"Method not allowed" });
  try {
    await authenticateAdmin(request);
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Vercel");
    const image = request.body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 9_000_000) {
      return response.status(400).json({ error:"Choose a JPG, PNG or WebP image smaller than 6MB" });
    }
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{ authorization:`Bearer ${apiKey}`, "content-type":"application/json" },
      body:JSON.stringify({
        model:process.env.OPENAI_PRODUCT_MODEL || "gpt-4.1-mini",
        max_output_tokens:500,
        input:[{ role:"user", content:[
          { type:"input_text", text:"You are a catalogue assistant for Bright Accessories, a Nigerian phone and electronics accessories shop. Inspect the product image. Return JSON only with: name (clear sales-ready product name), category (one of Audio, Chargers, Cables, Power Banks, Phone Cases, Smart Watches, Storage, Other), description (2 concise persuasive sentences, no unsupported specifications), confidence (integer 0-100), and notes (short warning about anything the seller should verify). Never invent brand, model compatibility, capacity, wattage, or technical specifications that are not clearly visible." },
          { type:"input_image", image_url:image },
        ]}],
      }),
    });
    const data = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(data.error?.message || "AI analysis failed");
    const text = data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    const suggestion = extractJson(text);
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
