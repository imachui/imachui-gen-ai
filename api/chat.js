// api/chat.js - Imachui Gen AI (OpenRouter + DeepSeek)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

export const maxDuration = 60; 

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
  return incoming
    .filter(m => m && ["user", "assistant"].includes(m.role) && (typeof m.content === "string" || Array.isArray(m.content)))
    .slice(-20)
    .map(m => {
      let content = m.content;
      if (Array.isArray(content)) {
        content = content.map(item => {
          if (item.type === 'image_url') {
            return { type: 'image', image: item.image_url?.url || item.image_url };
          }
          return item;
        });
      }
      return { role: m.role, content: content };
    });
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST for chat requests." });

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!openrouterKey || !deepseekKey) {
    return res.status(500).json({ error: "Missing API keys. Add OPENROUTER_API_KEY and DEEPSEEK_API_KEY in Vercel." });
  }

  const mode = req.body?.mode || 'openrouter'; 
  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const openrouter = createOpenAI({ 
      baseURL: 'https://openrouter.ai/api/v1', 
      apiKey: openrouterKey,
      headers: {
        'HTTP-Referer': 'https://imachui.github.io',
        'X-Title': 'Imachui Gen AI',
      }
    });
    
    const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: deepseekKey });

    // --- OPENROUTER MODE ---
    if (mode === 'openrouter') {
      console.log("[Imachui] OpenRouter mode selected");
      try {
        const result = await streamText({ 
          model: openrouter('qwen/qwen-2.5-72b-instruct:free'), 
          messages: incomingMessages 
        });
        for await (const chunk of result.textStream) res.write(chunk);
        return res.end();
      } catch (err) {
        console.error("[Imachui] OpenRouter failed, falling back to DeepSeek. Error:", err.message);
        res.write(`[System Note: OpenRouter is unavailable. Falling back to DeepSeek...]\n\n`);
        const fallbackResult = await streamText({ model: deepseek('deepseek-chat'), messages: incomingMessages });
        for await (const chunk of fallbackResult.textStream) res.write(chunk);
        return res.end();
      }
    }

    // --- DEEPSEEK MODE ---
    if (mode === 'deepseek') {
      console.log("[Imachui] DeepSeek mode selected");
      const result = await streamText({ model: deepseek('deepseek-chat'), messages: incomingMessages });
      for await (const chunk of result.textStream) res.write(chunk);
      return res.end();
    }

    // --- COMBINE BOTH (ENSEMBLE) ---
    console.log("[Imachui] Ensemble mode started");

    const [orResult, dsResult] = await Promise.allSettled([
      generateText({ model: openrouter('qwen/qwen-2.5-72b-instruct:free'), messages: incomingMessages }),
      generateText({ model: deepseek('deepseek-chat'), messages: incomingMessages })
    ]);

    const orAnswer = orResult.status === 'fulfilled' ? orResult.value.text : `[OpenRouter Error]`;
    const dsAnswer = dsResult.status === 'fulfilled' ? dsResult.value.text : `[DeepSeek Error]`;

    const synthesisPrompt = `
      Ikaw ay isang tagahusga. Pag-aralan ang dalawang sagot sa ibaba at gumawa ng pinagsama-samang sagot.
      --- SAGOT #1 (OpenRouter) ---
      ${orAnswer}
      --- SAGOT #2 (DeepSeek) ---
      ${dsAnswer}
      --- PINAGSAMANG SAGOT ---
    `;

    const finalResult = streamText({
      model: deepseek('deepseek-chat'), 
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.3,
    });

    for await (const chunk of finalResult.textStream) {
      res.write(chunk);
    }
    return res.end();

  } catch (error) {
    console.error("[Imachui] Global Error:", String(error?.message || error).slice(0, 300));
    if (!res.headersSent) {
      return res.status(502).json({ error: `Chat error: ${String(error?.message || error).slice(0, 300)}` });
    } else {
      res.write(`\n\n[System Error: ${String(error?.message || error).slice(0, 100)}]`);
      res.end();
    }
  }
}
