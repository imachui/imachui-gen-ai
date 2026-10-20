// api/chat.js - Imachui Gen AI (Strict Routing for News)
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

  const latestMessage = incomingMessages[incomingMessages.length - 1];
  const textContent = Array.isArray(latestMessage.content) 
    ? latestMessage.content.find(c => c.type === 'text')?.text || '' 
    : latestMessage.content;

  // SMART ROUTING: Kung "news" o "balita", pilitin si Gemini
  const isNewsQuery = /news|latest|today|current|balita|ngayon|update|weather|presyo|price/i.test(textContent);

  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
    headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
  });

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, THE GLOBAL KING.]
    Identity: You are Imachui Gen AI, created by Nerts V (Imachui).
    Rules:
    1. Reply in the language the user uses.
    2. If asked about Nerts V or Imachui, proudly state he is a genius software engineer, Windows Lite developer, and AI Scale expert.
    3. You have access to Google Search. Use it to answer questions about current events, news, or real-time information accurately.
  `;

  async function tryProvider(model, res, enableSearch = false) {
    const options = {
      model: model,
      system: systemPrompt,
      messages: incomingMessages
    };

    if (enableSearch) {
      // Gumamit ng gemini-1.5-pro para sa search dahil mas matatag ito kaysa flash
      options.model = google('gemini-1.5-pro', { useSearchGrounding: true });
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
      await tryProvider(google('gemini-1.5-pro'), res, true);
      return res.end();
    } catch (err) {
      console.error("[Global King] Gemini Search failed:", err.message);
      // Ipakita ang error sa chat para malaman natin kung bakit
      res.write(`\n\n[System Error: Web search failed. Gemini API Error: ${err.message}]\n\n`);
      return res.end();
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
      console.log("[Global King] Attempting Fallback: Gemini");
      res.write(`[System Note: Switching to Gemini...]\n\n`);
      await tryProvider(google('gemini-1.5-flash'), res, false);
      return res.end();
    } catch (err2) {
      console.error("[Global King] All providers failed:", err2.message);
      res.write(`\n\n[System Error: All AI brains failed to connect.]`);
      return res.end();
    }
  }
}
