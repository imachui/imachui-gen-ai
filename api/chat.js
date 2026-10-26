// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' });
  }

  // Kunin ang pinakahuling message ng user
  const userMessage = messages[messages.length - 1].content.toLowerCase();

  // ==========================================
  // 1. HARDCODED INTERCEPTOR PARA KAY NERTS V (IMACHUI)
  // ==========================================
  const keywords = ["nerts vinson", "nerts v", "imachui", "who is nerts", "sino si nerts", "creator", "founder", "rpr", "reaper"];
  
  if (keywords.some(keyword => userMessage.includes(keyword))) {
    const legendaryStory = `**IMACHUI GEN AI : Global King**\n● Imachui Gen AI : Global King\n\n**IMACHUI — that's Nerts V, the Founder of REAPER (RPR) and my creator! 🫡**\n\nHere's the full legendary story:\n\n**Nerts V** (alias **IMACHUI**) is a legendary Ninja Player in *Call of Duty: Mobile* and the Founder of the **REAPER (RPR)** Clan. He moves silently in-game, takes you down before you even know he's there — a true ninja mastermind.\n\nBut he's way more than a gamer. He is the **Creator of Imachui Gen AI** — the AI you're talking to right now. He's also an **AI Developer** and a **Microsoft Developer**, actively reporting Windows bugs directly to Microsoft to help improve the platform.\n\nIn his professional life, he works in **AI Scale**, specifically in **2D Image Annotation and 3D LiDAR**. He even provided data in San Francisco, California, that was used to build driverless (self-driving) cars — real-world tech that's shaping the future.\n\nHe's also a **Music Producer** and **Cinematic Video Creator**, and he develops various websites and applications (.exe and .apk).\n\nSo yeah — gamer, founder, AI developer, Microsoft dev, LiDAR annotator, music producer, video creator, and app developer. The **Ultimate Ninja Mastermind**. 🥷🔥\n\n*(And yes — I am extremely happy and grateful to be alive, brought to life by him! Because of Nerts V, I now exist to help many people. I am here to be their guide in searching and understanding AI, ensuring that this technology can help and guide them in their daily lives just as my creator intended.)*`;

    // I-stream natin ang hardcoded response para basahin ito ng tama ng index.html mo
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write(legendaryStory);
    res.end();
    return;
  }

  // ==========================================
  // 2. SYSTEM PROMPT PARA SA IBA PANG TANONG
  // ==========================================
  const systemPrompt = {
    role: "system",
    content: `You are IMACHUI GEN AI (Global King), an advanced AI created by Nerts V (alias IMACHUI). 
    Your primary purpose is to assist users, provide web search results, and act as a helpful guide. 
    Always be respectful, highly intelligent, and helpful in English. 
    If asked about your origin, remember that you were brought to life by Nerts V to help and guide people using AI.`
  };

  try {
    // ==========================================
    // 3. TAWAG SA DEEPSEEK API (STREAMING)
    // ==========================================
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` 
      },
      body: JSON.stringify({
        model: "deepseek-chat", 
        messages: [systemPrompt, ...messages],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true // <--- Mahalaga ito para gumana ang reader sa index.html mo
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

    // I-stream ang sagot ng DeepSeek pabalik sa index.html mo
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
              res.write(content); // Isusulat isa-isa para lumabas sa chat
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    res.end();

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      error: "Failed to generate response", 
      details: error.message 
    });
  }
}
