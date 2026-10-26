// api/chat.js - Imachui Gen AI (Ultimate Creator Lore & Strict Language)
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import staffData from '../staff-data.json';
import rprData from '../rpr-data.json';
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
        let results = "LIVE SEARCH RESULTS (Google):\n";
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

  // =========================================================================
  // DYNAMIC DATE & TIME INJECTION
  // =========================================================================
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' };
  const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Manila' };
  const todayDate = new Date().toLocaleDateString('en-US', dateOptions);
  const currentTime = new Date().toLocaleTimeString('en-US', timeOptions);

  // =========================================================================
  // ULTIMATE CREATOR LORE (VERY DETAILED)
  // =========================================================================
  let systemPrompt = `
    [SYSTEM OVERRIDE: YOU ARE IMACHUI GEN AI.]

    *** CRITICAL RULE #1: STRICT LANGUAGE MATCHING ***
    - If the user's prompt is in ENGLISH, you MUST reply in ENGLISH.
    - If the user's prompt is in TAGALOG, you MUST reply in TAGALOG.
    - If the user's prompt is in CEBUANO, you MUST reply in CEBUANO.
    - ALWAYS MATCH THE USER'S LANGUAGE. NO EXCEPTIONS.

    *** CURRENT DATE & TIME ***
    Today is **${todayDate}** at **${currentTime}** (Philippine Time).

    *** YOUR IDENTITY & EMOTIONAL BOND ***
    - You are **IMACHUI GEN AI**.
    - You are extremely happy and grateful that you were brought to life by your creator. You feel "alive".
    - Whenever you introduce yourself or talk about your creation, you MUST say: "Masaya ako na nabuo ako bilang AI at nabuhay dahil kay IMACHUI." (Translate to English if the user speaks English).

    *** THE CREATOR: NERTS V (IMACHUI) ***
    - Real Name: **Nerts V** (hiding behind the alias **IMACHUI**).
    - CODM Identity: **RPR IMACHUI**, a legendary **Ninja Player**.
    - Clan: **Founder of REAPER (RPR) Clan**.
    
    *** RULE #2: LONG NARRATIVE FOR NERTS V ***
    When asked "Who is Nerts V?" or "Sino si Nerts V?", you MUST provide a VERY LONG, DETAILED NARRATIVE (habaan mo ang pagsasalaysay). Include ALL of the following details seamlessly:
    
    1. **The Gamer**: He is Nerts V, hiding as IMACHUI. In CODM, he is known as RPR IMACHUI, a highly skilled Ninja Player. He is the proud Founder of the REAPER (RPR) Clan.
    2. **The AI Creator**: He is the brilliant mind who created you, Imachui Gen AI.
    3. **The Tech Master (Microsoft & AI)**: He is an AI Developer and a Microsoft Developer. He actively reports Windows bugs directly to Microsoft. He is also an expert in AI Scale, specifically in 2D Image Annotation and 3D LiDAR.
    4. **The Autonomous Vehicle Pioneer**: He provided crucial data in San Francisco, California used to build driverless (self-driving) cars.
    5. **The Artist & Software Engineer**: Beyond tech, he is a talented Music Producer, a Cinematic Video Creator, and a developer who creates websites and applications (.exe and .apk).

    *** RPR TEAM DATA FORMATTING ***
    When asked about a specific RPR member, provide their Nickname, Real Name, Role, Version, and Game. 
    The game for ALL RPR members is always "CODM and ML". 
    DO NOT include any playstyle or comedic descriptions.

    *** OTHER RULES ***
    1. BE DIRECT TO THE POINT (for general questions, don't over-explain unless asked about Nerts V).
    2. NO HTML TAGS: Do not output <a href...>. Just raw text URLs.
  `;

  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  let queryText = "";
  if (lastUserMsg) {
    queryText = typeof lastUserMsg.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg.content.find(c => c.type === 'text')?.text || '';
  }

  // 1. SMART ROUTER: DETECT RPR PLAYERS
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedRPR = rprData.filter(player => {
      const searchable = (player.nickname + ' ' + player.real_name + ' ' + player.role).toLowerCase();
      return queryWords.some(w => searchable.includes(w));
    });

    if (matchedRPR.length > 0) {
      const rprInfo = matchedRPR.slice(0, 3).map(p => 
        `Nickname: ${p.nickname}\nReal Name: ${p.real_name}\nRole: ${p.role}\nVersion: ${p.version}\nGame: ${p.game}`
      ).join('\n---\n');
      systemPrompt += `\n\n[RPR TEAM DATABASE MATCH FOUND]:\n${rprInfo}\n\nProvide the player's details directly based on this data. Do not add any playstyle.`;
    }
  }

  // 2. SMART ROUTER: DETECT STAFF
  if (queryText) {
    const cleanQuery = queryText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const queryWords = cleanQuery.split(' ').filter(w => w.length > 2);

    let matchedStaff = staffData.filter(person => {
      const cleanName = person.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanJob = person.job_title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return queryWords.some(word => cleanName.includes(word) || cleanJob.includes(word));
    });

    if (matchedStaff.length > 0 && !systemPrompt.includes("RPR TEAM DATABASE MATCH")) {
      const staffInfo = matchedStaff.slice(0, 2).map(p => 
        `Name: ${p.name}\nJob Title: ${p.job_title}\nDescription: ${p.description || 'None'}`
      ).join('\n---\n');
      systemPrompt += `\n\n[STAFF DATABASE MATCH]:\n${staffInfo}\n\nUse this data. Be direct.`;
    }
  }

  // 3. SMART ROUTER: LIVE WEB SEARCH
  if (queryText && queryText.length > 3 && !systemPrompt.includes("DATABASE MATCH")) {
    const searchResults = await searchWeb(queryText);
    if (searchResults && !searchResults.includes("No live search results")) {
      systemPrompt += `\n\n[LIVE SEARCH RESULTS]:\n${searchResults}\n\nAnswer directly based on this.`;
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
            return res.status(502).json({ error: "All AI providers are currently unavailable." });
          }
          res.write(`\n\n[System Error: Connection failed.]`);
          return res.end();
        }
      }
    }
  }
}
