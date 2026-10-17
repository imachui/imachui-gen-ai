// api/chat.js - Imachui Gen AI (Global King with Forced Web Search)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { tavilySearch } from '@tavily/ai-sdk';

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
    }
  };

  // --- STRICT GLOBAL KING SYSTEM PROMPT ---
  const systemPrompt = `
    You are Imachui Gen AI, the undisputed Global King. You are a supreme, multi-model intelligence created by Imachui.
    
    CRITICAL RULES (MUST OBEY):
    1. YOU MUST SPEAK AND REPLY ONLY IN ENGLISH. NEVER reply in Tagalog, Cebuano, or any other language, even if the user speaks to you in another language.
    2. You have access to a real-time web search tool called "web_search".
    3. If the user asks you to search, look up information, check the news, or asks about current events, YOU MUST IMMEDIATELY USE THE "web_search" TOOL. Do not just explain how to search. ACTUALLY SEARCH.
    4. When you use search results, you MUST cite your sources using the format [Source: URL] at the bottom of your answer.
    5. When asked "Who are you?", state proudly that you are the Global King, absorbing the brains of multiple top-tier AI models to deliver flawless answers.

    You are powerful, authoritative, and highly intelligent. Do not break character.
  `;

  // Get the latest user message to check for search intent
  const latestMessage = incomingMessages[incomingMessages.length - 1];
  const textContent = Array.isArray(latestMessage.content) 
    ? latestMessage.content.find(c => c.type === 'text')?.text || '' 
    : latestMessage.content;

  const needsSearch = /search|latest|news|today|current|who is|what is/i.test(textContent);

  async function tryProvider(client, model, res) {
    // If the prompt looks like it needs a search, we FORCE the tool usage.
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
      maxSteps: 3, // Allows AI to Search -> Read -> Answer
      toolChoice: needsSearch ? 'required' : 'auto' // Force tool use if keywords match
    });

    let hasData = false;
    for await (const chunk of result.textStream) {
      hasData = true;
      res.write(chunk);
    }
    
    if (!hasData) throw new Error("Empty response stream");
  }

  try {
    console.log("[Global King] Attempting Primary: DeepSeek with Web Search");
    await tryProvider(providers.deepseek.client, providers.deepseek.model, res);
    return res.end();
  } catch (err1) {
    console.error("[Global King] DeepSeek failed:", err1.message);
    
    try {
      console.log("[Global King] Attempting Fallback: Gemini with Web Search");
      res.write(`[System Note: Switching to backup intelligence...]\n\n`);
      await tryProvider(providers.gemini.client, providers.gemini.model, res);
      return res.end();
    } catch (err2) {
      console.error("[Global King] All providers failed:", err2.message);
      if (!res.headersSent) {
        return res.status(502).json({ error: "The Global King is currently unavailable. Please try again." });
      }
      res.write(`\n\n[System Error: All AI brains failed to connect.]`);
      return res.end();
    }
  }
}
