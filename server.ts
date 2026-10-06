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

app.use(express.json());

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
  const { message, history = [], systemInstruction, stream = true } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string.' });
  }

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
    ...history.map((item: { role: string; text: string }) => ({
      role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
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
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        streamSucceeded = true;
        break;
      } catch (err: unknown) {
        console.warn(`Model ${model} streaming attempt failed:`, err instanceof Error ? err.message : err);
      }
    }

    if (!streamSucceeded) {
      const fallbackText = getLocalCompanionFallback(message);
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } else {
    for (const model of CANDIDATE_MODELS) {
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
