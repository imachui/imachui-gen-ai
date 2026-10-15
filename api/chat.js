
 // GLOBAL AI by Imachui — Vercel serverless API
// Keep OPENROUTER_API_KEY in Vercel Environment Variables.
// NEVER put your API key in this file.

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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}

async function callModel(model, messages, apiKey, maxTokens = 900) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://imachui-gen-ai.vercel.app/",
        "X-Title": "GLOBAL AI by Imachui"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens
      })
    }
  );

  const raw = await response.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(`${model}: ${detail}`);
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error(`${model}: empty response`);
  }

  return answer.trim();
}

function normalizeMessages(body) {
  const incoming = Array.isArray(body.messages)
    ? body.messages
    : [];

  const history = incoming
    .filter(
      m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
    )
    .slice(-12)
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 5000)
    }));

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

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "Missing OPENROUTER_API_KEY in Vercel Environment Variables."
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

  const system = {
    role: "system",
    content:
      "You are GLOBAL AI by Imachui, a helpful multilingual AI assistant. " +
      "Always reply in the language requested by the user or the language they use. " +
      "For a simple greeting, answer naturally and briefly. " +
      "Be accurate, avoid inventing facts, and clearly acknowledge uncertainty. " +
      "Use clear formatting when helpful."
  };

  const conversation = [system, ...messages];

  // Query available free AI models in parallel.
  // Unavailable or rate-limited models are skipped.
  const attempts = FREE_MODELS.map(async model => {
    try {
      const answer = await callModel(
        model,
        conversation,
        apiKey,
        900
      );

      return { model, answer };
    } catch (error) {
      return {
        model,
        error: error.message
      };
    }
  });

  const results = await Promise.all(attempts);
  const successful = results.filter(r => r.answer);

  // Return useful error details if every model fails.
  if (!successful.length) {
    const details = results
      .map(r => r.error || `${r.model}: no answer`)
      .join(" | ")
      .slice(0, 1800);

    return res.status(502).json({
      error:
        "The free AI models did not return a response. " +
        "They may be rate-limited, unavailable, or the API key may be invalid.",
      details
    });
  }

  // If only one model succeeds, use its answer.
  if (successful.length === 1) {
    return res.status(200).json({
      answer: successful[0].answer,
      modelsUsed: [successful[0].model]
    });
  }

  // Combine successful model answers into one response.
  const drafts = successful
    .map(
      (r, i) =>
        `Draft ${i + 1} (${r.model}):\n${r.answer}`
    )
    .join("\n\n---\n\n");

  const synthesisMessages = [
    system,
    {
      role: "user",
      content:
        "Combine the following AI drafts into ONE clear, accurate, " +
        "non-repetitive final answer. Carefully handle disagreements. " +
        "Do not claim certainty when the drafts do not support it. " +
        "Follow the user's language request.\n\n" +
        "User conversation:\n" +
        messages
          .map(m => `${m.role}: ${m.content}`)
          .join("\n")
          .slice(-7000) +
        "\n\nAI drafts:\n" +
        drafts.slice(0, 14000)
    }
  ];

  const synthesisOrder = [
    successful[0].model,
    "openrouter/free",
    ...FREE_MODELS
  ].filter((model, i, arr) => arr.indexOf(model) === i);

  for (const model of synthesisOrder) {
    try {
      const answer = await callModel(
        model,
        synthesisMessages,
        apiKey,
        1200
      );

      return res.status(200).json({
        answer,
        modelsUsed: successful.map(r => r.model),
        synthesizedBy: model
      });
    } catch (error) {
      // Try another available free model.
    }
  }

  // Fallback if synthesis fails.
  return res.status(200).json({
    answer: successful[0].answer,
    modelsUsed: [successful[0].model]
  });
};
