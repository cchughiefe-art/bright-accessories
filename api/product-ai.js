const ADMIN_EMAIL = "cchughiefe@gmail.com";

async function authenticateAdmin(request) {
  const idToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!idToken) throw new Error("Administrator sign-in required");
  const apiKey = process.env.VITE_FIREBASE_API_KEY || "AIzaSyBS-6-QNtNvS6AwPIn4zorzEhqSeDZSZiQ";
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({idToken}) });
  const data = await lookup.json();
  if (!lookup.ok || String(data.users?.[0]?.email || "").toLowerCase() !== ADMIN_EMAIL) throw new Error("Administrator access required");
}

function extractJson(value = "") {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI returned an invalid suggestion");
  return JSON.parse(cleaned.slice(start,end+1));
}

const validImage = image => typeof image === "string" && /^data:image\/(?:jpeg|png|webp);base64,/.test(image) && image.length < 2_000_000;
const cleanProduct = (product,index) => ({
  index:Number.isInteger(Number(product?.index)) ? Number(product.index) : index,
  name:String(product?.name || "").slice(0,100),
  category:String(product?.category || "Other").slice(0,50),
  description:String(product?.description || "").slice(0,700),
  confidence:Math.max(0,Math.min(100,Number(product?.confidence)||0)),
  notes:String(product?.notes || "Check the generated details before publishing.").slice(0,240),
});

export default async function handler(request,response) {
  if (request.method !== "POST") return response.status(405).json({error:"Method not allowed"});
  try {
    await authenticateAdmin(request);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured in Vercel");
    const images = Array.isArray(request.body?.images) ? request.body.images : [request.body?.image];
    if (!images.length || images.length > 5 || images.some(image=>!validImage(image))) return response.status(400).json({error:"Choose between 1 and 5 supported product images"});
    const plural = images.length > 1;
    const prompt = `You are a catalogue assistant for Bright Accessories, a Nigerian phone and electronics accessories shop. Inspect the ${images.length} product image${plural?"s":""} in the exact order supplied. Return one valid JSON object only with a products array. Each products entry must contain index, name, category, description, confidence and notes. Index starts at 0 and must match the image order. Category must be one of Audio, Chargers, Cables, Power Banks, Phone Cases, Smart Watches, Storage, Other. Description must be two concise persuasive sentences. Confidence must be an integer from 0 to 100. Never invent a brand, model, compatibility, capacity, wattage or specification that is not clearly visible.`;
    const content = [{type:"text",text:prompt},...images.flatMap((image,index)=>[{type:"text",text:`Product image ${index}:`},{type:"image_url",image_url:{url:image}}])];
    const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),45000);
    let aiResponse;
    try {
      aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({model:process.env.GROQ_PRODUCT_MODEL||"qwen/qwen3.8-27b",messages:[{role:"user",content}],response_format:{type:"json_object"},reasoning_effort:"none",temperature:0.2,max_completion_tokens:images.length*450}),signal:controller.signal});
    } finally { clearTimeout(timeout); }
    const data = await aiResponse.json();
    if (!aiResponse.ok) {
      if (aiResponse.status === 429) throw new Error("The free AI limit is temporarily busy. Wait a minute, then tap Write all with AI again.");
      throw new Error(data.error?.message || "Groq vision analysis failed");
    }
    const suggestion = extractJson(data.choices?.[0]?.message?.content || "");
    const products = (Array.isArray(suggestion.products)?suggestion.products:images.length===1?[suggestion]:[]).map(cleanProduct).slice(0,images.length);
    if (!products.length) throw new Error("AI returned an invalid suggestion");
    return response.status(200).json({products,...(images.length===1?products[0]:{})});
  } catch(error) {
    const status = /access|required|sign-in/i.test(error.message)?401:/not configured/i.test(error.message)?503:500;
    return response.status(status).json({error:error.name==="AbortError"?"The free AI took too long. Please try again.":error.message||"Could not analyse these products"});
  }
}
