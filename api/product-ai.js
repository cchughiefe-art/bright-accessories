import { enforceRateLimit } from "../lib/rate-limit.js";

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
    await enforceRateLimit(`product-ai:${request.headers["x-forwarded-for"] || "admin"}`, 20, 60 * 60 * 1000);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured in Vercel");
    const image = request.body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 9_000_000) {
      return response.status(400).json({ error:"Choose a JPG, PNG or WebP image smaller than 6MB" });
    }
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return response.status(400).json({ error:"The selected image format is not supported" });
    const model = process.env.GROQ_PRODUCT_MODEL || "qwen/qwen3.8-27b";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{ authorization:`Bearer ${apiKey}`, "content-type":"application/json" },
      body:JSON.stringify({
        model,
        messages:[{ role:"user", content:[
          { type:"text", text:"You are a catalogue assistant for Bright Accessories, a Nigerian phone and electronics accessories shop. Inspect the product image. Respond with one valid JSON object only, with these keys: name, category, description, confidence, notes. Category must be one of Audio, Chargers, Cables, Power Banks, Phone Cases, Smart Watches, Storage, Other. Description must be two concise persuasive sentences. Confidence must be an integer from 0 to 100. Never invent a brand, model compatibility, capacity, wattage, or technical specification that is not clearly visible." },
          { type:"image_url", image_url:{ url:image } },
        ]}],
        response_format:{ type:"json_object" },
        reasoning_effort:"none",
        temperature:0.2,
        max_completion_tokens:500,
      }),
      signal:controller.signal,
    });
    clearTimeout(timeout);
    const data = await aiResponse.json();
    if (!aiResponse.ok) {
      if (aiResponse.status === 429) throw new Error("The free AI limit is temporarily busy. Please wait a minute and try again.");
      throw new Error(data.error?.message || "Groq vision analysis failed");
    }
    const suggestion = extractJson(data.choices?.[0]?.message?.content || "");
    return response.status(200).json({
      name:String(suggestion.name || "").slice(0,100), category:String(suggestion.category || "Other").slice(0,50),
      description:String(suggestion.description || "").slice(0,700), confidence:Math.max(0,Math.min(100,Number(suggestion.confidence)||0)),
      notes:String(suggestion.notes || "Check the generated details before publishing.").slice(0,240),
    });
  } catch (error) {
    const status = /access|required|sign-in/i.test(error.message) ? 401 : /not configured/i.test(error.message) ? 503 : 500;
    const message = error.name === "AbortError" ? "The free AI took too long. Please try again." : error.message;
    return response.status(status).json({ error:message || "Could not analyse this product" });
  }
}
