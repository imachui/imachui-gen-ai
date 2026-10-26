// api/image.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST requests only." });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "Image generation is not configured. Add HF_TOKEN in Vercel." });
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "Enter an image description." });
  }

  try {
    const { InferenceClient } = await import("@huggingface/inference");
    const client = new InferenceClient(token);

    const imageBlob = await client.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
      provider: "auto"
    });

    const buffer = Buffer.from(await imageBlob.arrayBuffer());
    const mime = ["image/png", "image/jpeg", "image/webp"].includes(imageBlob.type) ? imageBlob.type : "image/png";

    return res.status(200).json({
      success: true,
      prompt,
      image: `data:${mime};base64,` + buffer.toString("base64")
    });
  } catch (error) {
    return res.status(502).json({ error: "Image generation unavailable." });
  }
}
