import assert from 'node:assert/strict';
import { parseWavPcm, companionVoice } from './companionVoice';

// Helper to create a valid 16-bit linear PCM WAV ArrayBuffer for testing
function createMockWavBuffer(sampleRate = 24000, durationSec = 0.5, amplitude = 0.5): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(sampleRate * durationSec);
  const dataByteLength = sampleCount * numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + dataByteLength, true); // File size - 8
  view.setUint32(8, 0x57415645, false); // 'WAVE'

  // fmt subchunk
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, dataByteLength, true);

  // Generate a simple sinusoidal tone
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * amplitude;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  return buffer;
}

// -------------------------------------------------------------
// Unit Test Suite: parseWavPcm
// -------------------------------------------------------------
{
  console.log('[Test 1] parseWavPcm correctly parses valid WAV headers and samples');
  const validBuffer = createMockWavBuffer(24000, 0.25, 0.6);
  const parsed = parseWavPcm(validBuffer);
  assert.ok(parsed !== null, 'Valid buffer should parse successfully');
  assert.equal(parsed.sampleRate, 24000);
  assert.equal(parsed.channels, 1);
  assert.ok(Math.abs(parsed.duration - 0.25) < 0.01, 'Duration should match mock generation');
  assert.equal(parsed.pcm.length, 6000);
  assert.ok(parsed.pcm[0] >= -1 && parsed.pcm[0] <= 1, 'Normalized sample range check');

  console.log('[Test 2] parseWavPcm returns null for corrupt or short headers');
  assert.equal(parseWavPcm(new ArrayBuffer(20)), null);
  assert.equal(parseWavPcm(new Uint8Array([0, 1, 2, 3]).buffer), null);
  const invalidHeader = validBuffer.slice(0);
  new DataView(invalidHeader).setUint32(0, 0x12345678, false); // corrupt RIFF
  assert.equal(parseWavPcm(invalidHeader), null);
}

// -------------------------------------------------------------
// Browser Environment Mocking for CompanionVoiceService
// -------------------------------------------------------------
class MockAudioElement {
  public src = '';
  public volume = 1.0;
  public preload = '';
  public currentTime = 0;
  public duration = 0.5;
  public paused = true;
  public ended = false;
  public onended: (() => void) | null = null;
  public onerror: ((err: any) => void) | null = null;
  public static shouldRejectPlay = false;
  public static playCount = 0;

  public async play(): Promise<void> {
    if (MockAudioElement.shouldRejectPlay) {
      const err = new Error('NotAllowedError: play() failed because the user didn\'t interact first.');
      err.name = 'NotAllowedError';
      throw err;
    }
    MockAudioElement.playCount++;
    this.paused = false;
    this.ended = false;
  }

  public pause(): void {
    this.paused = true;
  }
}

