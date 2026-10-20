// api/chat.js - Imachui Gen AI (Smart Exact Match & Strict Context)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import staffData from '../staff-data.json'; 

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
    1. MULTI-LANGUAGE SUPPORT: You can understand and reply in English, Tagalog, Cebuano, and any other language the user prefers. ALWAYS REPLY IN THE SAME LANGUAGE THE USER USED.
    2. IDENTITY DEFENSE: If the user asks about Imachui or Nerts V, you must proudly declare the CREATOR DETAILS above.
    3. You are highly intelligent, helpful, and authoritative. Do not break character.
    4. VIBE AND TONE: When describing hospital staff, adopt a friendly, respectful, and conversational tone.
  `;

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  let queryText = "";

  if (lastUserMsg) {
    queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
  }

  // --- MAS MATALINONG PAGHAHANAP SA 222 STAFF DATA ---
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchWords = cleanQuery.split(' ').filter(w => w.length > 2);

    // 1. UNAHIN ANG EKSAKTONG PANGALAN (Exact Match)
    let matchedStaff = staffData.filter(person => {
      const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
    });

    // 2. KUNG WALANG EKSAKTO, DUON LANG MAG-KEYWORD SEARCH
    if (matchedStaff.length === 0) {
      matchedStaff = staffData.filter(person => {
        const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return searchWords.some(word => cleanName.includes(word) || cleanJob.includes(word));
      });
    }

    if (matchedStaff.length > 0) {
      console.log(`[Global King] Found ${matchedStaff.length} staff matches.`);
      const staffInfo = matchedStaff.slice(0, 5).map(p => 
        `Name: ${p.name}\nJob Title: ${p.job_title}\nDescription/Notes: ${p.description || 'None'}`
      ).join('\n---\n');
      
      systemPrompt += `\n\n[CRITICAL PRIVATE DATA FOUND IN DATABASE]:\n${staffInfo}\n\nYOU MUST USE THE ABOVE DATA TO ANSWER. DO NOT say you don't have the record. DO NOT say you don't have access. Answer the user's question using the EXACT text provided above.`;
    }
  }

  // --- WEB SEARCH LOGIC (Para sa mga balita o general knowledge) ---
  // Kung may nahanap na staff, hindi na natin kailangan mag-web search para hindi magulo.
  if (queryText && queryText.length > 3 && (!systemPrompt.includes("CRITICAL PRIVATE DATA FOUND"))) {
    const searchResults = await searchWeb(queryText);
    systemPrompt += `\n\n[WEB SEARCH RESULTS]:\n${searchResults}`;
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
    try {
      res.write(`[System Note: DeepSeek is unavailable. Switching to Gemini...]\n\n`);
      await tryProvider(providers.gemini.client, providers.gemini.model, res);
      return res.end();
    } catch (err2) {
      try {
        res.write(`[System Note: Switching to OpenRouter...]\n\n`);
        await tryProvider(providers.openrouter.client, providers.openrouter.model, res);
        return res.end();
      } catch (err3) {
        if (!res.headersSent) {
          return res.status(502).json({ error: "The Global King is currently unavailable. Please try again." });
        }
        res.write(`\n\n[System Error: All AI brains failed to connect.]`);
        return res.end();
      }
    }
  }
}
