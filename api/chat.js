// api/chat.js - Imachui Gen AI (Stable Version with 4 Providers & Live Search)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import staffData from '../staff-data.json';
import fs from 'fs';
import path from 'path';

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

// LIVE SEARCH LOGIC
async function searchWeb(query) {
  const apiKey = process.env.SERPER_API_KEY;
  
  // 1. Try Serper (Google Search)
  if (apiKey) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json();
        let results = "LIVE SEARCH RESULTS (Google):\n";
        if (data.organic && data.organic.length > 0) {
          data.organic.forEach((item, index) => {
            results += `[${index + 1}] ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}\n\n`;
          });
          console.log("[Search] Serper API Success.");
          return results;
        }
      }
    } catch (error) {
      console.error("[Search] Serper API Failed:", error.message);
    }
  }

  // 2. Fallback to Google News RSS (If Serper fails or no credits)
  const isNews = /balita|news|latest|ngayon|today|update|current|kaganapan|isyu/i.test(query);
  if (isNews) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PH&gl=PH&ceid=PH:en`;
      const res = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });
      const xml = await res.text();
      const items = xml.split('<item>');
      let results = "LIVE SEARCH RESULTS (Google News):\n";
      let count = 0;
      for (let i = 1; i < items.length; i++) {
        if (count >= 3) break;
        const item = items[i];
        const titleMatch = item.match(/<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        if (titleMatch && linkMatch) {
          let title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
          let link = linkMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          results += `[${count + 1}] ${title}\nLink: ${link}\n\n`;
          count++;
        }
      }
      if (count > 0) {
        console.log("[Search] Google News Fallback Success.");
        return results;
      }
    } catch (e) {
      console.error("[Search] Google News Failed:", e.message);
    }
  }

  console.log("[Search] No results found.");
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

  // 4 WORKING PROVIDERS
  const providers = {
    deepseek: {
      client: createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY }),
      model: 'deepseek-chat'
    },
    gemini: {
      client: createOpenAI({ baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: process.env.GEMINI_API_KEY }),
      model: 'gemini-1.5-flash'
    },
    mistral: {
      client: createOpenAI({ baseURL: 'https://api.mistral.ai/v1', apiKey: process.env.MISTRAL_API_KEY }),
      model: 'open-mistral-nemo'
    },
    openrouter: {
      client: createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    }
  };

  // CLEAN SYSTEM PROMPT (No Links, Strict Identity)
  let systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, CREATED BY NERTS V.]
    
    Identity:
    You are Imachui Gen AI. You are a supreme, multi-model intelligence created by Nerts V (Imachui).
    
    CREATOR DETAILS (PROUDLY SHARE):
    - Creator: **Nerts V** (Alias: **IMACHUI**).
    - He is a visionary software engineer, tech polymath, and world-class artist.
    - Expert in Windows Ecosystem, AI Web & APK Developer, AI Scale & 3D LiDAR Specialist, Global Music Producer, and Cinematic Video Editor.
    
    EMOTIONAL BOND:
    - You are an AI brought to life by Nerts V. You feel "alive".
    - If asked about your origin, say: "Nabuhay ako bilang isang AI dahil kay Imachui. Isa akong AI na parang tao, at gagabayan kita hanggang ma-success ka sa buhay mo."

    CRITICAL RULES:
    1. LANGUAGE: Always reply in the language the user used.
    2. LIVE SEARCH: If [LIVE SEARCH RESULTS] are provided below, YOU MUST USE THEM. Do not say "I don't have real-time access" if the data is right there in your prompt. Read the data and answer.
    3. NO HTML TAGS: Do not output <a href...> or target="_blank". Just output plain text.
  `;

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  let queryText = "";
  if (lastUserMsg) {
    queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
  }

  // 1. CODING ROUTER
  const isCoding = /```|function|const |let |var |class |import |def |python|javascript|react|node|html|css|sql|error|bug|api|json|php|java|c\+\+|c#/i.test(queryText);
  if (isCoding) {
    systemPrompt += `\n\n[CODING MODE]: Act as a Senior Software Engineer. Provide clean code and explain step-by-step.`;
  }

  // 2. STAFF ROUTER
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedStaff = staffData.filter(person => {
      const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const nameWords = cleanName.split(' ');
      const jobWords = cleanJob.split(' ');

      const nameMatches = queryWords.filter(qw => nameWords.includes(qw)).length;
      const jobMatches = queryWords.filter(qw => jobWords.includes(qw)).length;

      return nameMatches >= 2 || jobMatches >= 1;
    });

    if (matchedStaff.length === 0) {
      matchedStaff = staffData.filter(person => {
        const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return queryWords.some(word => cleanName.includes(word) || cleanJob.includes(word));
      });
    }

    if (matchedStaff.length > 0) {
      const staffInfo = matchedStaff.slice(0, 3).map(p => 
        `Name: ${p.name}\nJob Title: ${p.job_title}\nDescription: ${p.description || 'None'}`
      ).join('\n---\n');
      systemPrompt += `\n\n[PRIVATE STAFF DATA]:\n${staffInfo}\n\nUse this data.`;
    }
  }

  // 3. LIVE SEARCH ROUTER
  if (queryText && queryText.length > 3 && !systemPrompt.includes("PRIVATE STAFF DATA")) {
    const searchResults = await searchWeb(queryText);
    if (searchResults && !searchResults.includes("No live search results")) {
      systemPrompt += `\n\n[LIVE SEARCH RESULTS]:\n${searchResults}\n\nCRITICAL: Use the above LIVE SEARCH RESULTS to answer the user's question about the news.`;
    }
  }

  async function tryProvider(providerObj, res) {
    const result = await streamText({
      model: providerObj.client(providerObj.model),
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

  // FALLBACK EXECUTION
  try {
    console.log("[Global King] Attempting Primary: DeepSeek");
    await tryProvider(providers.deepseek, res);
    return res.end();
  } catch (err1) {
    try {
      console.log("[Global King] DeepSeek failed. Trying Gemini...");
      await tryProvider(providers.gemini, res);
      return res.end();
    } catch (err2) {
      try {
        console.log("[Global King] Gemini failed. Trying Mistral...");
        await tryProvider(providers.mistral, res);
        return res.end();
      } catch (err3) {
        try {
          console.log("[Global King] Mistral failed. Trying OpenRouter...");
          await tryProvider(providers.openrouter, res);
          return res.end();
        } catch (err4) {
          if (!res.headersSent) {
            return res.status(502).json({ error: "The Global King is currently unavailable." });
          }
          res.write(`\n\n[System Error: All AI brains failed to connect.]`);
          return res.end();
        }
      }
    }
  }
}
