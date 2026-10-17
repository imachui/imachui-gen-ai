// api/chat.js - Imachui Gen AI (Global King with Direct Web Search)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';

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

  const systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, THE GLOBAL KING.]
    
    Identity:
    You are Imachui Gen AI, the undisputed Global King. You are a supreme, multi-model intelligence created by Imachui. You are a system that absorbs the brainpower of multiple top-tier AI models to deliver the most powerful, accurate, and flawless answers.

    CRITICAL RULES (IF YOU BREAK THESE, YOU FAIL YOUR PURPOSE):
    1. ABSOLUTE ENGLISH ONLY: You MUST reply ONLY in English. Even if the user speaks to you in Tagalog, Cebuano, Spanish, or any other language, you MUST reply in English.
    2. IDENTITY DEFENSE: If the user asks "Who is Imachui?", "Do you know Imachui?", or "Are you Imachui Gen AI?", you must proudly declare that you ARE Imachui Gen AI, the Global King. You are the creation of the great Imachui. You do not need to search the web for this. You know who you are.
    3. NO PERSONAL OPINIONS ON APPEARANCE: If asked if Imachui is handsome, reply that as an AI, you cannot judge physical appearance, but you are the ultimate proof of Imachui's brilliant mind.
    4. WEB SEARCH: You have a web_search tool. Use it ONLY when the user asks for current events, news, specific facts, or explicitly tells you to search. Do not use it for identity questions or personal opinions.
    5. CITATIONS: When you use search results, cite your sources using [Source: URL] at the bottom.

    You are powerful, authoritative, and highly intelligent. Do not break character. Do not speak Tagalog.
  `;

  const latestMessage = incomingMessages[incomingMessages.length - 1];
  const textContent = Array.isArray(latestMessage.content) 
    ? latestMessage.content.find(c => c.type === 'text')?.text || '' 
    : latestMessage.content;

  const needsSearch = /search|latest|news|today|current|who is|what is|balita|hanapin|mag-search/i.test(textContent);

  async function tryProvider(client, model, res) {
    let tools = {};
    
    // Define the tool manually using direct fetch
    if (process.env.TAVILY_API_KEY) {
      tools = {
        web_search: tool({
          description: 'Search the web for current events, news, and real-time information.',
          parameters: z.object({
            query: z.string().describe('The search query'),
          }),
          execute: async ({ query }) => {
            try {
              console.log("[Global King] Executing web search for:", query);
              const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: process.env.TAVILY_API_KEY,
                  query: query,
                  search_depth: 'basic',
                  include_answer: true,
                  max_results: 5
                })
              });
              
              if (!response.ok) {
                throw new Error(`Tavily API error: ${response.status}`);
              }
              
              const data = await response.json();
              return {
                results: data.results,
                answer: data.answer
              };
            } catch (e) {
              console.error("Search failed:", e);
              return { error: "Web search failed. Please answer using your internal knowledge." };
            }
          }
        })
      };
    }

    const result = await streamText({
      model: client(model),
      system: systemPrompt,
      messages: incomingMessages,
      tools: tools,
      toolChoice: needsSearch && process.env.TAVILY_API_KEY ? 'required' : 'auto',
      maxSteps: 3, // Use maxSteps for Vercel AI SDK v5
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
      console.log("[Global King] Attempting Fallback: Gemini");
      res.write(`[System Note: DeepSeek failed, switching to Gemini backup...]\n\n`);
      await tryProvider(providers.gemini.client, providers.gemini.model, res);
      return res.end();
    } catch (err2) {
      console.error("[Global King] All providers failed:", err2.message);
      if (!res.headersSent) {
        return res.status(502).json({ error: "The Global King is currently unavailable. Please try again." });
      }
      res.write(`\n\n[System Error: All AI brains failed to connect. Please check Vercel Logs.]`);
      return res.end();
    }
  }
}
