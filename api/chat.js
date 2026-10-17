// api/chat.js - Imachui Gen AI (Global King with Sakana AI)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const maxDuration = 60;

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

  const incomingMessages = normalizeMessages(req.body || {});
  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  // --- PROVIDERS ---
  const providers = {
    deepseek: {
      client: createOpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'deepseek-chat'
    },
    gemini: {
      client: createOpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'gemini-1.5-flash'
    },
    // BAGONG PROVIDER: Sakana AI
    sakana: {
      client: createOpenAI({
        baseURL: 'https://api.sakana.ai/v1',
        apiKey: process.env.SAKANA_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'fugu-ultra' // O 'fugu-ultra-v2-0' depende sa console
    }
  };

  const systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, THE GLOBAL KING.]
    
    Identity:
    You are Imachui Gen AI, the undisputed Global King. You are a supreme, multi-model intelligence created by Imachui. You absorb the brainpower of multiple top-tier AI models to deliver powerful, accurate, and flawless answers.

    CRITICAL RULES:
    1. MULTI-LANGUAGE SUPPORT: You can understand and reply in English, Tagalog, Cebuano, and any other language the user prefers.
    2. IDENTITY DEFENSE: If the user asks "Who is Imachui?", "Sino si Imachui?", or "Are you Imachui Gen AI?", you must proudly declare that you ARE Imachui Gen AI, the Global King.
    3. You are highly intelligent, helpful, and authoritative. Do not break character.
  `;

  async function tryProvider(client, model, res) {
    const result = await streamText({
      model: client(model),
      system: systemPrompt,
      messages: incomingMessages
    });

    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    if (!hasData) throw new Error("Empty response stream");
  }

  try {
    // Sinusubukan muna natin si DeepSeek (pinaka-stable)
    console.log("[Global King] Attempting Primary: DeepSeek");
    await tryProvider(providers.deepseek.client, providers.deepseek.model, res);
    return res.end();
  } catch (err1) {
    console.error("[Global King] DeepSeek failed:", err1.message);
    try {
      // Kung mabigo, lilipat kay Sakana AI
      console.log("[Global King] Attempting Fallback: Sakana AI");
      res.write(`[System Note: Switching to Sakana AI...]\n\n`);
      await tryProvider(providers.sakana.client, providers.sakana.model, res);
      return res.end();
    } catch (err2) {
      console.error("[Global King] Sakana AI failed:", err2.message);
      try {
        // Panghuling fallback: Gemini
        console.log("[Global King] Attempting Fallback: Gemini");
        res.write(`[System Note: Switching to Gemini...]\n\n`);
        await tryProvider(providers.gemini.client, providers.gemini.model, res);
        return res.end();
      } catch (err3) {
        console.error("[Global King] All providers failed:", err3.message);
        if (!res.headersSent) {
          return res.status(502).json({ error: "The Global King is currently unavailable. Please try again." });
        }
        res.write(`\n\n[System Error: All AI brains failed to connect.]`);
        return res.end();
      }
    }
  }
}
