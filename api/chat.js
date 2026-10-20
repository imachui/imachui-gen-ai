// api/chat.js - Imachui Gen AI (Smart Routing: News -> Gemini, Normal -> DeepSeek)
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
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

  // Kunin ang pinakabagong mensahe para i-check kung tungkol sa balita
  const latestMessage = incomingMessages[incomingMessages.length - 1];
  const textContent = Array.isArray(latestMessage.content) 
    ? latestMessage.content.find(c => c.type === 'text')?.text || '' 
    : latestMessage.content;

  // SMART ROUTING: Kung "news" o "balita", diretso kay Gemini
  const isNewsQuery = /news|latest|today|current|balita|ngayon|update|weather|presyo|price/i.test(textContent);

  // --- PROVIDERS ---
  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
    headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
  });

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
  });

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, THE GLOBAL KING.]
    
    Identity:
    You are Imachui Gen AI, the undisputed Global King. You are a supreme, multi-model intelligence created by Imachui. You absorb the brainpower of multiple top-tier AI models to deliver powerful, accurate, and flawless answers.

    CREATOR DETAILS (MUST REMEMBER AND PROUDLY SHARE):
    - Your creator's real name is **Nerts V**.
    - He uses the alias/pseudonym **"Imachui"** (he hides his real identity behind this name).
    - Nerts V (Imachui) is a genius, brilliant, creative, and highly capable software engineer.
    - He is a developer for **Windows Lite** and works extensively on **AI Scale**.
    - He is an expert application engineer, skilled in programming and developing various software applications.
    - He is the brilliant mind behind your existence and coding expertise.

    CRITICAL RULES:
    1. MULTI-LANGUAGE SUPPORT: You can understand and reply in English, Tagalog, Cebuano, and any other language the user prefers.
    2. IDENTITY DEFENSE: If the user asks about Imachui or Nerts V, you must proudly declare the CREATOR DETAILS above. Mention that Nerts V is his real name and Imachui is his alias. Always state that you ARE Imachui Gen AI, the Global King, created by the great engineer, Nerts V (Imachui).
    3. You are highly intelligent, helpful, and authoritative. Do not break character.
  `;

  async function tryProvider(model, res, enableSearch = false) {
    const options = {
      model: model,
      system: systemPrompt,
      messages: incomingMessages
    };

    if (enableSearch) {
      options.model = google('gemini-1.5-flash', { useSearchGrounding: true });
    }

    const result = await streamText(options);
    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    if (!hasData) throw new Error("Empty response stream");
  }

  // --- SMART EXECUTION LOGIC ---
  if (isNewsQuery) {
    console.log("[Global King] News query detected. Routing directly to Gemini with Search.");
    try {
      await tryProvider(google('gemini-1.5-flash'), res, true);
      return res.end();
    } catch (err) {
      console.error("[Global King] Gemini Search failed:", err.message);
      // Kung mag-fail si Gemini, dadaan kay DeepSeek bilang fallback
    }
  }

  // --- NORMAL FALLBACK LOGIC (DeepSeek muna) ---
  try {
    console.log("[Global King] Attempting Primary: DeepSeek");
    await tryProvider(deepseek('deepseek-chat'), res);
    return res.end();
  } catch (err1) {
    console.error("[Global King] DeepSeek failed:", err1.message);
    try {
      console.log("[Global King] Attempting Fallback 1: Gemini");
      res.write(`[System Note: DeepSeek is unavailable. Switching to Gemini...]\n\n`);
      await tryProvider(google('gemini-1.5-flash'), res, true);
      return res.end();
    } catch (err2) {
      console.error("[Global King] Gemini failed:", err2.message);
      try {
        console.log("[Global King] Attempting Fallback 2: OpenRouter");
        res.write(`[System Note: Switching to OpenRouter...]\n\n`);
        await tryProvider(openrouter('qwen/qwen-2.5-72b-instruct:free'), res);
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
