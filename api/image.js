
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "POST requests only."
    });
  }

  const token = process.env.HF_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "Image generation is not configured yet. Add HF_TOKEN in Vercel Environment Variables."
    });
  }

  try {
    const prompt =
      typeof req.body?.prompt === "string"
        ? req.body.prompt.trim()
        : "";

    if (!prompt) {
      return res.status(400).json({
        error: "Please enter an image description."
      });
    }

    if (prompt.length > 1500) {
      return res.status(400).json({
        error: "Please shorten your image description to 1500 characters or less."
      });
    }

    const { InferenceClient } = await import("@huggingface/inference");

    const client = new InferenceClient(token);

    const imageBlob = await client.textToImage({
      model: "black-forest-labs/FLUX.1-schnell",
      inputs: prompt,
      provider: "auto"
    });

    const imageBuffer = Buffer.from(
      await imageBlob.arrayBuffer()
    );

    const mimeType = imageBlob.type || "image/png";

    return res.status(200).json({
      success: true,
      prompt,
      image: `data:${mimeType};base64,${imageBuffer.toString("base64")}`
    });
  } catch (error) {
    console.error("Image generation error:", error);

    return res.status(502).json({
      error:
        "Hindi nakagawa ng image sa ngayon. Posibleng naubos ang free credits, busy ang image provider, o may problema sa Hugging Face token. Subukan ulit mamaya."
    });
  }
}
