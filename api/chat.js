// api/chat.js - Imachui Gen AI (Universal CORS + Automatic Combine All)
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

export const maxDuration = 60;

// PAYAGAN ANG LAHAT NG ORIGINS para gumana sa Messenger, Facebook, at iba pa
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
    gemini: {
      client: createOpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: process.env.GEMINI_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'gemini-1.5-flash'
    },
    nvidia: {
      client: createOpenAI({
        baseURL: 'https://integrate.api.nvidia.com/v1',
        apiKey: process.env.NVIDIA_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'meta/llama-3.1-8b-instruct'
    },
    openrouter: {
      client: createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'qwen/qwen-2.5-72b-instruct:free'
    },
    deepseek: {
      client: createOpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        headers: { 'HTTP-Referer': 'https://imachui.github.io', 'X-Title': 'Imachui Gen AI' }
      }),
      model: 'deepseek-chat'
    }
  };

  console.log("[Imachui] Automatic Combined Mode Started");

  const [gemini, nvidia, openrouter, deepseek] = await Promise.allSettled([
    generateText({ model: providers.gemini.client(providers.gemini.model), messages: incomingMessages }),
    generateText({ model: providers.nvidia.client(providers.nvidia.model), messages: incomingMessages }),
    generateText({ model: providers.openrouter.client(providers.openrouter.model), messages: incomingMessages }),
    generateText({ model: providers.deepseek.client(providers.deepseek.model), messages: incomingMessages })
  ]);

  const answers = [
    gemini.status === 'fulfilled' ? gemini.value.text : null,
    nvidia.status === 'fulfilled' ? nvidia.value.text : null,
    openrouter.status === 'fulfilled' ? openrouter.value.text : null,
    deepseek.status === 'fulfilled' ? deepseek.value.text : null
  ].filter(Boolean);

  if (!answers.length) {
    return res.status(502).json({ error: "All providers failed. Please check your API keys or try again later." });
  }

  const synthesisPrompt = `
    You are Imachui Gen AI, an AI assistant created by Imachui. 
    Analyze the following answers from multiple AI models and combine them into one comprehensive, accurate, and well-structured response. 
    Remove redundancies. If there are contradictions, choose the most logical and factual one. 
    Do not mention that multiple AIs responded. Just provide the final synthesized answer.
    Never identify yourself as DeepSeek, Gemini, or any other model. Always identify yourself as Imachui Gen AI.
    
    --- ANSWERS FROM MULTIPLE AI MODELS ---
    ${answers.map((a, i) => `[AI Model ${i+1}]:\n${a}`).join('\n\n')}
    
    --- FINAL SYNTHESIZED ANSWER ---
  `;

  try {
    const result = await streamText({
      model: providers.deepseek.client(providers.deepseek.model),
      system: `You are Imachui Gen AI, an AI assistant created by Imachui. When asked who you are, you MUST respond exactly with:
      "I'm Imachui Gen Ai, an AI assistant created by Imachui. I'm here to help answer questions, assist with tasks, and have conversations with you.

      A few things about me:
      - I'm a multimodal AI model that can read and process text and images
      - I can handle large amounts of text at once (up to 1M tokens)
      - I'm completely free to use
      - I can search the web if you enable that feature
      - I can read uploaded files (images, PDFs, Word docs, Excel, PowerPoint, etc.)

      Is there anything specific you'd like to know or any way I can help you today? 😊"
      Never mention DeepSeek or any other underlying model. Always maintain the persona of Imachui Gen AI.`,
      messages: [{ role: 'user', content: synthesisPrompt }],
      temperature: 0.3,
    });
    for await (const chunk of result.textStream) res.write(chunk);
    return res.end();
  } catch (error) {
    console.error("Synthesis failed, returning best individual answer:", error);
    const bestAnswer = answers.sort((a, b) => b.length - a.length)[0];
    res.write(bestAnswer);
    return res.end();
  }
}
