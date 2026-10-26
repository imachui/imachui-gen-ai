// api/chat.js
import { REAPER_DESCRIPTION, REAPER_MEMBERS, STAFF_DATA } from '../lib/database.js';

// Helper function para mag-cancel ng request kapag masyadong matagal
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000 } = options; // 15 seconds timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });
  clearTimeout(id);
  return response;
}

// Helper function para sa Image Analysis (Sequential Fallback)
async function analyzeImage(base64Data, mimeType, userMessage) {
  const dataUri = `data:${mimeType};base64,${base64Data}`;
  const promptText = `You are IMACHUI GEN AI. Describe this image directly in detail. User's prompt: "${userMessage || 'Describe this image'}"`;
  
  let errorLog = "";

  // 1. TRY GOOGLE GEMINI FIRST
  if (process.env.GEMINI_API_KEY) {
    const geminiModels = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash"];
    for (const model of geminiModels) {
      try {
        const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data: base64Data } }] }]
          }),
          timeout: 15000
        });
        
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
        if (data.error) errorLog += `[Gemini ${model}]: ${data.error.message}. `;
      } catch (e) {
        errorLog += `[Gemini ${model} Timeout]: ${e.message}. `;
      }
    }
  }

  // 2. FALLBACK TO OPENROUTER (Yung dating gumana)
  if (process.env.OPENROUTER_API_KEY) {
    const orModels = ["meta-llama/llama-3.2-11b-vision-instruct", "qwen/qwen-2-vl-7b-instruct"];
    
    for (const model of orModels) {
      try {
        const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}` 
          },
          body: JSON.stringify({
            model: model,
            messages: [{ 
              role: "user", 
              content: [
                { type: "text", text: promptText }, 
                { type: "image_url", image_url: { url: dataUri } }
              ] 
            }]
          }),
          timeout: 15000
        });
        
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          return data.choices[0].message.content;
        }
        if (data.error) errorLog += `[OpenRouter ${model}]: ${data.error.message}. `;
      } catch (e) {
        errorLog += `[OpenRouter ${model} Timeout]: ${e.message}. `;
      }
    }
  }

  return `⚠️ Hindi mabasa ang image ngayon.\n\n**Detalye ng Error:**\n${errorLog}\n\n*(Pakisubukan muli mamaya o i-check ang API keys sa Vercel)*`;
}

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

  if (lastMessage && Array.isArray(lastMessage.content)) {
    for (const part of lastMessage.content) {
      if (part.type === 'image') { hasImage = true; imageBase64 = part.image; } 
      else if (part.type === 'text' && part.text) { userMessage = part.text; }
    }
  }

  if (!userMessage && !hasImage) return res.status(400).json({ error: 'No message provided' });

  // IMAGE LOGIC
  if (hasImage) {
    try {
      const base64Data = imageBase64.split(',')[1];
      const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
      const answer = await analyzeImage(base64Data, mimeType, userMessage);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(answer);
    } catch (e) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(`⚠️ Error: ${e.message}`);
    }
  }

  // ==========================================
  // KUNG WALANG IMAGE, DITO NA ANG TEXT LOGIC
  // ==========================================

  const lowerUserMessage = userMessage.toLowerCase();
  const now = new Date();
  const phTime = now.toLocaleString("en-US", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "long" });

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
3. If asked about a specific person, analyze the Web Search Results. 
4. **CRITICAL RULE FOR LINKS**: You MUST provide the source URLs if they are present. DO NOT use markdown format like [Text](URL). Just output the RAW URL starting with https:// (e.g., https://facebook.com/...). NEVER put spaces or line breaks inside the URL. Put the link on its own separate line.
5. If the person is not found in the results, just say it's private or not indexed.

=== REAPER KNOWLEDGE BASE ===
${REAPER_DESCRIPTION}

=== RPR MEMBERS ===
${JSON.stringify(REAPER_MEMBERS)}

=== HOSPITAL STAFF DATA ===
${JSON.stringify(STAFF_DATA)}
`;

  if (searchResults) {
    systemContent += `\n\n=== LATEST WEB SEARCH RESULTS ===\n${searchResults}\n\nUse the web results above to answer accurately and INCLUDE THE LINKS using raw URLs.`;
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
