
/*
 * GLOBAL AI by Imachui
 * Primary: Official DeepSeek API
 * Backup: OpenRouter free models, when configured
 *
 * Keep API keys in Vercel Environment Variables.
 */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";

const FREE_MODELS = [
  "openrouter/free",
  "nvidia/nemotron-3-ultra:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinking-machines/inkling:free"
];

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
  const history = Array.isArray(body.messages)
    ? body.messages
        .filter(
          item =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-12)
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 5000)
        }))
    : [];

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (message) {
    const last = history[history.length - 1];

    if (
      !last ||
      last.role !== "user" ||
      last.content !== message
    ) {
      history.push({
        role: "user",
        content: message.slice(0, 5000)
      });
    }
  }

  return history;
}

async function requestChat(url, apiKey, model, messages, provider) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "OpenRouter"
        ? {
            "HTTP-Referer": "https://imachui-gen-ai.vercel.app/",
            "X-Title": "GLOBAL AI by Imachui"
          }
        : {})
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 1200,
      stream: false
    })
  });

  const raw = await response.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { message: raw };
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(`${provider}: ${detail}`);
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error(`${provider} returned an empty answer.`);
  }

  return answer.trim();
}

async function askDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not configured in Vercel."
    );
  }

  return requestChat(
    DEEPSEEK_URL,
    apiKey,
    DEEPSEEK_MODEL,
    messages,
    "DeepSeek"
  );
}

async function askOpenRouter(messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouter backup is not configured."
    );
  }

  const errors = [];

  for (const model of FREE_MODELS) {
    try {
      const answer = await requestChat(
        "https://openrouter.ai/api/v1/chat/completions",
        apiKey,
        model,
        messages,
        "OpenRouter"
      );

      return { answer, model };
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }

  throw new Error(
    errors.join(" | ").slice(0, 1200) ||
    "No OpenRouter model was available."
  );
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Use POST for GLOBAL AI chat."
    });
  }

  const messages = normalizeMessages(req.body || {});

  if (
    !messages.length ||
    !messages.some(item => item.role === "user")
  ) {
    return res.status(400).json({
      error: "Please enter a message first."
    });
  }

  const systemMessage = {
    role: "system",
    content:
      "You are GLOBAL AI by Imachui, a helpful and capable AI assistant. " +
      "Answer in the language requested by the user. " +
      "If the user writes in Tagalog or Cebuano, respond naturally in that language. " +
      "For technical questions, give accurate, practical, step-by-step guidance. " +
      "Do not invent facts, sources, or capabilities. " +
      "Explain uncertainty when necessary. " +
      "Keep simple answers concise and use formatting when useful."
  };

  const conversation = [systemMessage, ...messages];

  // Primary provider: official DeepSeek API.
  try {
    const answer = await askDeepSeek(conversation);

    return res.status(200).json({
      answer,
      provider: "DeepSeek",
      model: DEEPSEEK_MODEL
    });
  } catch (deepSeekError) {
    // Try the configured OpenRouter backup if DeepSeek fails.
    try {
      const backup = await askOpenRouter(conversation);

      return res.status(200).json({
        answer: backup.answer,
        provider: "OpenRouter",
        model: backup.model,
        fallback: true
      });
    } catch (backupError) {
      return res.status(502).json({
        error:
          "GLOBAL AI could not get a response from DeepSeek or the backup models.",
        details: [
          `DeepSeek: ${deepSeekError.message}`,
          `Backup: ${backupError.message}`
        ].join(" | ").slice(0, 1800)
      });
    }
  }
};
