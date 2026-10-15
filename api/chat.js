// Imachui Gen AI by Imachui — Vercel serverless chat API
// Set DEEPSEEK_API_KEY in Vercel Environment Variables.
// Never expose the API key in frontend code.

const ALLOWED_ORIGINS = new Set([
  "https://imachui.github.io",
  "https://imachui-gen-ai.vercel.app"
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeMessages(body) {
  const incoming = Array.isArray(body.messages)
    ? body.messages
    : [];

  const messages = incoming
    .filter(
      m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
    )
    .slice(-16)
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 5000)
    }));

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (message) {
    const last = messages[messages.length - 1];

    if (
      !last ||
      last.role !== "user" ||
      last.content !== message
    ) {
      messages.push({
        role: "user",
        content: message.slice(0, 5000)
      });
    }
  }

  return messages;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Use POST for chat requests."
    });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "Missing DEEPSEEK_API_KEY in Vercel Environment Variables. Add it, then redeploy."
    });
  }

  const messages = normalizeMessages(req.body || {});

  if (
    !messages.length ||
    !messages.some(m => m.role === "user")
  ) {
    return res.status(400).json({
      error: "Please enter a message first."
    });
  }

  try {
    const response = await fetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-flash",
          messages: [
            {
              role: "system",
              content:
                "You are Imachui Gen AI by Imachui. Reply in the language the user uses or requests, including Filipino/Tagalog and Cebuano. Be helpful, clear, and accurate. Admit uncertainty when needed; do not invent facts or sources."
            },
            ...messages
          ],
          temperature: 0.5,
          max_tokens: 1600,
          stream: false
        })
      }
    );

    const raw = await response.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch (_) {}

    if (!response.ok) {
      const detail =
        data?.error?.message ||
        data?.message ||
        `HTTP ${response.status}`;

      return res.status(502).json({
        error: `DeepSeek request failed: ${String(detail).slice(0, 500)}`
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({
        error: "DeepSeek returned an empty answer."
      });
    }

    return res.status(200).json({
      answer: answer.trim(),
      provider: "Imachui Gen AI",
      model: data.model || "deepseek-flash"
    });
  } catch (_) {
    return res.status(502).json({
      error: "Could not connect to DeepSeek. Please try again."
    });
  }
};
