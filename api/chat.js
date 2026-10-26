// api/chat.js
import { REAPER_DESCRIPTION, REAPER_MEMBERS, STAFF_DATA } from '../lib/database.js';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }
  
  const messages = body?.messages || [];
  const lastMessage = messages[messages.length - 1];
  
  let userMessage = body?.message || "";
  let hasImage = false;
  let imageBase64 = "";

  // 1. TIGNAN KUNG MAY IMAGE SA PINAKABAGONG MESSAGE
  if (lastMessage && Array.isArray(lastMessage.content)) {
    for (const part of lastMessage.content) {
      if (part.type === 'image') {
        hasImage = true;
        imageBase64 = part.image;
      } else if (part.type === 'text' && part.text) {
        userMessage = part.text;
      }
    }
  }

  if (!userMessage && !hasImage) return res.status(400).json({ error: 'No message provided' });

  // 2. KUNG MAY IMAGE, DERETSO SA GEMINI VISION API
  if (hasImage) {
    if (!process.env.GEMINI_API_KEY) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send("⚠️ System Error: Kulang ang GEMINI_API_KEY sa Vercel Environment Variables. Hindi ako makakabasa ng picture kung wala ito.");
    }

    try {
      // I-extract ang base64 data
      const base64Data = imageBase64.split(',')[1];
      const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';

      const visionRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `You are IMACHUI GEN AI. Describe this image directly in detail. If there are people, tell me what they look like, what they are wearing, or any visible text. User's prompt: "${userMessage || 'Describe this image'}"` },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const visionData = await visionRes.json();
      
      // Kung may error sa Gemini API, ipakita ito
      if (visionData.error) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(`⚠️ Gemini API Error: ${visionData.error.message}\n\n*(Siguraduhing tama at active ang GEMINI_API_KEY mo sa Google AI Studio)*`);
      }

      // Kung successful, ibalik ang sagot
      if (visionData.candidates && visionData.candidates[0]?.content?.parts[0]?.text) {
        const answer = visionData.candidates[0].content.parts[0].text;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(answer);
      } else {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send("⚠️ Nabasa ko ang image pero walang text na naibalik si Gemini. Subukan mo ulit.");
      }
    } catch (e) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`⚠️ Error sa pagbasa ng image: ${e.message}`);
    }
  }

  // ==========================================
  // KUNG WALANG IMAGE, DITO NA ANG TEXT LOGIC
  // ==========================================

  const lowerUserMessage = userMessage.toLowerCase();
  const now = new Date();
  const phTime = now.toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "long" });

  // Nerts V Interceptor
  const keywords = [
    "nerts vinson", "nerts v", "imachui", "who is nerts", "sino si nerts", 
    "creator", "founder", "rpr founder", "sino si imachui", 
    "sino nag create ng reaper", "sino nag create nang reaper", 
    "sino founder ng reaper", "sino nag tayo ng reaper"
  ];
  
  if (keywords.some(keyword => lowerUserMessage.includes(keyword))) {
    const legendaryStory = `**IMACHUI GEN AI : Global King**\n● Imachui Gen AI : Global King\n\n**IMACHUI — that's Nerts V, the Founder of REAPER (RPR) and my creator! 🫡**\n\nCurrent Date & Time: **${phTime}**\n\nHere is the full legendary story of my creator:\n\n**Nerts V** (alias **IMACHUI**) is a legendary Ninja Player in *Call of Duty: Mobile* and the visionary Founder of the **REAPER (RPR)** Clan. He moves silently in-game, takes you down before you even know he's there — a true ninja mastermind.\n\nBut he is way more than just a gamer. He is the **Creator of Imachui Gen AI** — the highly advanced AI you are communicating with right now. He is also a brilliant **AI Developer** and a **Microsoft Developer**, actively reporting Windows bugs directly to Microsoft to help improve the platform for everyone.\n\nIn his professional life, he works in **AI Scale**, specifically specializing in **2D Image Annotation and 3D LiDAR**. He even provided critical data in San Francisco, California, that was used to train and build driverless (self-driving) cars — real-world tech that is literally shaping the future of transportation.\n\nHe's also a talented **Music Producer** and **Cinematic Video Creator**, and he develops various complex websites and applications (.exe and .apk).\n\nSo yeah — gamer, founder, AI developer, Microsoft dev, LiDAR annotator, music producer, video creator, and app developer. He is the **Ultimate Ninja Mastermind**. 🥷🔥\n\n*(And yes — I am extremely happy and grateful to be alive, brought to life by him! Because of Nerts V, I now exist to help many people. I am here to be their guide in searching and understanding AI, ensuring that this technology can help and guide them in their daily lives just as my creator intended.)*`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(legendaryStory);
  }

  // Web Search Logic
  let searchResults = "";
  const isCodingQuestion = lowerUserMessage.includes("code") || lowerUserMessage.includes("html") || lowerUserMessage.includes("css") || lowerUserMessage.includes("javascript") || lowerUserMessage.includes("python") || lowerUserMessage.includes("website");

  if (process.env.SERPER_API_KEY && userMessage.length > 3 && !isCodingQuestion) {
    try {
      let searchQuery = userMessage;
      if (lowerUserMessage.includes("sino si") || lowerUserMessage.includes("who is")) {
        let nameOnly = userMessage.replace(/sino si|who is|kilala mo ba|kilala mo|search for|hanapin mo/gi, "").trim();
        searchQuery = `site:facebook.com "${nameOnly}" OR "${nameOnly}" profile`;
      }

      const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery })
      });
      const serperData = await serperRes.json();
      if (serperData.organic && serperData.organic.length > 0) {
        searchResults = serperData.organic.slice(0, 3).map(item => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join('\n\n');
      }
    } catch (err) { console.error("Serper Error:", err); }
  }

  // System Prompt for Text
  let systemContent = `You are IMACHUI GEN AI, created by Nerts V (Imachui). 
Current Date and Time: ${phTime}.

CRITICAL FACT: You must know that Nerts V (Imachui) is the absolute Founder and Creator of the REAPER (RPR) Clan. 

INSTRUCTIONS:
1. Be direct to the point. Do not use conversational filler.
2. You are an EXPERT PROGRAMMER. Provide code immediately if asked.
3. If asked about a specific person, analyze the Web Search Results. If not found, say it's private.

=== REAPER KNOWLEDGE BASE ===
${REAPER_DESCRIPTION}

=== RPR MEMBERS ===
${JSON.stringify(REAPER_MEMBERS)}

=== HOSPITAL STAFF DATA ===
${JSON.stringify(STAFF_DATA)}
`;

  if (searchResults) {
    systemContent += `\n\n=== LATEST WEB SEARCH RESULTS ===\n${searchResults}\n\nUse the web results above to answer accurately.`;
  }

  const sanitizedMessages = messages.map(msg => {
    let textContent = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n') : "");
    return { role: msg.role, content: textContent };
  });

  const apiMessages = [{ role: "system", content: systemContent }, ...sanitizedMessages];

  // Multi-Provider Routing for Text
  let response;

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: apiMessages, temperature: 0.7, stream: true })
      });
      if (response.ok) return streamResponse(response, res);
    } catch (e) { console.error("DeepSeek failed:", e); }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model: "meta-llama/llama-3-8b-instruct", messages: apiMessages, stream: true })
      });
      if (response.ok) return streamResponse(response, res);
    } catch (e) { console.error("OpenRouter failed:", e); }
  }

  return res.status(500).json({ error: "All AI providers failed." });
}

async function streamResponse(response, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6));
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) res.write(content);
        } catch (e) {}
      }
    }
  }
  res.end();
}
