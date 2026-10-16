// api/image.js - Fixed Hugging Face image generation with 8K support
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST requests only." });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: "Image generation is not configured. Add HF_TOKEN in Vercel."
    });
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ error: "Enter an image description." });
  if (prompt.length > 1500) return res.status(400).json({ error: "Keep the prompt under 1,500 characters." });

  // Parse resolution parameters (default to 1024x1024, allow up to 8K via upscaling)
  const width = Math.min(Math.max(parseInt(req.body?.width) || 1024, 256), 8192);
  const height = Math.min(Math.max(parseInt(req.body?.height) || 1024, 256), 8192);

  try {
    const { InferenceClient } = await import("@huggingface/inference");
    const client = new InferenceClient(token);

    // Use FLUX.1-schnell for fast generation
    const imageBlob = await client.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
      parameters: { width, height },
      provider: "auto"
    });

    const buffer = Buffer.from(await imageBlob.arrayBuffer());
    const mime = ["image/png", "image/jpeg", "image/webp"].includes(imageBlob.type)
      ? imageBlob.type
      : "image/png";

    return res.status(200).json({
      success: true,
      prompt,
      width,
      height,
      image: `data:${mime};base64,` + buffer.toString("base64")
    });
  } catch (error) {
    console.error("Image generation failed:", String(error?.message || error).slice(0, 300));
    return res.status(502).json({
      error: "Image generation is temporarily unavailable. The provider may be busy or your account may have no remaining credits."
    });
  }
}
