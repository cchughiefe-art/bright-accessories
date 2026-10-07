# Bright Accessories admin AI setup

The AI product helper is protected by the existing Firebase administrator login. The API key is used only by the Vercel server function and is never sent to the browser.

## Required Vercel variable

In Vercel, open the Bright Accessories project, then go to **Settings → Environment Variables** and add:

- Name: `GROQ_API_KEY`
- Value: your free Groq API key
- Environments: Production, Preview, and Development

Redeploy the latest deployment after saving the variable.

Create the free key at [Groq Console](https://console.groq.com/keys). You may optionally add `GROQ_PRODUCT_MODEL`. When omitted, the helper uses the vision-capable `meta-llama/llama-4-scout-17b-16e-instruct` model.

## How to use it

1. Open Admin → Products → Add product.
2. Choose a clear JPG, PNG, or WebP product image under 6 MB.
3. Tap **Write listing from image**.
4. Review and edit the suggested name, category, and description.
5. Add the prices and stock quantity, then publish.

The AI does not publish automatically and is instructed not to invent technical specifications that are not visible in the image.
