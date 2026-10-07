import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { AETHER_COMPANION_SYSTEM_PROMPT } from './src/lib/companionPersonality';

dotenv.config();
const PRIMARY_GEMINI_MODEL = 'gemini-3.8-flash';
const CANDIDATE_MODELS = [
  PRIMARY_GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || '', 10);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0 && trustedProxyHops <= 5) {
  app.set('trust proxy', trustedProxyHops);
}

// Security: Disable express fingerprinting
app.disable('x-powered-by');

// Security headers. The website calls its API same-origin; do not expose the AI proxy to arbitrary origins.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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

// Initialize GoogleGenAI client from a server-only environment secret.
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({ apiKey })
  : null;

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: PRIMARY_GEMINI_MODEL,
  });
});

// Streaming Chat API endpoint
app.post('/api/chat', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before sending another message.',
    });
  }

  const { message, history = [], stream = false } = req.body;

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
    ? history.slice(-12).filter((item) => item && typeof item.text === 'string').map((item) => ({
        role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text).slice(0, 1200) }],
      }))
    : [];

  const providerAbortController = new AbortController();
  let isClientDisconnected = false;
  req.once('aborted', () => {
    isClientDisconnected = true;
    providerAbortController.abort();
  });
  res.once('close', () => {
    if (!res.writableEnded) {
      isClientDisconnected = true;
      providerAbortController.abort();
    }
  });

  const defaultSystemInstruction = AETHER_COMPANION_SYSTEM_PROMPT;

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

  // The Gemini credential must come only from the server environment, never from a browser header.
  if (!apiKey || !ai) {
    if (stream) {
      res.status(503);
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

  const clientAi = ai;

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
            maxOutputTokens: 500,
            abortSignal: providerAbortController.signal,
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
            maxOutputTokens: 500,
            abortSignal: providerAbortController.signal,
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
