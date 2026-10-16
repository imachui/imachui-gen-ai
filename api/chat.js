// api/chat.js - Imachui Gen AI (4 Providers with Auto-Fallback)
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

  const mode = req.body?.mode || 'gemini';
  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  // --- PROVIDER CONFIGURATIONS (FIXED MODEL NAMES) ---
  const providers = {
    gemini: {
      client: createOpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'gemini-1.5-flash' // Tamang model name
    },
    nvidia: {
      client: createOpenAI({
        baseURL: 'https://integrate.api.nvidia.com/v1',
        apiKey: process.env.NVIDIA_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'meta/llama-3.1-8b-instruct' // Mas mabilis at stable na modelo
    },
    openrouter: {
      client: createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    },
    deepseek: {
      client: createOpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'deepseek-chat'
    }
  };

  const provider = providers[mode];

  if (!provider) {
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  // Helper function para sa streaming at empty check
  async function streamAndCheck(client, model, messages, res) {
    const result = await streamText({ model: client(model), messages });
    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    // Kung walang data na dumating, i-throw ang error para mag-fallback
    if (!hasData) throw new Error("Empty stream from provider");
  }

  try {
    console.log(`[Imachui] ${mode} mode selected`);

    await streamAndCheck(provider.client, provider.model, incomingMessages, res);
    return res.end();

  } catch (error) {
    console.error(`[Imachui] ${mode} failed, falling back to DeepSeek. Error:`, error.message);
    res.write(`[System Note: ${mode} is currently unavailable. Falling back to DeepSeek...]\n\n`);

    try {
      await streamAndCheck(providers.deepseek.client, providers.deepseek.model, incomingMessages, res);
      return res.end();
    } catch (fallbackError) {
      console.error("[Imachui] DeepSeek fallback also failed:", fallbackError.message);
      if (!res.headersSent) {
        return res.status(502).json({ error: `All providers failed: ${fallbackError.message}` });
      }
      res.write(`\n\n[System Error: All providers failed. Please try again later.]`);
      return res.end();
    }
  }
}
