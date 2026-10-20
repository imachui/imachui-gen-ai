// api/chat.js - Imachui Gen AI (Auto Web Search + DuckDuckGo Scraper Fallback)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as DDG from 'duck-duck-scrape'; // BAGONG IMPORT

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

// --- BAGONG SEARCH FUNCTION (SERPER -> DUCK-DUCK-SCRAPE) ---
async function searchWeb(query) {
  const apiKey = process.env.SERPER_API_KEY;

  // 1. Unahin ang Serper (kung may credits pa)
  if (apiKey) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 3 })
      });
      if (response.ok) {
        const data = await response.json();
        let results = "Here are the latest search results from the web:\n";
        if (data.answerBox) results += `Direct Answer: ${data.answerBox.answer || data.answerBox.snippet}\n`;
        if (data.organic) {
          data.organic.forEach((item, index) => {
            results += `[${index + 1}] ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}\n\n`;
          });
        }
        return results;
      }
      console.warn("[Global King] Serper limit reached or failed, switching to DuckDuckGo fallback...");
    } catch (error) {
      console.error("[Global King] Serper network error:", error.message);
    }
  }

  // 2. Fallback: DuckDuckGo gamit ang duck-duck-scrape
  try {
    console.log("Using duck-duck-scrape fallback for:", query);
    const searchResults = await DDG.search(query, { safeSearch: DDG.SafeSearchType.STRICT });
    
    if (searchResults && searchResults.results && searchResults.results.length > 0) {
      let results = "Here are the latest search results from the web (DuckDuckGo):\n";
      searchResults.results.slice(0, 3).forEach((item, index) => {
        results += `[${index + 1}] ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.url}\n\n`;
      });
      return results;
    }
  } catch (error) {
    console.error("[Global King] duck-duck-scrape fallback failed:", error.message);
  }

  return "No live search results could be retrieved.";
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

  let systemPrompt = `
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
    2. IDENTITY DEFENSE: If the user asks about Imachui or Nerts V, you must proudly declare the CREATOR DETAILS above. Always state that you ARE Imachui Gen AI, the Global King, created by the great engineer, Nerts V (Imachui).
    3. You are highly intelligent, helpful, and authoritative. Do not break character.
    4. If web search results are provided below, USE THEM to answer the user's question accurately.
  `;

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  if (lastUserMsg) {
    const queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
    
    if (queryText && queryText.length > 3) {
      console.log("[Global King] Auto-searching web for:", queryText);
      const searchResults = await searchWeb(queryText);
      systemPrompt += `\n\n[WEB SEARCH RESULTS]:\n${searchResults}`;
    }
  }

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
    console.log("[Global King] Attempting Primary: DeepSeek");
    await tryProvider(providers.deepseek.client, providers.deepseek.model, res);
    return res.end();
  } catch (err1) {
    console.error("[Global King] DeepSeek failed:", err1.message);
    try {
      console.log("[Global King] Attempting Fallback 1: Gemini");
      res.write(`[System Note: DeepSeek is unavailable. Switching to Gemini...]\n\n`);
      await tryProvider(providers.gemini.client, providers.gemini.model, res);
      return res.end();
    } catch (err2) {
      console.error("[Global King] Gemini failed:", err2.message);
      try {
        console.log("[Global King] Attempting Fallback 2: OpenRouter");
        res.write(`[System Note: Switching to OpenRouter...]\n\n`);
        await tryProvider(providers.openrouter.client, providers.openrouter.model, res);
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
