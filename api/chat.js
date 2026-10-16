// api/chat.js - Imachui Gen AI by Imachui (Multimodal Fixed)
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
    .map(m => ({
      role: m.role,
      content: m.content 
    }));

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message) {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user" || last.content !== message) {
      messages.push({
        role: "user",
        content: message 
      });
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

    const modelId = 'nvidia/nemotron-3.5-super-vl:free'; 
    
    const result = await streamText({
      model: openrouter(modelId),
      system: "You are Imachui Gen AI by Imachui. You can see images and read text. Reply in the language the user uses or requests, including Filipino/Tagalog and Cebuano. Be helpful, clear, and accurate. Describe images in detail if asked. Admit uncertainty when needed; do not invent facts or sources. For coding tasks, provide complete, working code with explanations.",
      messages: messages,
      temperature: 0.5,
      maxTokens: 4000, 
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    for await (const chunk of result.textStream) {
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    console.error("Chat error:", String(error?.message || error).slice(0, 500));
    if (!res.headersSent) {
      return res.status(502).json({
        error: `Chat error: ${String(error?.message || error).slice(0, 500)}`
      });
    } else {
      res.end();
    }
  }
}
