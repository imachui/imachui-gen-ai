// api/chat.js - Imachui Gen AI (Simplified Single-Model Selection)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

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

  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!openaiKey || !deepseekKey) {
    return res.status(500).json({ error: "Missing API keys in Vercel Environment Variables." });
  }

  // Kunin ang napiling mode mula sa frontend (chatgpt o deepseek)
  const mode = req.body?.mode || 'chatgpt';
  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    if (mode === 'chatgpt') {
      console.log("[Imachui] ChatGPT mode selected");
      const openai = createOpenAI({ apiKey: openaiKey });
      const result = await streamText({ 
        model: openai('gpt-4o-mini'), 
        messages: incomingMessages 
      });
      for await (const chunk of result.textStream) res.write(chunk);
      return res.end();
    }

    if (mode === 'deepseek') {
      console.log("[Imachui] DeepSeek mode selected");
      const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: deepseekKey });
      const result = await streamText({ 
        model: deepseek('deepseek-chat'), 
        messages: incomingMessages 
      });
      for await (const chunk of result.textStream) res.write(chunk);
      return res.end();
    }

    return res.status(400).json({ error: "Invalid mode selected." });

  } catch (error) {
    console.error("[Imachui] Error:", String(error?.message || error).slice(0, 300));
    if (!res.headersSent) {
      return res.status(502).json({ error: `Chat error: ${String(error?.message || error).slice(0, 300)}` });
    } else {
      res.write(`\n\n[System Error: ${String(error?.message || error).slice(0, 100)}]`);
      res.end();
    }
  }
}
