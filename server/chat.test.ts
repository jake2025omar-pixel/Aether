import assert from 'node:assert/strict';
import { onRequestPost } from './chat';

const originalFetch = globalThis.fetch;
let upstreamCalls = 0;

globalThis.fetch = (async () => {
  upstreamCalls += 1;
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'اختبار استجابة صحيحة' }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

function request(body: unknown, ip: string): Request {
  return new Request('https://aether.test/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify(body),
  });
}

async function run(): Promise<void> {
  try {
    const missingConsent = await onRequestPost({
      request: request({ message: 'hello' }, 'chat-test-consent'),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    assert.equal(missingConsent.status, 403);

    const emptyMessage = await onRequestPost({
      request: request({ message: '   ', adultContentConsent: true }, 'chat-test-empty'),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    assert.equal(emptyMessage.status, 400);

    const tooLongMessage = await onRequestPost({
      request: request({ message: 'x'.repeat(2_001), adultContentConsent: true }, 'chat-test-long'),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    assert.equal(tooLongMessage.status, 400);

    const validLongMessage = await onRequestPost({
      request: request({ message: 'x'.repeat(2_000), adultContentConsent: true }, 'chat-test-valid-long'),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    assert.equal(validLongMessage.status, 200);
    assert.equal((await validLongMessage.json()).text, 'اختبار استجابة صحيحة');

    const oversizedBody = await onRequestPost({
      request: request({ message: 'x'.repeat(2_000), history: [{ text: 'y'.repeat(120_000) }], adultContentConsent: true }, 'chat-test-body'),
      env: { GEMINI_API_KEY: 'test-key' },
    });
    assert.equal(oversizedBody.status, 413);
    assert.equal(upstreamCalls, 1);

    console.log('[PASS] Chat API boundary, consent, and upstream-protection tests passed.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void run();
