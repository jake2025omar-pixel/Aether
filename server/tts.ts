import { handleKokoroTtsRequest } from './kokoroTts';

export type KokoroTtsBackend = (request: Request) => Promise<Response>;

function asPayload(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** There is deliberately one speech engine and one fixed voice: local Kokoro af_kore. */
export async function handleKokoroOnlyTts(
  payloadValue: unknown,
  clientIp: string,
  backend: KokoroTtsBackend = handleKokoroTtsRequest,
): Promise<Response> {
  const payload = asPayload(payloadValue);
  if (payload.adultContentConsent !== true) {
    return jsonResponse({ error: 'Adult access consent is required.' }, 403);
  }

  let response: Response;
  try {
    response = await backend(new Request('http://aether.local/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-IP': clientIp || 'unknown',
      },
      // Ignore any client voice selection; the server owns the single Kokoro voice.
      body: JSON.stringify({ ...payload, voice: 'af_kore' }),
    }));
  } catch {
    return jsonResponse({ error: 'Kokoro speech synthesis is temporarily unavailable.' }, 502);
  }

  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.set('X-Aether-TTS-Provider', 'kokoro');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
