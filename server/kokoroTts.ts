import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { KokoroTTS } from 'kokoro-js';
import { inspectWav } from '../src/lib/audio/wav';

const CACHE_DIR = path.resolve(process.cwd(), '.cache/kokoro_tts');
try {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  // Disk cache is an optional optimization; synthesis must still work without it.
}

function getCacheFilePath(key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(CACHE_DIR, `${hash}.wav`);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isPlayableWav(bytes: Uint8Array): boolean {
  return inspectWav(asArrayBuffer(bytes)) !== null;
}

const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_LENGTH = 4_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const MAX_MEMORY_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_QUEUED_GENERATIONS = 8;

// Ensure voices symlink exists in execution paths.
try {
  const localVoicesDir = path.resolve(process.cwd(), 'node_modules/kokoro-js/voices');
  if (fs.existsSync(localVoicesDir)) {
    if (!fs.existsSync('/app/voices')) {
      try { fs.symlinkSync(localVoicesDir, '/app/voices'); } catch { /* optional */ }
    }
    const appletVoices = path.resolve(process.cwd(), 'voices');
    if (!fs.existsSync(appletVoices)) {
      try { fs.symlinkSync(localVoicesDir, appletVoices); } catch { /* optional */ }
    }
  }
} catch {
  // Ignore optional symlink errors.
}

let kokoroInstancePromise: Promise<KokoroTTS> | null = null;

async function getKokoroTTS(): Promise<KokoroTTS> {
  if (!kokoroInstancePromise) {
    const pending = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
    kokoroInstancePromise = pending;
    try {
      return await pending;
    } catch (error) {
      if (kokoroInstancePromise === pending) kokoroInstancePromise = null;
      throw error;
    }
  }
  return kokoroInstancePromise;
}

const recentRequestsByIp = new Map<string, number[]>();
const ttsAudioCache = new Map<string, Uint8Array>();
const inFlightAudio = new Map<string, Promise<Uint8Array>>();
let memoryCacheBytes = 0;
let generationActive = false;
const generationWaiters: Array<() => void> = [];

class GenerationQueueFullError extends Error {}

async function acquireGenerationSlot(): Promise<() => void> {
  if (!generationActive) {
    generationActive = true;
  } else {
    if (generationWaiters.length >= MAX_QUEUED_GENERATIONS) throw new GenerationQueueFullError();
    await new Promise<void>((resolve) => generationWaiters.push(resolve));
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = generationWaiters.shift();
    if (next) next();
    else generationActive = false;
  };
}

function setMemoryCache(key: string, bytes: Uint8Array): void {
  const previous = ttsAudioCache.get(key);
  if (previous) memoryCacheBytes -= previous.byteLength;
  ttsAudioCache.delete(key);

  if (bytes.byteLength > MAX_MEMORY_CACHE_BYTES) return;
  const ownedBytes = new Uint8Array(bytes);
  ttsAudioCache.set(key, ownedBytes);
  memoryCacheBytes += ownedBytes.byteLength;

  while (memoryCacheBytes > MAX_MEMORY_CACHE_BYTES) {
    const oldest = ttsAudioCache.keys().next().value;
    if (!oldest) break;
    const evicted = ttsAudioCache.get(oldest);
    if (evicted) memoryCacheBytes -= evicted.byteLength;
    ttsAudioCache.delete(oldest);
  }
}

function getMemoryCache(key: string): Uint8Array | undefined {
  const bytes = ttsAudioCache.get(key);
  if (!bytes) return undefined;
  ttsAudioCache.delete(key);
  ttsAudioCache.set(key, bytes);
  return bytes;
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

  if (recentRequestsByIp.size > 5_000) {
    for (const [ip, timestamps] of recentRequestsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)) {
        recentRequestsByIp.delete(ip);
      }
    }
  }
  return false;
}

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

