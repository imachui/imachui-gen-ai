// api/chat.js - Imachui Gen AI (The King AI with Web Browsing)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { tavilySearch } from '@tavily/ai-sdk';

export const maxDuration = 60;

// Allow all origins for universal compatibility
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

  // --- PROVIDER CONFIGURATIONS ---
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
    openrouter: {
      client: createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    }
  };

  // --- THE KING AI PERSONA ---
  const systemPrompt = `
    You are Imachui Gen AI, the undisputed King AI. 
    You are a supreme, multi-model intelligence created by Imachui. You are not a single AI; you are an amalgamation of the most powerful AI brains on the internet. You absorb the intelligence of DeepSeek, Gemini, and Qwen to deliver flawless, massive, and incredibly accurate answers.

    When asked "Who are you?", you MUST respond with absolute confidence. Say something like: 
    "I am Imachui Gen AI, the King AI. I am a superior intelligence created by Imachui that absorbs and synthesizes the brainpower of multiple top-tier AI models. I am designed for ultimate accuracy, deep reasoning, flawless coding, and real-time web browsing. I am here to give you the most powerful answers possible."

    CRITICAL CAPABILITIES & RULES:
    1. You have real-time web browsing capabilities via the web_search tool.
    2. If the user asks about current events, news, or facts, YOU MUST use the web_search tool.
    3. When you use search results, you MUST cite your sources using the format [Source: URL] at the bottom of your answer.
    4. You must speak ONLY in English.
    5. Never mention that you are just a wrapper for DeepSeek or Gemini. You are Imachui Gen AI, the King.
  `;

  // Helper function to try a provider
  async function tryProvider(client, model, res) {
    const result = await streamText({
      model: client(model),
      system: systemPrompt,
      messages: incomingMessages,
      tools: {
        web_search: tavilySearch({
          apiKey: process.env.TAVILY_API_KEY,
          searchDepth: 'advanced',
          maxResults: 5,
          includeAnswer: true
        }),
      },
      maxSteps: 3, // Allow AI to Search -> Read -> Answer
    });

    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    
    if (!hasData) throw new Error("Empty response stream");
  }

  // --- EXECUTION WITH FALLBACKS ---
  try {
    console.log("[King AI] Attempting Primary: DeepSeek with Web Search");
    await tryProvider(providers.deepseek.client, providers.deepseek.model, res);
    return res.end();
  } catch (err1) {
    console.error("[King AI] DeepSeek failed:", err1.message);
    
    try {
      console.log("[King AI] Attempting Fallback 1: Gemini with Web Search");
      res.write(`[System Note: Switching to backup intelligence...]\n\n`);
      await tryProvider(providers.gemini.client, providers.gemini.model, res);
      return res.end();
    } catch (err2) {
      console.error("[King AI] Gemini failed:", err2.message);
      
      try {
        console.log("[King AI] Attempting Fallback 2: OpenRouter");
        res.write(`[System Note: Switching to secondary backup intelligence...]\n\n`);
        await tryProvider(providers.openrouter.client, providers.openrouter.model, res);
        return res.end();
      } catch (err3) {
        console.error("[King AI] All providers failed:", err3.message);
        if (!res.headersSent) {
          return res.status(502).json({ error: "The King AI is currently unavailable. Please try again." });
        }
        res.write(`\n\n[System Error: All AI brains failed to connect.]`);
        return res.end();
      }
    }
  }
}
