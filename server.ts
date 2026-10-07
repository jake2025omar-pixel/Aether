import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Security: Disable express fingerprinting
app.disable('x-powered-by');

// Security: Basic security headers & CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gemini-api-key');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Security: Enforce strict payload body limit to prevent memory exhaustion DoS
app.use(express.json({ limit: '64kb' }));

// In-memory sliding rate limiter for AI Chat requests (35 requests / minute / IP)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 35;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitMap.set(ip, validTimestamps);
    return true;
  }
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return false;
}

// Clean up stale rate limiter entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}, 5 * 60 * 1000);

// Initialize GoogleGenAI client with standard aistudio-build telemetry
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    model: 'gemini-flash-latest',
  });
});

// Streaming Chat API endpoint
app.post('/api/chat', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before sending another message.',
    });
  }

  const { message, history = [], systemInstruction, stream = true } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string.' });
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: 'Message exceeds maximum allowed length of 2,000 characters.' });
  }

  // Sanitize history payload
  const safeHistory = Array.isArray(history)
    ? history.slice(-20).filter((item) => item && typeof item.text === 'string').map((item) => ({
        role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text).slice(0, 2000) }],
      }))
    : [];

  let isClientDisconnected = false;
  req.on('close', () => {
    isClientDisconnected = true;
  });

  // Candidate models in priority order: start with fast, available flash models
  const CANDIDATE_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ];

  const defaultSystemInstruction =
    systemInstruction ||
    `You are Aether AI, a friendly, ultra-fast and helpful AI assistant powered by Gemini Flash.
You communicate fluently in Arabic and English. If the user writes in Arabic, respond in clear, natural Arabic. If in English, respond in English.
Provide concise, accurate, and practical answers. Use clean formatting and code blocks when appropriate.`;

  const getLocalCompanionFallback = (userInput: string): string => {
    const isArabic = /[\u0600-\u06FF]/.test(userInput);
    if (isArabic) {
      return '[EMOTION: NEUTRAL] أهلاً بك! خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً في هذه اللحظة، يرجى إعادة المحاولة بعد ثوانٍ قليلة.';
    }
    return "[EMOTION: NEUTRAL] I'm listening, but the AI service is experiencing high demand right now. Please try asking again in a moment.";
  };

  // Format contents for @google/genai
  const contents = [
    ...safeHistory,
    {
      role: 'user',
      parts: [{ text: trimmedMessage }],
    },
  ];

  // Request-specific or server client
  const clientKey = (req.headers['x-gemini-api-key'] as string) || apiKey;
  if (!clientKey) {
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ error: 'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in server environment.' })}\n\n`);
      res.end();
      return;
    } else {
      return res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in server environment.',
      });
    }
  }

  const clientAi = clientKey === apiKey && ai ? ai : new GoogleGenAI({
    apiKey: clientKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let streamSucceeded = false;
    for (const model of CANDIDATE_MODELS) {
      if (isClientDisconnected) break;
      try {
        const responseStream = await clientAi.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });

        for await (const chunk of responseStream) {
          if (isClientDisconnected) break;
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        if (isClientDisconnected) break;
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        streamSucceeded = true;
        break;
      } catch (err: unknown) {
        console.warn(`Model ${model} streaming attempt failed:`, err instanceof Error ? err.message : err);
      }
    }

    if (!streamSucceeded && !isClientDisconnected) {
      const fallbackText = getLocalCompanionFallback(trimmedMessage);
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } else {
    for (const model of CANDIDATE_MODELS) {
      if (isClientDisconnected) break;
      try {
        const response = await clientAi.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });

        const generatedText = response.text || '';
        if (generatedText) {
          return res.json({
            text: generatedText,
            model,
          });
        }
      } catch (err: unknown) {
        console.warn(`Model ${model} generate attempt failed:`, err instanceof Error ? err.message : err);
      }
    }

    // Graceful fallback response if all models are temporarily busy
    const fallbackText = getLocalCompanionFallback(message);
    return res.json({
      text: fallbackText,
      model: 'local-fallback',
      isFallback: true,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Always serve public assets (VRM, FBX, images) directly
  app.use(express.static(path.resolve(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.vrm')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      }
    },
  }));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
