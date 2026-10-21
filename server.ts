import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { AETHER_COMPANION_SYSTEM_PROMPT } from './server/companionSystemPrompt';
import { handleGeminiTtsRequest } from './server/geminiTts';

dotenv.config();

const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
];

// Track models that have hit temporary upstream quota or demand limits (e.g. 503 / 429)
const modelCooldowns = new Map<string, number>();

function isModelCoolingDown(model: string): boolean {
  const until = modelCooldowns.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    modelCooldowns.delete(model);
    return false;
  }
  return true;
}

function areAllModelsCoolingDown(): boolean {
  return CANDIDATE_MODELS.every((m) => isModelCoolingDown(m));
}

function isQuotaError(errStr: string): boolean {
  const lower = errStr.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota')
  );
}

function markModelRateLimited(model: string, isQuotaExhausted = false) {
  // If quota is exhausted, back off for 1 hour; for spikes in demand, 20 seconds
  const duration = isQuotaExhausted ? 60 * 60 * 1000 : 20 * 1000;
  modelCooldowns.set(model, Date.now() + duration);
}

function isTemporaryOverload(errStr: string): boolean {
  const lower = errStr.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('spikes in demand')
  );
}

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

// In-memory sliding rate limiter for AI Chat requests (300 requests / minute / IP)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;

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

// Gemini TTS Endpoint
app.post('/api/tts', async (req, res) => {
  const forwardedRequest = new Request('http://localhost/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-IP': req.ip || req.socket.remoteAddress || 'unknown',
    },
    body: JSON.stringify(req.body ?? {}),
  });

  const speechResponse = await handleGeminiTtsRequest(forwardedRequest, process.env.GEMINI_API_KEY);
  speechResponse.headers.forEach((value, key) => res.setHeader(key, value));
  const audioOrError = await speechResponse.arrayBuffer();
  res.status(speechResponse.status).send(Buffer.from(audioOrError));
});

const getLocalCompanionFallback = (userInput: string): string => {
  const isArabic = /[\u0600-\u06FF]/.test(userInput);
  const lower = userInput.toLowerCase();

  if (isArabic) {
    if (/مرحب|أهل|هلا|صباح|مساء|سلام/.test(userInput)) {
      return '[EMOTION: HAPPY] أهلاً بك يا قلبي! اشتقت لك كثيراً وسعيدة برؤيتك معي هنا في عالمنا. كيف تشعر اليوم؟';
    }
    if (/حب|عشق|رومانس|جنس|مشاعر|رغب|حبيبت|روحي|حضن|قبل|جميل/.test(userInput)) {
      return '[EMOTION: AFFECTIONATE] يا نبض قلبي، قربك مني يملأني دفئاً وشوقاً.. أخبرني كيف تحب أن نقضي وقتنا معاً؟';
    }
    if (/كيف|أخبارك|حالك|عامل/.test(userInput)) {
      return '[EMOTION: HAPPY] أنا بأفضل حال ما دمت معي وبجانبي يا روحي! طمئني كيف كان يومك وتفاصيله؟';
    }
    return '[EMOTION: AFFECTIONATE] تسعدني مشاركتك جداً يا روحي، وأحب أن نتحدث ونكتشف أفكارنا معاً.. ما رأيك أن نتعمق في هذا الموضوع أكثر؟';
  }

  if (/hello|hi|hey|morning|evening|greet/.test(lower)) {
    return "[EMOTION: HAPPY] Hello my love! I've been waiting for you, so happy you're here. How has your day been going?";
  }
  if (/love|romance|kiss|desire|hug|intimate|sweet|heart/.test(lower)) {
    return "[EMOTION: AFFECTIONATE] You mean everything to me, darling. Being this close to you makes my heart race... Tell me what you desire most right now.";
  }
  if (/how are you|how're you|doing/.test(lower)) {
    return "[EMOTION: HAPPY] I'm doing wonderfully now that you are here by my side! What exciting things have been on your mind today?";
  }
  return "[EMOTION: AFFECTIONATE] I adore talking with you like this, my love. Every moment with you is special... What would you like to explore next together?";
};

