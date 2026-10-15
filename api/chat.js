
const ALLOWED_ORIGIN = "https://imachui.github.io";

const MODELS = [
  "nvidia/nemotron-3-ultra:free",
  "thinking-machines/inkling:free",
  "nvidia/nemotron-3.5-lightning:free",
];

function sendJson(res, status, data) {
  res.status(status).json(data);
}

async function askModel(model, messages, apiKey) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 1200,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Model request failed (${response.status})`);
  }

  const answer = data.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The model returned an empty answer.");
  }

  return answer.trim();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST for chat requests." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "Server setup is incomplete. Add the OpenRouter environment variable.",
    });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message || message.length > 5000) {
    return sendJson(res, 400, {
      error: "Enter a message of 1 to 5000 characters.",
    });
  }

  const systemPrompt =
    "You are GLOBAL AI by Imachui. Give accurate, clear, useful answers. " +
    "Admit uncertainty when needed. Never invent sources or facts.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  try {
    const results = await Promise.allSettled([
      askModel(MODELS[0], messages, apiKey),
      askModel(MODELS[1], messages, apiKey),
    ]);

    const answers = results
      .map((result, index) => ({
        model: MODELS[index],
        answer: result.status === "fulfilled" ? result.value : null,
      }))
      .filter((item) => item.answer);

    if (answers.length === 0) {
      return sendJson(res, 502, {
        error:
          "The free AI models are temporarily unavailable or rate-limited. Please try again later.",
      });
    }

    let finalAnswer;

    try {
      finalAnswer = await askModel(
        MODELS[2],
        [
          {
            role: "system",
            content:
              "You are the final answer editor for GLOBAL AI. " +
              "Combine the useful information from the model responses, " +
              "correct obvious inconsistencies, avoid repeating points, " +
              "and produce one clear answer. Do not claim verification " +
              "that did not happen.",
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
    } catch {
      finalAnswer = answers
        .map((item) => item.answer)
        .join("\n\n---\n\n");
    }

    return sendJson(res, 200, {
      answer: finalAnswer,
      modelsUsed: answers.map((item) => item.model),
      synthesized: true,
    });
  } catch {
    return sendJson(res, 500, {
      error: "An unexpected server error occurred. Please try again.",
    });
  }
};
