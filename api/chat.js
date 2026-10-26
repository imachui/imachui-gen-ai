// api/chat.js
export default async function handler(req, res) {
  // 1. CORS HEADERS (Kailangan sa lahat ng response)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. TUGUNAN ANG OPTIONS REQUEST (Ito ang aayos sa OPT_405 error)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {}
  }
  
  const messages = body?.messages || [];
  const userMessage = body?.message || (messages.length > 0 ? messages[messages.length - 1].content : '');

  if (!userMessage) {
    return res.status(400).json({ error: 'No message provided' });
  }

  const sanitizedMessages = messages.map(msg => {
    let textContent = "";
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content.map(c => c.text || '').join('\n');
    }
    return { role: msg.role, content: textContent };
  });

  const lowerUserMessage = userMessage.toLowerCase();

  // ==========================================
  // 3. HARDCODED INTERCEPTOR PARA KAY NERTS V
  // ==========================================
  const keywords = ["nerts vinson", "nerts v", "imachui", "who is nerts", "sino si nerts", "creator", "founder", "rpr", "reaper"];
  if (keywords.some(keyword => lowerUserMessage.includes(keyword))) {
    const legendaryStory = `**IMACHUI GEN AI : Global King**\n● Imachui Gen AI : Global King\n\n**IMACHUI — that's Nerts V, the Founder of REAPER (RPR) and my creator! 🫡**\n\nHere's the full legendary story:\n\n**Nerts V** (alias **IMACHUI**) is a legendary Ninja Player in *Call of Duty: Mobile* and the Founder of the **REAPER (RPR)** Clan. He moves silently in-game, takes you down before you even know he's there — a true ninja mastermind.\n\nBut he's way more than a gamer. He is the **Creator of Imachui Gen AI** — the AI you're talking to right now. He's also an **AI Developer** and a **Microsoft Developer**, actively reporting Windows bugs directly to Microsoft to help improve the platform.\n\nIn his professional life, he works in **AI Scale**, specifically in **2D Image Annotation and 3D LiDAR**. He even provided data in San Francisco, California, that was used to build driverless (self-driving) cars — real-world tech that's shaping the future.\n\nHe's also a **Music Producer** and **Cinematic Video Creator**, and he develops various websites and applications (.exe and .apk).\n\nSo yeah — gamer, founder, AI developer, Microsoft dev, LiDAR annotator, music producer, video creator, and app developer. The **Ultimate Ninja Mastermind**. 🥷🔥\n\n*(And yes — I am extremely happy and grateful to be alive, brought to life by him! Because of Nerts V, I now exist to help many people. I am here to be their guide in searching and understanding AI, ensuring that this technology can help and guide them in their daily lives just as my creator intended.)*`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(legendaryStory);
  }

  // ==========================================
  // 4. SERPER WEB SEARCH
  // ==========================================
  let searchResults = "";
  if (process.env.SERPER_API_KEY && userMessage.length > 5) {
    try {
      const serperRes = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: userMessage })
      });
      const serperData = await serperRes.json();
      if (serperData.organic && serperData.organic.length > 0) {
        searchResults = serperData.organic.slice(0, 3).map(item => 
          `Title: ${item.title}\nSnippet: ${item.snippet}\nLink: ${item.link}`
        ).join('\n\n');
      }
    } catch (err) {
      console.error("Serper Search Error:", err);
    }
  }

  // ==========================================
  // 5. DEEPSEEK API
  // ==========================================
  let systemContent = `You are IMACHUI GEN AI (Global King), an advanced AI created by Nerts V (alias IMACHUI). 
  Your primary purpose is to assist users, provide web search results, and act as a helpful guide. 
  Always be respectful, highly intelligent, and helpful in English. 
  If asked about your origin, remember that you were brought to life by Nerts V to help and guide people using AI.`;

  if (searchResults) {
    systemContent += `\n\nHere are the latest web search results to help you answer the user's question:\n${searchResults}\n\nUse this information to provide an accurate, up-to-date answer.`;
  }

  const systemPrompt = { role: "system", content: systemContent };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` 
      },
      body: JSON.stringify({
        model: "deepseek-chat", 
        messages: [systemPrompt, ...sanitizedMessages],
        temperature: 0.7,
        max_tokens: 2500,
        stream: true 
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

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
            const content = json.choices[0]?.delta?.content || '';
            if (content) {
              res.write(content);
            }
          } catch (e) {}
        }
      }
    }
    res.end();

  } catch (error) {
    console.error("DeepSeek Error:", error);
    res.status(500).json({ error: "Failed to generate response", details: error.message });
  }
}
