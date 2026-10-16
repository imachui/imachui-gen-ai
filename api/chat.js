// api/chat.js - Imachui Gen AI by Imachui
// Powered by DeepSeek (Free AI for Coding & Reasoning)
// Add DEEPSEEK_API_KEY in Vercel Environment Variables.

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
  const incoming = Array.isArray(body.messages) ? body.messages : [];

  const messages = incoming
    .filter(m =>
      m &&
      ["user", "assistant"].includes(m.role) &&
      typeof m.content === "string"
    )
    .slice(-16) // Limit to last 16 messages to save tokens
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 5000)
    }));

  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (message) {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || last.content !== message) {
      messages.push({
        role: "user",
        content: message.slice(0, 5000)
      });
    }
  }

  return messages;
}

// DeepSeek Models: chat (fast, good for coding) -> reasoner (deep reasoning)
const DEEPSEEK_MODELS = ["deepseek-chat", "deepseek-reasoner"];

async function callDeepSeek(apiKey, messages, model) {
  const controller = new AbortController();
  // 25 seconds timeout to prevent Vercel serverless timeout (default is 10s for Hobby, 60s for Pro)
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are Imachui Gen AI by Imachui. Reply in the language the user uses or requests, including Filipino/Tagalog and Cebuano. Be helpful, clear, and accurate. Admit uncertainty when needed; do not invent facts or sources. For coding tasks, provide complete, working code with explanations."
          },
          ...messages
        ],
        temperature: 0.5,
        max_tokens: 2000,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const raw = await response.text();
    let data = {};

    try {
      data = JSON.parse(raw);
    } catch (_) {}

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
      throw new Error(`DeepSeek ${model} failed: ${String(detail).slice(0, 300)}`);
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error(`DeepSeek ${model} returned an empty answer.`);
    }

    return {
      answer: answer.trim(),
      model: data.model || model
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
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
      error: "Missing DEEPSEEK_API_KEY in Vercel Environment Variables. Add it, then redeploy."
    });
  }

  const messages = normalizeMessages(req.body || {});

  if (!messages.length || !messages.some(m => m.role === "user")) {
    return res.status(400).json({
      error: "Please enter a message first."
    });
  }

  let lastError = null;

  // Try each model until one succeeds
  for (const model of DEEPSEEK_MODELS) {
    try {
      console.log(`[Imachui Gen AI] Trying model: ${model}`);
      const result = await callDeepSeek(apiKey, messages, model);
      
      console.log(`[Imachui Gen AI] Success with model: ${result.model}`);
      return res.status(200).json({
        answer: result.answer,
        provider: "Imachui Gen AI",
        model: result.model
      });
    } catch (error) {
      console.error(`[Imachui Gen AI] ${model} error:`, String(error.message).slice(0, 300));
      lastError = error;
    }
  }

  // If all models fail
  return res.status(502).json({
    error: `Chat error: ${String(lastError?.message || "All models failed.").slice(0, 500)}`
  });
};
