import { handleGeminiTtsRequest } from './geminiTts';
import { handleKokoroTtsRequest } from './kokoroTts';

export interface TtsBackends {
  kokoro: (request: Request) => Promise<Response>;
  gemini: (request: Request, apiKey: string | undefined) => Promise<Response>;
}

const defaultBackends: TtsBackends = {
  kokoro: handleKokoroTtsRequest,
  gemini: handleGeminiTtsRequest,
};

function asPayload(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function makeBackendRequest(payload: Record<string, unknown>, clientIp: string): Request {
  return new Request('http://aether.local/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-IP': clientIp || 'unknown',
    },
    body: JSON.stringify(payload),
  });
}

function addProviderHeader(response: Response, provider: 'kokoro' | 'gemini-achernar'): Response {
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Aether-TTS-Provider', provider);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unavailableResponse(): Response {
  return new Response(JSON.stringify({ error: 'Speech service is temporarily unavailable.' }), {
    status: 502,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function consentRequiredResponse(): Response {
  return new Response(JSON.stringify({ error: 'Adult access consent is required.' }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function containsArabic(text: unknown): boolean {
  return typeof text === 'string' && /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(text);
}

async function callGeminiAchernar(
  payload: Record<string, unknown>,
  clientIp: string,
  apiKey: string | undefined,
  backend: TtsBackends['gemini'],
): Promise<Response> {
  try {
    const fallback = await backend(
      makeBackendRequest({ ...payload, voice: 'Achernar' }, clientIp),
      apiKey,
    );
    return addProviderHeader(fallback, 'gemini-achernar');
  } catch {
    return unavailableResponse();
  }
}

/** Kokoro is primary for compatible text. Arabic and Kokoro server failures use fixed Achernar. */
export async function handleTtsWithFallback(
  payloadValue: unknown,
  clientIp: string,
  geminiApiKey: string | undefined,
  backends: TtsBackends = defaultBackends,
): Promise<Response> {
  const payload = asPayload(payloadValue);
  if (payload.adultContentConsent !== true) return consentRequiredResponse();

  // Real output tests show Kokoro's default English voice spells Arabic characters rather than speaking Arabic.
  // Treat that capability mismatch as a primary-engine failure instead of returning misleading audio.
  if (containsArabic(payload.text)) {
    return callGeminiAchernar(payload, clientIp, geminiApiKey, backends.gemini);
  }

  let primary: Response;
  try {
    primary = await backends.kokoro(makeBackendRequest(payload, clientIp));
  } catch {
    primary = unavailableResponse();
  }

  // Do not route caller errors, consent denials, validation errors, or rate limits to another provider.
  if (primary.status < 500) return addProviderHeader(primary, 'kokoro');

  return callGeminiAchernar(payload, clientIp, geminiApiKey, backends.gemini);
}
