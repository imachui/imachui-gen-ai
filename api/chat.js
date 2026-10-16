// api/chat.js - Imachui Gen AI (Multi-Model Ensemble)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Napakahalaga para hindi mag-timeout sa Vercel (Hobby plan allows up to 60s)
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

  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!openaiKey || !deepseekKey) {
    return res.status(500).json({ error: "Missing API keys in Vercel Environment Variables." });
  }

  // Kunin ang mode mula sa frontend (chatgpt, deepseek, o combine)
  const mode = req.body?.mode || 'combine';
  const incomingMessages = normalizeMessages(req.body || {});
  const userMessage = req.body?.message || "";

  if (!incomingMessages.length && !userMessage) {
    return res.status(400).json({ error: "Please enter a message first." });
  }

  try {
    const openai = createOpenAI({ apiKey: openaiKey });
    const deepseek = createOpenAI({ baseURL: 'https://api.deepseek.com', apiKey: deepseekKey });

    // I-set ang headers para sa streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    if (mode === 'chatgpt') {
      const result = await streamText({ model: openai('gpt-4o-mini'), messages: incomingMessages });
      for await (const chunk of result.textStream) res.write(chunk);
      return res.end();
    }

    if (mode === 'deepseek') {
      const result = await streamText({ model: deepseek('deepseek-chat'), messages: incomingMessages });
      for await (const chunk of result.textStream) res.write(chunk);
      return res.end();
    }

    // --- COMBINE BOTH (ENSEMBLE) ---
    console.log("Starting Ensemble Reasoning...");

    // 1. Tanungin ang DALAWANG AI nang sabay (Parallel)
    const [gptResult, dsResult] = await Promise.allSettled([
      generateText({ 
        model: openai('gpt-4o-mini'), 
        system: "You are a helpful AI assistant. Answer accurately and concisely.",
        messages: incomingMessages 
      }),
      generateText({ 
        model: deepseek('deepseek-chat'), 
        system: "You are a helpful AI assistant. Answer accurately and concisely.",
        messages: incomingMessages 
      })
    ]);

    const gptAnswer = gptResult.status === 'fulfilled' ? gptResult.value.text : "ChatGPT failed to respond.";
    const dsAnswer = dsResult.status === 'fulfilled' ? dsResult.value.text : "DeepSeek failed to respond.";

    console.log("Both AI responded. Starting Synthesis...");

    // 2. Pag-isahin ang sagot gamit si ChatGPT bilang "Judge"
    const synthesisPrompt = `
      Ikaw ay isang ekspertong tagahusga (synthesizer). Pag-aralan ang dalawang sagot sa ibaba mula sa dalawang magkaibang AI.
      Gawin mong isang pinagsama-samang, pinakamahusay, at kumpletong sagot ang mga ito.
      Alisin ang mga paulit-ulit. Kung may kontradiksyon, piliin ang pinaka-tama at lohikal.
      Huwag banggitin na may dalawang AI na sumagot, diretso lang sa pinal na sagot.

      --- SAGOT MULA SA CHATGPT ---
      ${gptAnswer}

      --- SAGOT MULA SA DEEPSEEK ---
      ${dsAnswer}

      --- PINAGSAMANG SAGOT ---
    `;

    const finalResult = streamText({
      model: openai('gpt-4o-mini'), // Mabilis na model para sa synthesis
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.3, // Mas factual at diretso
    });

    for await (const chunk of finalResult.textStream) {
      res.write(chunk);
    }
    return res.end();

  } catch (error) {
    console.error("Global chat error:", String(error?.message || error).slice(0, 500));
    if (!res.headersSent) {
      return res.status(502).json({ error: `Chat error: ${String(error?.message || error).slice(0, 300)}` });
    } else {
      res.end();
    }
  }
}
