export type CompanionTtsVoice = 'Achernar' | 'Kore';
export type TtsFailureReason = 'not-configured' | 'timeout' | 'network' | 'invalid-audio' | 'unavailable';

const CANDIDATE_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
];
const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_LENGTH = 4_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 45;
const UPSTREAM_TIMEOUT_MS = 45_000;

const SUPPORTED_VOICES = new Set<CompanionTtsVoice>(['Achernar', 'Kore']);
const SUPPORTED_EMOTIONS = new Set([
  'NEUTRAL', 'HAPPY', 'SAD', 'ANGRY', 'SURPRISED', 'CONFUSED', 'THINKING',
  'CURIOUS', 'EMPATHETIC', 'AFFECTIONATE', 'GENTLY_ANNOYED',
]);

const recentRequestsByIp = new Map<string, number[]>();

const speechStyleByEmotion: Record<string, string> = {
  NEUTRAL: 'Consistently soft, warm, calm, and clear; unhurried and conversational, without theatrical emphasis.',
  HAPPY: 'Softly cheerful and gentle; keep the same quiet warmth and avoid bright or exaggerated acting.',
  SAD: 'Very soft and tender, with a quiet caring tone; natural and not melodramatic.',
  ANGRY: 'Soft but subtly firm and respectful; never become loud, harsh, or threatening.',
  SURPRISED: 'Softly surprised and natural, with only a subtle lift in intonation.',
  CONFUSED: 'Soft, gentle, and thoughtful, with a slight questioning inflection.',
  THINKING: 'Soft, measured, and reflective, with a calm natural pace.',
  CURIOUS: 'Softly curious and engaged, with light conversational intonation.',
  EMPATHETIC: 'Soft, tender, patient, and reassuring; sincere without sounding dramatic.',
  AFFECTIONATE: 'Soft, warm, affectionate, and calm; intimate in a fictional roleplay sense but never exaggerated.',
  GENTLY_ANNOYED: 'Softly pouty and playfully frustrated, still kind and affectionate, never harsh.',
};

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

  if (recentRequestsByIp.size > 5_000) {
    for (const [ip, timestamps] of recentRequestsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)) {
        recentRequestsByIp.delete(ip);
      }
    }
  }
  return false;
}

function decodeBase64Audio(encoded: string): Uint8Array | null {
  try {
    const binary = atob(encoded);
    if (!binary || binary.length > 12 * 1024 * 1024) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function findAudioData(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const payload = result as {
    output_audio?: { data?: unknown };
    steps?: Array<{ type?: unknown; content?: Array<{ type?: unknown; data?: unknown }> }>;
  };
  if (typeof payload.output_audio?.data === 'string') return payload.output_audio.data;
  const parts = (payload.steps || [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => Array.isArray(step.content) ? step.content : []);
  const audioPart = [...parts].reverse().find((part) => part.type === 'audio' && typeof part.data === 'string');
  return typeof audioPart?.data === 'string' ? audioPart.data : '';
}

function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 44
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
}

/** Server-only Gemini TTS proxy; the provider key is never returned to the caller. */
export async function handleGeminiTtsRequest(
  request: Request,
  apiKey: string | undefined,
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

  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) return jsonResponse({ error: 'Speech text is required.' }, 400);
  if (text.length > MAX_TEXT_LENGTH) return jsonResponse({ error: 'Speech text exceeds the 4,000-character limit.' }, 400);

  const requestedVoice = payload.voice;
  const voice: CompanionTtsVoice = typeof requestedVoice === 'string'
    && SUPPORTED_VOICES.has(requestedVoice as CompanionTtsVoice)
    ? requestedVoice as CompanionTtsVoice
    : 'Kore';

  const requestedEmotion = typeof payload.emotion === 'string' && SUPPORTED_EMOTIONS.has(payload.emotion)
    ? payload.emotion
    : 'NEUTRAL';

  if (!apiKey?.trim()) return jsonResponse({ error: 'Speech service is not configured on the server.' }, 503);

  const clientIp = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Client-IP')
    || 'unknown';

  if (isRateLimited(clientIp)) return jsonResponse({ error: 'Speech service is busy. Please try again shortly.' }, 429);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const candidateTtsModels = CANDIDATE_TTS_MODELS;
    let audio: Uint8Array | null = null;
    let lastStatus = 502;

    for (const model of candidateTtsModels) {
      if (controller.signal.aborted) break;
      try {
        const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            model,
            store: false,
            input: [{
              type: 'user_input',
              content: [{
                type: 'text',
                text,
                annotations: [{
                  type: 'speech_metadata',
                  style: speechStyleByEmotion[requestedEmotion],
                }],
              }],
            }],
            response_format: { type: 'audio' },
            generation_config: { speech_config: [{ voice }] },
          }),
          signal: controller.signal,
        });

        lastStatus = upstream.status;
        if (!upstream.ok) {
          console.warn(`[AetherAI TTS] Model ${model} returned status ${upstream.status}`);
          continue;
        }

        const result: unknown = await upstream.json();
        const encoded = findAudioData(result);
        const decoded = encoded ? decodeBase64Audio(encoded) : null;
        if (decoded && isWav(decoded)) {
          audio = decoded;
          break;
        }
      } catch (err: unknown) {
        console.warn(`[AetherAI TTS] Model ${model} attempt threw:`, err);
      }
    }

    if (!audio) {
      return jsonResponse(
        { error: lastStatus === 429 ? 'Speech service is busy. Please try again shortly.' : 'Speech service is temporarily unavailable.' },
        lastStatus === 429 ? 429 : 502,
      );
    }

    return new Response(audio.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return jsonResponse(
      { error: timedOut ? 'Speech generation timed out.' : 'Speech service is temporarily unavailable.' },
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
