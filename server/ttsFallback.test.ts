import assert from 'node:assert/strict';
import { handleTtsWithFallback, type TtsBackends } from './ttsFallback';

const payload = { text: 'Hello, this is a short test.', adultContentConsent: true, voice: 'af_kore', emotion: 'AFFECTIONATE' };
const arabicPayload = { ...payload, text: 'مرحباً، هل تسمعني؟' };
const audioResponse = () => new Response(new Uint8Array([1, 2, 3]), {
  status: 200,
  headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
});

async function requestPayload(request: Request): Promise<Record<string, unknown>> {
  return await request.json() as Record<string, unknown>;
}

async function run(): Promise<void> {
  {
    let geminiCalls = 0;
    const backends: TtsBackends = {
      kokoro: async () => audioResponse(),
      gemini: async () => { geminiCalls += 1; return audioResponse(); },
    };
    const result = await handleTtsWithFallback(payload, '203.0.113.10', undefined, backends);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'kokoro');
    assert.equal(geminiCalls, 0, 'Gemini must not be called when Kokoro succeeds.');
  }

  {
    let kokoroCalls = 0;
    const captured: { payload?: Record<string, unknown> } = {};
    const backends: TtsBackends = {
      kokoro: async () => { kokoroCalls += 1; return audioResponse(); },
      gemini: async (request) => {
        captured.payload = await requestPayload(request);
        return audioResponse();
      },
    };
    const result = await handleTtsWithFallback(arabicPayload, '203.0.113.12', 'server-only-test-key', backends);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'gemini-achernar');
    assert.equal(kokoroCalls, 0, 'Known unsupported Arabic must not be returned from Kokoro.');
    assert.equal(captured.payload?.voice, 'Achernar');
    assert.equal(captured.payload?.text, arabicPayload.text);
  }

  {
    const captured: { payload?: Record<string, unknown>; ip: string; key?: string } = { ip: '' };
    const backends: TtsBackends = {
      kokoro: async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 502 }),
      gemini: async (request, key) => {
        captured.payload = await requestPayload(request);
        captured.ip = request.headers.get('X-Client-IP') || '';
        captured.key = key;
        return audioResponse();
      },
    };
    const result = await handleTtsWithFallback(payload, '203.0.113.11', 'server-only-test-key', backends);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'gemini-achernar');
    assert.equal(captured.payload?.voice, 'Achernar');
    assert.equal(captured.payload?.adultContentConsent, true);
    assert.equal(captured.payload?.text, payload.text);
    assert.equal(captured.ip, '203.0.113.11');
    assert.equal(captured.key, 'server-only-test-key');
  }

  {
    let kokoroCalls = 0;
    let geminiCalls = 0;
    const backends: TtsBackends = {
      kokoro: async () => { kokoroCalls += 1; return new Response('unexpected', { status: 200 }); },
      gemini: async () => { geminiCalls += 1; return audioResponse(); },
    };
    const result = await handleTtsWithFallback({ ...arabicPayload, adultContentConsent: false }, 'unknown', undefined, backends);
    assert.equal(result.status, 403);
    assert.equal(kokoroCalls, 0);
    assert.equal(geminiCalls, 0, 'A consent denial must never trigger a second provider.');
  }

  {
    let geminiCalls = 0;
    const backends: TtsBackends = {
      kokoro: async () => new Response('busy', { status: 429 }),
      gemini: async () => { geminiCalls += 1; return audioResponse(); },
    };
    const result = await handleTtsWithFallback(payload, 'unknown', undefined, backends);
    assert.equal(result.status, 429);
    assert.equal(geminiCalls, 0, 'Rate limiting must not bypass limits through Gemini.');
  }

  {
    const backends: TtsBackends = {
      kokoro: async () => new Response('failed', { status: 502 }),
      gemini: async () => new Response(JSON.stringify({ error: 'unconfigured' }), { status: 503 }),
    };
    const result = await handleTtsWithFallback(payload, 'unknown', undefined, backends);
    assert.equal(result.status, 503, 'A fallback failure should remain a clear server-side error.');
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), null);
  }

  {
    let geminiCalls = 0;
    const backends: TtsBackends = {
      kokoro: async () => { throw new Error('private internal detail'); },
      gemini: async () => { geminiCalls += 1; return audioResponse(); },
    };
    const result = await handleTtsWithFallback(payload, 'unknown', undefined, backends);
    assert.equal(result.status, 200);
    assert.equal(geminiCalls, 1, 'An unexpected Kokoro exception should still reach the fallback.');
  }

  console.log('[PASS] Kokoro-first TTS fallback tests passed.');
}

run().catch((error: unknown) => {
  console.error('[FAIL] TTS fallback tests failed:', error);
  process.exit(1);
});