const SUPPORTED_KOKORO_VOICES = new Set([
  'af_kore',
  'af_heart',
  'af_bella',
  'af_nicole',
  'af_sarah',
  'af_aoede',
  'af_sky',
]);

async function generateAudio(cacheKey: string, text: string, voice: string): Promise<Uint8Array> {
  const existing = inFlightAudio.get(cacheKey);
  if (existing) return existing;

  const task = (async () => {
    const release = await acquireGenerationSlot();
    try {
      const tts = await getKokoroTTS();
      const rawAudio = await tts.generate(text, { voice: voice as any, speed: 1.0 });
      const bytes = new Uint8Array(rawAudio.toWav());
      if (!isPlayableWav(bytes)) throw new Error('Generated WAV failed structural validation.');

      setMemoryCache(cacheKey, bytes);
      try {
        fs.promises.writeFile(getCacheFilePath(cacheKey), bytes).catch(() => undefined);
      } catch {
        // Disk cache is optional.
      }
      return bytes;
    } finally {
      release();
    }
  })();

  inFlightAudio.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (inFlightAudio.get(cacheKey) === task) inFlightAudio.delete(cacheKey);
  }
}

/** Kokoro-82M local TTS handler. Gemini is invoked by the server-level fallback only on 5xx. */
export async function handleKokoroTtsRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) return jsonResponse({ error: 'Request body is too large.' }, 413);

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

  if (payload.adultContentConsent !== true) {
    return jsonResponse({ error: 'Adult access consent is required.' }, 403);
  }

  const rawText = typeof payload.text === 'string' ? payload.text.trim() : '';
  const text = rawText
    .replace(/^\s*(?:repeat\s*exactly|exactly|draft\s*\d*|response)[\s:]*/i, '')
    .replace(/\[EMOTION:\s*[A-Z_]+\]/gi, '')
    .replace(/[*_#`~\[\]]/g, '')
    .trim();

  if (!text) return jsonResponse({ error: 'Speech text is required.' }, 400);
  if (text.length > MAX_TEXT_LENGTH) return jsonResponse({ error: 'Speech text exceeds character limit.' }, 400);

  let requestedVoice = typeof payload.voice === 'string' ? payload.voice.trim() : '';
  if (requestedVoice === 'Kore' || requestedVoice === 'kore') requestedVoice = 'af_kore';
  const voice = SUPPORTED_KOKORO_VOICES.has(requestedVoice) ? requestedVoice : 'af_kore';
  const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Client-IP') || 'unknown';
  if (isRateLimited(clientIp)) {
    return jsonResponse({ error: 'Speech service is busy. Please try again shortly.' }, 429);
  }

  const cacheKey = `${voice}_${text}`;
  let cachedAudio = getMemoryCache(cacheKey);

  if (!cachedAudio) {
    const diskPath = getCacheFilePath(cacheKey);
    try {
      if (fs.existsSync(diskPath)) {
        const fileBytes = new Uint8Array(fs.readFileSync(diskPath));
        if (isPlayableWav(fileBytes)) {
          cachedAudio = fileBytes;
          setMemoryCache(cacheKey, fileBytes);
        }
      }
    } catch {
      // Ignore cache read errors and synthesize again.
    }
  }

  if (cachedAudio && isPlayableWav(cachedAudio)) {
    return new Response(new Uint8Array(cachedAudio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(cachedAudio.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Aether-TTS-Provider': 'kokoro',
      },
    });
  }

  try {
    const bytes = await generateAudio(cacheKey, text, voice);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Aether-TTS-Provider': 'kokoro',
      },
    });
  } catch (error: unknown) {
    if (error instanceof GenerationQueueFullError) {
      return jsonResponse({ error: 'Speech service is busy. Please try again shortly.' }, 429);
    }
    console.error('[Kokoro TTS] Local synthesis failed:', error instanceof Error ? error.name : 'UnknownError');
    return jsonResponse({ error: 'Local speech synthesis is temporarily unavailable.' }, 502);
  }
}
