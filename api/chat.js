
const ALLOWED_ORIGINS = new Set([
  "https://imachui.github.io",
  "https://imachui-gen-ai.vercel.app",
]);

const MODELS = [
  "openrouter/free",
  "nvidia/nemotron-3-ultra:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinking-machines/inkling:free",
];

function sendJson(res, status, data) {
  return res.status(status).json(data);
}

async function askModel(model, messages, apiKey) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://imachui-gen-ai.vercel.app",
        "X-Title": "GLOBAL AI by Imachui",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 1200,
      }),
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `${model}: Unreadable response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(
      `${model}: ${String(detail).slice(0, 220)}`
    );
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error(`${model}: Empty answer.`);
  }

  return answer.trim();
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "Use POST for chat requests.",
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      error:
        "Missing OPENROUTER_API_KEY. Add it in Vercel Project Settings > Environment Variables, enable Production, then redeploy.",
    });
  }

  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  if (!message || message.length > 5000) {
    return sendJson(res, 400, {
      error: "Enter a message from 1 to 5000 characters.",
    });
  }

  const messages = [
    {
      role: "system",
      content:
        "You are GLOBAL AI by Imachui. Give accurate, clear, useful answers. " +
        "Admit uncertainty when needed. Never invent sources or facts.",
    },
    {
      role: "user",
      content: message,
    },
  ];

  // Try two free model options at the same time.
  const firstResults = await Promise.allSettled([
    askModel(MODELS[0], messages, apiKey),
    askModel(MODELS[1], messages, apiKey),
  ]);

  const errors = [];

  const answers = firstResults
    .map((result, index) => {
      if (result.status === "fulfilled") {
        return {
          model: MODELS[index],
          answer: result.value,
        };
      }

      errors.push(
        String(result.reason?.message || result.reason)
      );

      return null;
    })
    .filter(Boolean);

  // If both failed, try the remaining free models.
  if (answers.length === 0) {
    for (const model of MODELS.slice(2)) {
      try {
        const answer = await askModel(
          model,
          messages,
          apiKey
        );

        answers.push({ model, answer });
        break;
      } catch (error) {
        errors.push(
          String(error?.message || error)
        );
      }
    }
  }

  // Return useful error details if every model failed.
  if (answers.length === 0) {
    return sendJson(res, 502, {
      error:
        "GLOBAL AI could not get an answer from the available free models. " +
        "Free-model limits, provider availability, or API account restrictions may be the cause. " +
        "Details: " +
        errors.slice(0, 4).join(" | "),
    });
  }

  // If only one model works, use its answer.
  if (answers.length === 1) {
    return sendJson(res, 200, {
      answer: answers[0].answer,
      modelsUsed: [answers[0].model],
      synthesized: false,
      note:
        "One free model answered. Other models were unavailable.",
    });
  }

  // If two models work, try to combine them into one answer.
  let finalAnswer = "";
  let synthesized = false;

  try {
    finalAnswer = await askModel(
      MODELS[0],
      [
        {
          role: "system",
          content:
            "You are the final answer editor for GLOBAL AI. " +
            "Combine useful information from the model responses, " +
            "correct obvious inconsistencies, remove repetition, " +
            "and produce one clear answer. " +
            "Do not claim verification that did not happen.",
        },
        {
          role: "user",
          content:
            `Original question:\n${message}\n\n` +
            answers
              .map(
                (item, index) =>
                  `Model ${index + 1} (${item.model}):\n${item.answer}`
              )
              .join("\n\n"),
        },
      ],
      apiKey
    );

    synthesized = true;
  } catch {
    // If synthesis fails, still return both answers.
    finalAnswer = answers
      .map((item) => item.answer)
      .join("\n\n---\n\n");
  }

  return sendJson(res, 200, {
    answer: finalAnswer,
    modelsUsed: answers.map((item) => item.model),
    synthesized,
  });
};
