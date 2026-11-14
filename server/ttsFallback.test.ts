import assert from 'node:assert/strict';
import { handleTtsWithFallback, type TtsBackends } from './ttsFallback';

const payload = { text: 'Hello, this is a short test.', adultContentConsent: true, voice: 'af_heart', emotion: 'AFFECTIONATE' };
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
    let captured: Record<string, unknown> | undefined;
    let geminiCalls = 0;
    const backends: TtsBackends = {
      kokoro: async (request) => { captured = await requestPayload(request); return audioResponse(); },
      gemini: async () => { geminiCalls += 1; return audioResponse(); },
    };
    const result = await handleTtsWithFallback(payload, '203.0.113.10', 'unused-key', backends);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'kokoro');
    assert.equal(captured?.voice, 'af_heart');
    assert.equal(geminiCalls, 0);
  }

  {
    let captured: Record<string, unknown> | undefined;
    let kokoroCalls = 0;
    const backends: TtsBackends = {
      kokoro: async () => { kokoroCalls += 1; return audioResponse(); },
      gemini: async (request) => { captured = await requestPayload(request); return audioResponse(); },
    };
    const result = await handleTtsWithFallback(arabicPayload, '203.0.113.12', 'unused-key', backends);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'gemini-achernar');
    assert.equal(captured?.voice, 'Achernar');
    assert.equal(captured?.text, arabicPayload.text);
    assert.equal(kokoroCalls, 0);
  }

  {
    let calls = 0;
    const result = await handleTtsWithFallback(
      { ...arabicPayload, adultContentConsent: false },
      'unknown',
      undefined,
      {
        kokoro: async () => { calls += 1; return audioResponse(); },
        gemini: async () => { calls += 1; return audioResponse(); },
      },
    );
    assert.equal(result.status, 403);
    assert.equal(calls, 0);
  }

  {
    const result = await handleTtsWithFallback(
      payload,
      'unknown',
      undefined,
      {
        kokoro: async () => new Response('busy', { status: 429 }),
        gemini: async () => audioResponse(),
      },
    );
    assert.equal(result.status, 429);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), null);
  }

  {
    const result = await handleTtsWithFallback(
      payload,
      'unknown',
      'unused-key',
      {
        kokoro: async () => new Response('failed', { status: 502 }),
        gemini: async () => audioResponse(),
      },
    );
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), 'gemini-achernar');
  }

  {
    const result = await handleTtsWithFallback(
      payload,
      'unknown',
      undefined,
      {
        kokoro: async () => { throw new Error('private internal detail'); },
        gemini: async () => new Response('unavailable', { status: 503 }),
      },
    );
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('X-Aether-TTS-Provider'), null);
  }

  console.log('[PASS] Kokoro-primary TTS fallback tests passed.');
}

run().catch((error: unknown) => {
  console.error('[FAIL] TTS fallback tests failed:', error);
  process.exit(1);
});