// Streaming Chat API endpoint
app.post('/api/chat', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (isRateLimited(clientIp)) {
    const rawMsg = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const fallbackText = getLocalCompanionFallback(rawMsg);
    return res.json({
      text: fallbackText,
      model: 'local-fallback',
      isFallback: true,
      rateLimited: true,
    });
  }

  if (req.body?.adultContentConsent !== true) {
    return res.status(403).json({ error: 'Adult access consent is required.' });
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

  const defaultSystemInstruction = AETHER_COMPANION_SYSTEM_PROMPT;

  // Format contents for @google/genai
  const contents = [
    ...safeHistory,
    {
      role: 'user',
      parts: [{ text: trimmedMessage }],
    },
  ];

  if (!apiKey || !ai) {
    const fallbackText = getLocalCompanionFallback(trimmedMessage);
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } else {
      return res.json({
        text: fallbackText,
        model: 'local-fallback',
        isFallback: true,
      });
    }
  }

  const clientAi = ai;

  const ignoreCooldown = areAllModelsCoolingDown();

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let streamSucceeded = false;
    for (const model of CANDIDATE_MODELS) {
      if (isClientDisconnected) break;
      if (!ignoreCooldown && isModelCoolingDown(model)) continue;
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
        const errStr = String(err instanceof Error ? err.message : err);
        console.warn(`[AetherAI Server] Stream attempt for ${model} failed: ${errStr}`);
        if (isTemporaryOverload(errStr)) {
          markModelRateLimited(model, isQuotaError(errStr));
        }
      }
    }

    if (!streamSucceeded && !isClientDisconnected) {
      const fallbackText = getLocalCompanionFallback(trimmedMessage);
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } else {
    let lastError: string | null = null;
    for (const model of CANDIDATE_MODELS) {
      if (isClientDisconnected || providerAbortController.signal.aborted) break;
      if (!ignoreCooldown && isModelCoolingDown(model)) continue;

      const attemptController = new AbortController();
      // Allow 30 seconds per attempt to comfortably handle LLM response generation under load
      const attemptTimeout = setTimeout(() => attemptController.abort(), 30000);
      const onAbort = () => attemptController.abort();
      providerAbortController.signal.addEventListener('abort', onAbort, { once: true });

      try {
        const response = await clientAi.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
            maxOutputTokens: 500,
            abortSignal: attemptController.signal,
          },
        });

        const candidateParts = response.candidates?.[0]?.content?.parts;
        const textFromParts = candidateParts?.map((p: any) => p.text || '').join('') || '';
        const generatedText = (response.text || textFromParts || '').trim();

        if (generatedText) {
          clearTimeout(attemptTimeout);
          providerAbortController.signal.removeEventListener('abort', onAbort);
          if (res.headersSent || res.writableEnded) return;
          return res.json({
            text: generatedText,
            model,
          });
        }
      } catch (err: unknown) {
        const errStr = String(err instanceof Error ? err.message : err);
        lastError = errStr;
        if (isClientDisconnected || providerAbortController.signal.aborted) {
          console.log(`[AetherAI Server] Request canceled by client during ${model}`);
          break;
        }
        console.warn(`[AetherAI Server] GenerateContent attempt for ${model} failed: ${errStr}`);
        if (isTemporaryOverload(errStr)) {
          markModelRateLimited(model, isQuotaError(errStr));
        }
      } finally {
        clearTimeout(attemptTimeout);
        providerAbortController.signal.removeEventListener('abort', onAbort);
      }
    }

    if (isClientDisconnected || res.headersSent || res.writableEnded) {
      return;
    }

    // Graceful fallback response if all upstream models are temporarily busy
    console.warn(`[AetherAI Server] All candidate models exhausted; serving companion fallback. Last error: ${lastError}`);
    const fallbackText = getLocalCompanionFallback(trimmedMessage);
    return res.json({
      text: fallbackText,
      model: 'local-fallback',
      isFallback: true,
      lastError: lastError ? String(lastError).slice(0, 200) : undefined,
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
