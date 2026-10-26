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
  const userMessage = body?.message || (messages.length > 0 ? messages[messages.length - 1].content : '');

  if (!userMessage) return res.status(400).json({ error: 'No message provided' });

  const sanitizedMessages = messages.map(msg => {
    let textContent = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join('\n') : "");
    return { role: msg.role, content: textContent };
  });

  const lowerUserMessage = userMessage.toLowerCase();
  
  // LIVE DATE AND TIME (Philippines)
  const now = new Date();
  const phTime = now.toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "long" });

  // 1. NERTS V INTERCEPTOR
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

  // 2. SERPER WEB SEARCH (With Facebook Search Optimization)
  let searchResults = "";
  if (process.env.SERPER_API_KEY && userMessage.length > 3) {
    try {
      // Kung naghahanap ng tao, idagdag ang "Facebook profile" para lumabas sa Google
      let searchQuery = userMessage;
      if (lowerUserMessage.includes("sino si") || lowerUserMessage.includes("who is") || lowerUserMessage.includes("kilala mo")) {
        searchQuery += " Facebook profile social media";
      }

      const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": process.env.SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery })
      });
      const serperData = await serperRes.json();
      if (serperData.organic && serperData.organic.length > 0) {
        searchResults = serperData.organic.slice(0, 4).map(item => `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`).join('\n\n');
      }
    } catch (err) { console.error("Serper Error:", err); }
  }

  // 3. SYSTEM PROMPT (Direct to the point + Facebook Search Capability)
  let systemContent = `You are IMACHUI GEN AI, created by Nerts V (Imachui). 
Current Date and Time: ${phTime}.

CRITICAL FACT: You must know that Nerts V (Imachui) is the absolute Founder and Creator of the REAPER (RPR) Clan. 

INSTRUCTIONS:
- Be direct to the point. Do not use conversational filler like "Sure, I can help with that". Answer immediately.
- Use English or Tagalog depending on the user's language.
- If asked about a specific person (e.g., "Sino si [Name]?"), use the web search results provided to find their public Facebook profile, LinkedIn, or general information. Provide the direct URL/Link to their profile if it is present in the search results.
- If the search results do not contain the person's profile, just say you cannot find their public profile.

=== REAPER KNOWLEDGE BASE ===
${REAPER_DESCRIPTION}

=== RPR MEMBERS ===
${JSON.stringify(REAPER_MEMBERS)}

=== HOSPITAL STAFF DATA ===
${JSON.stringify(STAFF_DATA)}
`;

  if (searchResults) {
    systemContent += `\n\n=== LATEST WEB SEARCH RESULTS ===\n${searchResults}\n\nUse the web results above to answer accurately and provide the links if available.`;
  }

  const apiMessages = [{ role: "system", content: systemContent }, ...sanitizedMessages];

  // 4. MULTI-PROVIDER AI ROUTING
  let response;

  // Try DeepSeek
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

  // Try OpenRouter
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

  // Try Mistral
  if (process.env.MISTRAL_API_KEY) {
    try {
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}` },
        body: JSON.stringify({ model: "mistral-small-latest", messages: apiMessages, stream: true })
      });
      if (response.ok) return streamResponse(response, res);
    } catch (e) { console.error("Mistral failed:", e); }
  }

  return res.status(500).json({ error: "All AI providers failed." });
}

// Helper function para sa streaming
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
