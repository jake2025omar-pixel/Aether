import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { KokoroTTS } from 'kokoro-js';

const CACHE_DIR = path.resolve(process.cwd(), '.cache/kokoro_tts');
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch {
  // Ignore cache directory creation errors
}

function getCacheFilePath(key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return path.join(CACHE_DIR, `${hash}.wav`);
}

const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_LENGTH = 4_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;

// Ensure voices symlink exists in execution paths
try {
  const localVoicesDir = path.resolve(process.cwd(), 'node_modules/kokoro-js/voices');
  if (fs.existsSync(localVoicesDir)) {
    if (!fs.existsSync('/app/voices')) {
      try { fs.symlinkSync(localVoicesDir, '/app/voices'); } catch { /* ignore */ }
    }
    const appletVoices = path.resolve(process.cwd(), 'voices');
    if (!fs.existsSync(appletVoices)) {
      try { fs.symlinkSync(localVoicesDir, appletVoices); } catch { /* ignore */ }
    }
  }
} catch {
  // Ignore symlink errors
}

let kokoroInstancePromise: Promise<KokoroTTS> | null = null;

async function getKokoroTTS(): Promise<KokoroTTS> {
  if (!kokoroInstancePromise) {
    kokoroInstancePromise = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
  }
  return kokoroInstancePromise;
}

const ttsAudioCache = new Map<string, Uint8Array>();

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

function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 44
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
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

/**
 * Kokoro-82M Local Neural TTS Handler
 * Truly free, 100% unrestricted, running offline on-device without external API limits.
 */
export async function handleKokoroTtsRequest(
  request: Request,
): Promise<Response> {
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

  // Map requested voice (defaulting to af_kore matching Kore timbre)
  let requestedVoice = typeof payload.voice === 'string' ? payload.voice.trim() : '';
  if (requestedVoice === 'Kore' || requestedVoice === 'kore') {
    requestedVoice = 'af_kore';
  }
  const voice = SUPPORTED_KOKORO_VOICES.has(requestedVoice) ? requestedVoice : 'af_kore';

  const cacheKey = `${voice}_${text.trim()}`;
  let cachedAudio = ttsAudioCache.get(cacheKey);

  if (!cachedAudio) {
    const diskPath = getCacheFilePath(cacheKey);
    try {
      if (fs.existsSync(diskPath)) {
        const fileBuf = fs.readFileSync(diskPath);
        if (fileBuf.length > 44 && isWav(new Uint8Array(fileBuf))) {
          cachedAudio = new Uint8Array(fileBuf);
          ttsAudioCache.set(cacheKey, cachedAudio);
        }
      }
    } catch {
      // Ignore disk read error and fallback to generation
    }
  }

  if (cachedAudio && isWav(cachedAudio)) {
    return new Response(new Uint8Array(cachedAudio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(cachedAudio.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  try {
    const tts = await getKokoroTTS();
    const rawAudio = await tts.generate(text, {
      voice,
      speed: 1.0,
    });

    const wavArrayBuffer = rawAudio.toWav();
    const bytes = new Uint8Array(wavArrayBuffer);

    if (!isWav(bytes)) {
      return jsonResponse({ error: 'Generated audio format invalid.' }, 502);
    }

    ttsAudioCache.set(cacheKey, bytes);
    try {
      fs.promises.writeFile(getCacheFilePath(cacheKey), bytes).catch(() => undefined);
    } catch {
      // Ignore disk write errors
    }

    if (ttsAudioCache.size > 200) {
      const oldestKey = ttsAudioCache.keys().next().value;
      if (oldestKey) ttsAudioCache.delete(oldestKey);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: unknown) {
    console.error('[Kokoro TTS Error]:', err);
    return jsonResponse(
      { error: 'Local Kokoro neural speech synthesis failed.' },
      502,
    );
  }
}
