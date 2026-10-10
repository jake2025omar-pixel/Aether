import { AETHER_COMPANION_SYSTEM_PROMPT } from '../../src/lib/companionPersonality';

interface FunctionEnv {
  GEMINI_API_KEY?: string;
}

interface FunctionContext {
  request: Request;
  env: FunctionEnv;
}

type FunctionHandler = (context: FunctionContext) => Response | Promise<Response>;

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 35;
const recentRequestsByIp = new Map<string, number[]>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const recent = (recentRequestsByIp.get(clientIp) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentRequestsByIp.set(clientIp, recent);
    return true;
  }

  recent.push(now);
  recentRequestsByIp.set(clientIp, recent);

  // Avoid retaining inactive client keys indefinitely in a long-lived isolate.
  if (recentRequestsByIp.size > 5_000) {
    for (const [ip, timestamps] of recentRequestsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)) {
        recentRequestsByIp.delete(ip);
      }
    }
  }
  return false;
}

function asText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

export const onRequestPost: FunctionHandler = async ({ request, env }) => {
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(clientIp)) {
    return jsonResponse({ error: 'Too many requests. Please wait a moment before sending another message.' }, 429);
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Request body is too large.' }, 413);
  }

  let payload: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Request body is too large.' }, 413);
    }
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
  }

  const message = asText(payload.message, 2_001).trim();
  if (!message) {
    return jsonResponse({ error: 'Message is required and must be a non-empty string.' }, 400);
  }
  if (message.length > 2_000) {
    return jsonResponse({ error: 'Message exceeds the 2,000-character limit.' }, 400);
  }

  const historyInput = Array.isArray(payload.history) ? payload.history : [];
  const contents = historyInput
    .slice(-12)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: asText(item.text, 1_200) }],
    }))
    .filter((item) => item.parts[0].text.length > 0);
  contents.push({ role: 'user', parts: [{ text: message }] });

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'Gemini API key is not configured on the server.' }, 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: AETHER_COMPANION_SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
        signal: controller.signal,
      },
    );

    if (!upstream.ok) {
      console.error(`Gemini upstream returned HTTP ${upstream.status}.`);
      return jsonResponse(
        { error: upstream.status === 429 ? 'The AI service is busy right now.' : 'The AI service is temporarily unavailable.' },
        upstream.status === 429 ? 429 : 502,
      );
    }

    const result = await upstream.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
    };
    const text = result.candidates?.[0]?.content?.parts
      ?.map((part) => typeof part.text === 'string' ? part.text : '')
      .join('')
      .trim();

    if (!text) {
      return jsonResponse({ error: 'The AI service returned an empty response.' }, 502);
    }
    return jsonResponse({ text, model: GEMINI_MODEL });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error(`Gemini request failed${timedOut ? ' (timeout)' : ''}.`);
    return jsonResponse({ error: timedOut ? 'The AI request timed out.' : 'The AI service is temporarily unavailable.' }, timedOut ? 504 : 502);
  } finally {
    clearTimeout(timeoutId);
  }
};