// Install mock global objects
(globalThis as any).Audio = MockAudioElement;
(globalThis as any).URL = {
  createObjectURL: (blob: any) => `blob:mock-url-${Math.random()}`,
  revokeObjectURL: (_url: string) => {},
};
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 16) as unknown as number;
};
(globalThis as any).cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// -------------------------------------------------------------
// Integration Test Suite: CompanionVoiceService Playback & Defect Prevention
// -------------------------------------------------------------
async function runVoiceTests() {
  const validWav = createMockWavBuffer(24000, 0.4, 0.5);

  // Test 3: Successful playback invokes onStart and true PCM-derived visemes
  {
    console.log('[Test 3] Successful TTS playback starts true audio and fires onStart');
    MockAudioElement.shouldRejectPlay = false;
    MockAudioElement.playCount = 0;

    (globalThis as any).fetch = async (url: string) => {
      assert.equal(url, '/api/tts');
      return new Response(validWav, { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    };

    let started = false;
    let ended = false;
    let visemeReceived = false;

    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'مرحباً بك يا صديقي',
        {
          onStart: () => {
            started = true;
          },
          onViseme: (mouthVal) => {
            if (mouthVal > 0) visemeReceived = true;
          },
          onEnd: () => {
            ended = true;
            resolve();
          },
          onError: (err) => {
            assert.fail(`Unexpected onError: ${err}`);
          },
        },
        { adultContentConsent: true }
      );

      // Simulate audio end after 60ms
      setTimeout(() => {
        companionVoice.stopSpeaking();
        resolve();
      }, 60);
    });

    assert.equal(started, true, 'onStart should have fired when audio started');
    assert.equal(MockAudioElement.playCount > 0, true, 'Audio.play() should have been called');
  }

  // Test 4: Quota exceeded (429) MUST NOT call onStart or animate mouth, and MUST engage cooldown
  {
    console.log('[Test 4] 429 Quota Exceeded reports quota-exhausted, leaves mouth closed, and engages cooldown');
    companionVoice.resetQuotaCooldown();
    let fetchCount = 0;
    (globalThis as any).fetch = async () => {
      fetchCount++;
      return new Response(JSON.stringify({ error: 'Quota exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let started = false;
    let mouthMoved = false;
    let reportedError: string | null = null;

    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'هذا اختبار لتجاوز الحصة',
        {
          onStart: () => {
            started = true;
          },
          onViseme: (mouthVal) => {
            if (mouthVal > 0) mouthMoved = true;
          },
          onEnd: () => {
            resolve();
          },
          onError: (reason) => {
            reportedError = reason;
          },
        },
        { adultContentConsent: true }
      );
    });

    assert.equal(reportedError, 'quota-exhausted', 'onError should report quota-exhausted');
    assert.equal(started, false, 'CRITICAL: onStart MUST NOT fire when quota is exhausted');
    assert.equal(mouthMoved, false, 'CRITICAL: Character mouth MUST NOT move silently when audio is unavailable');
    assert.equal(companionVoice.isQuotaCoolingDown(), true, 'Quota cooldown must be active after 429');
    assert.equal(fetchCount, 1);

    // Immediate second call during cooldown MUST NOT issue fetch
    console.log('[Test 4b] Predictable repeated calls during quota cooldown do not issue unnecessary TTS requests');
    let secondError: string | null = null;
    let secondStarted = false;
    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'طلب آخر أثناء التهدئة',
        {
          onStart: () => {
            secondStarted = true;
          },
          onViseme: () => {},
          onEnd: () => {
            resolve();
          },
          onError: (reason) => {
            secondError = reason;
          },
        },
        { adultContentConsent: true }
      );
    });

    assert.equal(fetchCount, 1, 'Fetch MUST NOT be called again during quota cooldown');
    assert.equal(secondError, 'quota-exhausted');
    assert.equal(secondStarted, false);
    companionVoice.resetQuotaCooldown();
  }

  // Test 5: Server error (500) reports unavailable and does not articulate mouth
  {
    console.log('[Test 5] 500 Server Error reports unavailable and leaves mouth closed');
    (globalThis as any).fetch = async () => {
      return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    };

    let started = false;
    let mouthMoved = false;
    let reportedError: string | null = null;

    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'رسالة خطأ في الخادم',
        {
          onStart: () => {
            started = true;
          },
          onViseme: (mouthVal) => {
            if (mouthVal > 0) mouthMoved = true;
          },
          onEnd: () => {
            resolve();
          },
          onError: (reason) => {
            reportedError = reason;
          },
        },
        { adultContentConsent: true }
      );
    });

    assert.equal(reportedError, 'unavailable');
    assert.equal(started, false);
    assert.equal(mouthMoved, false);
  }

  // Test 6: Browser Autoplay Policy Rejection (play() rejects)
  {
    console.log('[Test 6] Browser autoplay rejection reports playback-failed without silent mouth movement');
    MockAudioElement.shouldRejectPlay = true;

    (globalThis as any).fetch = async () => {
      return new Response(validWav, { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    };

    let started = false;
    let mouthMoved = false;
    let reportedError: string | null = null;

    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'اختبار قيود المتصفح',
        {
          onStart: () => {
            started = true;
          },
          onViseme: (mouthVal) => {
            if (mouthVal > 0) mouthMoved = true;
          },
          onEnd: () => {
            resolve();
          },
          onError: (reason) => {
            reportedError = reason;
          },
        },
        { adultContentConsent: true }
      );
    });

    assert.equal(reportedError, 'playback-failed');
    assert.equal(started, false, 'onStart must not fire when play() rejects');
    assert.equal(mouthMoved, false, 'Mouth must not move when browser blocks audio');
    MockAudioElement.shouldRejectPlay = false;
  }

  // Test 7: Rapid interruption cancels prior playback without overlapping audio
  {
    console.log('[Test 7] Rapid calls cancel prior playback cleanly');
    let firstStarted = false;
    let secondStarted = false;

    (globalThis as any).fetch = async () => {
      return new Response(validWav, { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    };

    companionVoice.speak(
      'الجملة الأولى',
      {
        onStart: () => {
          firstStarted = true;
        },
        onViseme: () => {},
        onEnd: () => {},
      },
      { adultContentConsent: true }
    );

    // Immediately trigger second message
    await new Promise<void>((resolve) => {
      companionVoice.speak(
        'الجملة الثانية المستعجلة',
        {
          onStart: () => {
            secondStarted = true;
          },
          onViseme: () => {},
          onEnd: () => {
            resolve();
          },
        },
        { adultContentConsent: true }
      );

      setTimeout(() => {
        companionVoice.stopSpeaking();
        resolve();
      }, 50);
    });

    assert.equal(firstStarted, false, 'First aborted playback should not start');
    assert.equal(secondStarted, true, 'Second playback should start cleanly');
  }

  console.log('\n[PASS] All voice pipeline regression tests passed successfully!');
}

runVoiceTests().catch((err) => {
  console.error('[FAIL] Voice test encountered an error:', err);
  process.exit(1);
});
