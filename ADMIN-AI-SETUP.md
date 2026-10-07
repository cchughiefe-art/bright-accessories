# Bright Accessories admin AI setup

The AI product helper is protected by the existing Firebase administrator login. The API key is used only by the Vercel server function and is never sent to the browser.

## Required Vercel variable

In Vercel, open the Bright Accessories project, then go to **Settings → Environment Variables** and add:

- Name: `OPENAI_API_KEY`
- Value: your OpenAI API key
- Environments: Production, Preview, and Development

Redeploy the latest deployment after saving the variable.

You may optionally add `OPENAI_PRODUCT_MODEL`. When omitted, the helper uses `gpt-4.1-mini`.

## How to use it

1. Open Admin → Products → Add product.
2. Choose a clear JPG, PNG, or WebP product image under 6 MB.
3. Tap **Write listing from image**.
4. Review and edit the suggested name, category, and description.
5. Add the prices and stock quantity, then publish.

The AI does not publish automatically and is instructed not to invent technical specifications that are not visible in the image.
