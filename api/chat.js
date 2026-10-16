// api/chat.js - Imachui Gen AI (Libreng Ensemble: Groq + DeepSeek)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Kailangan ito para sa mas mahabang processing time sa Vercel
export const maxDuration = 60; 

const ALLOWED_ORIGINS = new Set([
  "https://imachui.github.io",
  "https://imachui-gen-ai.vercel.app",
  "http://localhost:3000"
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
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

  // KUNIN ANG MGA API KEY MULA SA VERCEL ENVIRONMENT VARIABLES
  const groqKey = process.env.GROQ_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!groqKey || !deepseekKey) {
    return res.status(500).json({ error: "Missing API keys. Add GROQ_API_KEY and DEEPSEEK_API_KEY in Vercel." });
  }

  const incomingMessages = normalizeMessages(req.body || {});

  if (!incomingMessages.length) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    // 1. GUMAWA NG CLIENTS PARA SA DALAWANG PROVIDER
    const groq = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: groqKey });
    const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: deepseekKey });

    // 2. IPADALA ANG TANONG SA DALAWA NANG SABAY (Parallel)
    console.log("[Imachui] Starting ensemble: Groq + DeepSeek");
    
    const [groqResult, dsResult] = await Promise.allSettled([
      generateText({ 
        model: groq('llama-3.3-70b-versatile'), // Magandang libreng modelo mula sa Groq
        system: "You are a helpful AI assistant. Answer accurately and concisely.",
        messages: incomingMessages 
      }),
      generateText({ 
        model: deepseek('deepseek-chat'), 
        system: "You are a helpful AI assistant. Answer accurately and concisely.",
        messages: incomingMessages 
      })
    ]);

    // 3. KUNIN ANG MGA SAGOT
    const groqAnswer = groqResult.status === 'fulfilled' ? groqResult.value.text : `[Groq Error: ${String(groqResult.reason?.message || groqResult.reason).slice(0, 100)}]`;
    const dsAnswer = dsResult.status === 'fulfilled' ? dsResult.value.text : `[DeepSeek Error: ${String(dsResult.reason?.message || dsResult.reason).slice(0, 100)}]`;

    console.log("[Imachui] Groq answer length:", groqAnswer.length);
    console.log("[Imachui] DeepSeek answer length:", dsAnswer.length);

    // 4. PAGSAMAHIN ANG MGA SAGOT (Synthesis)
    // Gagamitin natin ang Groq (Llama) bilang "tagahusga" dahil mabilis ito.
    const synthesisPrompt = `
      Ikaw ay isang ekspertong tagahusga (synthesizer). Pag-aralan ang dalawang sagot sa ibaba mula sa dalawang magkaibang AI.
      Gawin mong isang pinagsama-samang, pinakamahusay, at kumpletong sagot ang mga ito.
      Alisin ang mga paulit-ulit. Kung may kontradiksyon, piliin ang pinaka-tama at lohikal.
      Huwag banggitin na may dalawang AI na sumagot, diretso lang sa pinal na sagot.

      --- SAGOT MULA SA AI #1 (Groq/Llama) ---
      ${groqAnswer}

      --- SAGOT MULA SA AI #2 (DeepSeek) ---
      ${dsAnswer}

      --- PINAGSAMANG SAGOT ---
    `;

    const finalResult = streamText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.3, // Mas factual at diretso
    });

    // 5. I-STREAM ANG HULING SAGOT PABALIK SA FRONTEND
    for await (const chunk of finalResult.textStream) {
      res.write(chunk);
    }
    return res.end();

  } catch (error) {
    console.error("[Imachui] Global Error:", String(error?.message || error).slice(0, 300));
    if (!res.headersSent) {
      return res.status(502).json({ error: `Chat error: ${String(error?.message || error).slice(0, 300)}` });
    } else {
      res.write(`\n\n[System Error: ${String(error?.message || error).slice(0, 100)}]`);
      res.end();
    }
  }
}
