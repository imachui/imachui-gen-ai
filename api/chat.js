// api/chat.js - Complete Revised Version

const ALLOWED_ORIGIN = "https://imachui.github.io";

// A fallback list of free models. The system will try them in order.
const MODEL_FALLBACK_LIST = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "openrouter/free"
];

function sendJson(res, status, data) {
  res.status(status).json(data);
}

async function askModel(model, messages, apiKey) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Log the specific error from OpenRouter for easier debugging
    console.error(`OpenRouter error for model ${model}:`, data);
    throw new Error(`Model request failed (${response.status})`);
  }

  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The model returned an empty answer.");
  }
  return answer.trim();
}

module.exports = async function handler(req, res) {
  // --- CORS Headers Setup ---
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- Handle Preflight Request ---
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // --- Only Allow POST Method ---
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST for chat requests." });
  }

  // --- Validate API Key ---
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, {
      error: "Server setup is incomplete. Add the OPENROUTER_API_KEY environment variable in Vercel.",
    });
  }

  // --- Validate User Message ---
  const message = req.body?.message?.trim() || "";
  if (!message || message.length > 5000) {
    return sendJson(res, 400, { error: "Enter a message of 1 to 5000 characters." });
  }

  // --- Setup System Prompt and Messages ---
  const systemPrompt =
    "You are GLOBAL AI by Imachui. Give accurate, clear, useful answers. " +
    "Admit uncertainty when needed. Never invent sources or facts.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  // --- Try Models in the Fallback List Until One Succeeds ---
  let answer = null;
  let usedModel = null;

  for (const model of MODEL_FALLBACK_LIST) {
    try {
      answer = await askModel(model, messages, apiKey);
      usedModel = model;
      break; // Success! Exit the loop.
    } catch (error) {
      console.warn(`Model ${model} failed. Trying next...`);
      // Continue to the next model in the list.
    }
  }

  // --- Handle Total Failure ---
  if (!answer) {
    return sendJson(res, 502, {
      error: "All available free AI models are currently unavailable. Please try again later.",
    });
  }

  // --- Return Successful Answer ---
  return sendJson(res, 200, {
    answer: answer,
    modelUsed: usedModel,
  });
};
