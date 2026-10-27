import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type AzureTtsVoice = 'ar-EG-SalmaNeural' | 'en-US-JennyNeural';
export type TtsFailureReason = 'not-configured' | 'timeout' | 'network' | 'invalid-audio' | 'unavailable';

const CACHE_DIR = path.resolve(process.cwd(), '.cache/azure_tts');
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
const UPSTREAM_TIMEOUT_MS = 25_000;

const SUPPORTED_AZURE_VOICES = new Set<string>([
  'ar-EG-SalmaNeural',
  'en-US-JennyNeural',
]);

const recentRequestsByIp = new Map<string, number[]>();
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

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 44
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
}

/**
 * Microsoft Azure Cognitive Services Speech REST API Proxy
 * Strictly uses ar-EG-SalmaNeural (Arabic) and en-US-JennyNeural (English).
 */
export async function handleAzureTtsRequest(
  request: Request,
  azureKey: string | undefined,
  azureRegion: string | undefined,
  upstreamTimeoutMs = UPSTREAM_TIMEOUT_MS,
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

  // Determine requested voice (strictly ar-EG-SalmaNeural or en-US-JennyNeural)
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const requestedVoice = typeof payload.voice === 'string' ? payload.voice : '';
  const voice = SUPPORTED_AZURE_VOICES.has(requestedVoice)
    ? requestedVoice
    : (isArabic ? 'ar-EG-SalmaNeural' : 'en-US-JennyNeural');

  // Verify Azure credentials existence
  if (!azureKey?.trim() || !azureRegion?.trim()) {
    return jsonResponse({
      error: 'Microsoft Azure Speech credentials are not configured. AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required in environment configuration.',
      configured: false,
      voice,
    }, 503);
  }

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
      // Ignore disk read error and fallback to upstream
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

  const lang = voice.startsWith('ar-') ? 'ar-EG' : 'en-US';
  const escapedText = escapeXml(text);
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>
  <voice name='${voice}'>
    ${escapedText}
  </voice>
</speak>`;

  const azureEndpoint = `https://${azureRegion.trim()}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const upstreamRes = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey.trim(),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'AetherAI-Companion',
      },
      body: ssml,
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => '');
      console.warn(`[Azure TTS] Request failed (${upstreamRes.status}):`, errText.slice(0, 200));
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        return jsonResponse({ error: 'Azure Speech authentication failed. Verify AZURE_SPEECH_KEY and region.' }, 503);
      }
      if (upstreamRes.status === 429) {
        return jsonResponse({ error: 'Azure Speech rate limit reached. Please wait a moment.' }, 429);
      }
      return jsonResponse({ error: `Azure Speech synthesis failed (${upstreamRes.status}).` }, 502);
    }

    const audioBuf = await upstreamRes.arrayBuffer();
    const bytes = new Uint8Array(audioBuf);
    if (!isWav(bytes)) {
      return jsonResponse({ error: 'Azure returned invalid audio format.' }, 502);
    }

    ttsAudioCache.set(cacheKey, bytes);
    try {
      fs.promises.writeFile(getCacheFilePath(cacheKey), bytes).catch(() => undefined);
    } catch {
      // Ignore disk write errors
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
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return jsonResponse(
      { error: timedOut ? 'Azure Speech generation timed out.' : 'Azure Speech connection error.' },
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
