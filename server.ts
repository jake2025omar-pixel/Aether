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

  // Model selection: 'gemini-2.5-flash' as standard Flash model for text/multimodal tasks
  const primaryModel = 'gemini-2.5-flash';
  const fallbackModel = 'gemini-flash-latest';

  const defaultSystemInstruction =
    systemInstruction ||
    `You are Aether AI, a friendly, ultra-fast and helpful AI assistant powered by Gemini Flash.
You communicate fluently in Arabic and English. If the user writes in Arabic, respond in clear, natural Arabic. If in English, respond in English.
Provide concise, accurate, and practical answers. Use clean formatting and code blocks when appropriate.`;

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

    try {
      let responseStream;
      try {
        responseStream = await clientAi.models.generateContentStream({
          model: primaryModel,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });
      } catch {
        responseStream = await clientAi.models.generateContentStream({
          model: fallbackModel,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });
      }

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: unknown) {
      console.error('Gemini Stream Error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown generation error';
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    }
  } else {
    try {
      let response;
      try {
        response = await clientAi.models.generateContent({
          model: primaryModel,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });
      } catch {
        response = await clientAi.models.generateContent({
          model: fallbackModel,
          contents,
          config: {
            systemInstruction: defaultSystemInstruction,
            temperature: 0.7,
          },
        });
      }

      return res.json({
        text: response.text || '',
        model: primaryModel,
      });
    } catch (err: unknown) {
      console.error('Gemini Generate Error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to generate response';
      return res.status(500).json({ error: errMsg });
    }
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
