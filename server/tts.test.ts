import assert from 'node:assert/strict';
import { handleKokoroOnlyTts } from './tts';
import { handleKokoroTtsRequest } from './kokoroTts';

const wavResponse = () => new Response(new Uint8Array([1, 2, 3]), {
  status: 200,
  headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
});

async function run(): Promise<void> {
  let kokoroCalls = 0;
  let capturedVoice: unknown;
  let capturedIp: string | null = null;

  const success = await handleKokoroOnlyTts(
    { text: 'Hello, Ramona.', voice: 'af_heart', adultContentConsent: true },
    '203.0.113.20',
    async (request) => {
      kokoroCalls += 1;
      const payload = await request.json() as Record<string, unknown>;
      capturedVoice = payload.voice;
      capturedIp = request.headers.get('X-Client-IP');
      return wavResponse();
    },
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('X-Aether-TTS-Provider'), 'kokoro');
  assert.equal(capturedVoice, 'af_kore', 'Client-supplied voices must never change the single server voice.');
  assert.equal(capturedIp, '203.0.113.20');
  assert.equal(kokoroCalls, 1, 'One reply must make exactly one Kokoro call.');

  let callsWithoutConsent = 0;
  const denied = await handleKokoroOnlyTts(
    { text: 'hello', adultContentConsent: false },
    'unknown',
    async () => { callsWithoutConsent += 1; return wavResponse(); },
  );
  assert.equal(denied.status, 403);
  assert.equal(callsWithoutConsent, 0);

  const unavailable = await handleKokoroOnlyTts(
    { text: 'Hello.', adultContentConsent: true },
    'unknown',
    async () => { throw new Error('private model and path details'); },
  );
  assert.equal(unavailable.status, 502);
  assert.equal(await unavailable.text().then((body) => body.includes('private model')), false);

  const arabicRequest = new Request('https://aether.test/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'مرحباً بك يا رامونا', adultContentConsent: true }),
  });
  const arabic = await handleKokoroTtsRequest(arabicRequest);
  assert.equal(arabic.status, 422, 'Arabic must not be spoken with a mismatched English voice.');
  assert.equal((await arabic.json() as { code: string }).code, 'unsupported-language');

  for (const text of [
    'أهلاً، يا رامونا! ١٢٣؟',
    `${'هذا اختبار طويل. '.repeat(80)}انتهى الاختبار، 2026!`,
  ]) {
    const response = await handleKokoroTtsRequest(new Request('https://aether.test/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, adultContentConsent: true }),
    }));
    assert.equal(response.status, 422, 'Arabic punctuation, numerals and long text must never use an English voice.');
    assert.equal((await response.json() as { code: string }).code, 'unsupported-language');
  }

  console.log('[PASS] Kokoro-only TTS tests: one fixed voice, no secondary provider, Arabic limits explicit.');
}

void run().catch((error: unknown) => {
  console.error('[FAIL] Kokoro-only TTS tests failed:', error);
  process.exit(1);
});
