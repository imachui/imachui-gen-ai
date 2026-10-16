// api/chat.js - Imachui Gen AI by Imachui (Final Multimodal Fix)
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const ALLOWED_ORIGINS = new Set([
  "https://imachui.github.io",
  "https://imachui-gen-ai.vercel.app",
  "http://localhost:3000"
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
      (typeof m.content === "string" || Array.isArray(m.content))
    )
    .slice(-50) 
    .map(m => {
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map(item => {
          // I-convert ang lumang image_url format kung sakaling naka-cache pa ang lumang frontend
          if (item.type === 'image_url') {
            const url = item.image_url?.url || item.image_url;
            return { type: 'image', image: url }; 
          }
          return item;
        });
      }
      return { role: m.role, content: content };
    });

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message) {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || last.content !== message) {
      messages.push({ role: "user", content: message });
    }
  }
  return messages;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST for chat requests." });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENROUTER_API_KEY in Vercel Environment Variables." });
  }

  const messages = normalizeMessages(req.body || {});
  if (!messages.length || !messages.some(m => m.role === "user")) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  try {
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      headers: {
        'HTTP-Referer': 'https://imachui.github.io',
        'X-Title': 'Imachui Gen AI',
      }
    });

    // Mga libreng modelong susubukan natin
    const models = [
      'meta-llama/llama-3.2-11b-vision-instruct:free', // Pangunahing Vision Model
      'qwen/qwen-2-vl-7b-instruct:free',              // Fallback Vision Model
      'meta-llama/llama-3.3-70b-instruct:free'        // Fallback Text-Only Model
    ];

    let lastError = null;

    for (const modelId of models) {
      try {
        console.log(`[Imachui Gen AI] Trying model: ${modelId}`);
        
        const result = await streamText({
          model: openrouter(modelId),
          system: "You are Imachui Gen AI by Imachui. You can see images and read text. Reply in the language the user uses or requests, including Filipino/Tagalog and Cebuano. Be helpful, clear, and accurate. Describe images in detail if asked. Admit uncertainty when needed; do not invent facts or sources. For coding tasks, provide complete, working code with explanations.",
          messages: messages,
          temperature: 0.5,
          maxTokens: 4000, 
        });

        // I-set ang headers para sa streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');

        let hasData = false;
        for await (const chunk of result.textStream) {
          hasData = true;
          res.write(chunk);
        }

        if (!hasData) {
          throw new Error(`Model ${modelId} returned empty stream.`);
        }

        res.end();
        return; // Tapos na, huwag nang ituloy ang loop

      } catch (error) {
        console.error(`[Imachui Gen AI] ${modelId} error:`, String(error?.message || error).slice(0, 300));
        lastError = error;
        // Kung nag-stream na tayo, hindi na tayo makakapagbalik ng JSON error
        if (res.headersSent) {
          res.end();
          return;
        }
        // Kung hindi pa, ituloy ang loop sa susunod na modelo
      }
    }

    // Kung lahat ng modelo ay nabigo
    return res.status(502).json({
      error: `Chat error: ${String(lastError?.message || "All models failed.").slice(0, 500)}`
    });

  } catch (error) {
    console.error("Global chat error:", String(error?.message || error).slice(0, 500));
    if (!res.headersSent) {
      return res.status(502).json({
        error: `Chat error: ${String(error?.message || error).slice(0, 500)}`
      });
    } else {
      res.end();
    }
  }
}
