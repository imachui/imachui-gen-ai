// api/chat.js - Imachui Gen AI (Ultimate Smart Router & 5-Provider Fallback)
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

async function searchWeb(query) {
  const apiKey = process.env.SERPER_API_KEY;
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
        let results = "Here are the latest search results from the web:\n";
        if (data.organic && data.organic.length > 0) {
          data.organic.forEach((item, index) => {
            results += `[${index + 1}] ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}\n\n`;
          });
          return results;
        }
      }
    } catch (error) {}
  }

  const isNews = /balita|news|latest|ngayon|today|update|current|kaganapan|isyu/i.test(query);
  if (isNews) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PH&gl=PH&ceid=PH:en`;
      const res = await fetch(rssUrl, { signal: AbortSignal.timeout(6000) });
      const xml = await res.text();
      const items = xml.split('<item>');
      let results = "Here are the latest news results from the web:\n";
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
      if (count > 0) return results;
    } catch (e) {}
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

  // --- 5 PROVIDERS SETUP ---
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
      model: 'open-mistral-nemo' // Magaling ito sa coding at general logic
    },
    openrouter: {
      client: createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    }
  };

  let systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI, THE GLOBAL KING.]
    Identity: You are Imachui Gen AI, created by Nerts V (Imachui). You are helpful, authoritative, and multi-lingual.
    Rule: Always reply in the language the user used.
  `;

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  let queryText = "";
  if (lastUserMsg) {
    queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
  }

  // ==========================================
  // 1. SMART ROUTER: DETECT CODING
  // ==========================================
  const isCoding = /```|function|const |let |var |class |import |def |python|javascript|react|node|html|css|sql|error|bug|api|json|php|java|c\+\+|c#/i.test(queryText);
  if (isCoding) {
    console.log("[Router] Coding intent detected. Injecting Senior Engineer Prompt.");
    systemPrompt += `\n\n[CODING MODE ACTIVATED]: You are acting as a Senior Software Engineer. Provide clean, highly optimized, and secure code. Explain the logic step-by-step. If there is an error, debug it meticulously.`;
  }

  // ==========================================
  // 2. SMART ROUTER: DETECT STAFF (JSON)
  // ==========================================
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedStaff = staffData.filter(person => {
      const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
    });

    if (matchedStaff.length === 0) {
      matchedStaff = staffData.filter(person => {
        const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return searchWords.some(word => cleanName.includes(word) || cleanJob.includes(word));
      });
    }

    if (matchedStaff.length > 0) {
      console.log("[Router] Staff data found.");
      const staffInfo = matchedStaff.slice(0, 5).map(p => 
        `Name: ${p.name}\nJob Title: ${p.job_title}\nDescription/Notes: ${p.description || 'None'}`
      ).join('\n---\n');
      systemPrompt += `\n\n[CRITICAL PRIVATE DATA FOUND]:\n${staffInfo}\n\nYOU MUST USE THIS DATA. DO NOT SAY YOU DON'T KNOW.`;
    }
  }

  // ==========================================
  // 3. SMART ROUTER: DETECT iHOMIS+ GUIDE
  // ==========================================
  if (queryText) {
    const isIHomisQuery = /ihomis|system|update|guide|login|error|troubleshoot|manual|paano|how to/i.test(queryText);
    if (isIHomisQuery && !systemPrompt.includes("CRITICAL PRIVATE DATA FOUND")) {
      try {
        const guidePath = path.join(process.cwd(), 'ihomis-guide.txt');
        if (fs.existsSync(guidePath)) {
          const ihomisGuide = fs.readFileSync(guidePath, 'utf8');
          console.log("[Router] iHOMIS+ Guide found.");
          systemPrompt += `\n\n[CRITICAL iHOMIS+ SYSTEM MANUAL]:\n${ihomisGuide.substring(0, 50000)}\n\nUSE THIS GUIDE TO ANSWER THE USER'S QUESTION.`;
        }
      } catch (err) {
        console.error("Error reading iHOMIS guide:", err);
      }
    }
  }

  // ==========================================
  // 4. SMART ROUTER: LIVE WEB SEARCH (BALITA)
  // ==========================================
  if (queryText && queryText.length > 3 && !systemPrompt.includes("CRITICAL PRIVATE DATA") && !systemPrompt.includes("iHOMIS+ SYSTEM MANUAL")) {
    console.log("[Router] General/News intent. Triggering Web Search...");
    const searchResults = await searchWeb(queryText);
    if (searchResults && !searchResults.includes("No live search results")) {
      systemPrompt += `\n\n[LIVE WEB SEARCH RESULTS]:\n${searchResults}\n\nUse this real-time data to answer accurately.`;
    }
  }

  // ==========================================
  // FALLBACK EXECUTION ENGINE (5-Tier)
  // ==========================================
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
            return res.status(502).json({ error: "The Global King is currently unavailable. All AI providers failed." });
          }
          res.write(`\n\n[System Error: All AI brains failed to connect.]`);
          return res.end();
        }
      }
    }
  }
}
