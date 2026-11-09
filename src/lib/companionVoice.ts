import { PhoneticLipSyncEngine, VisemeFrame } from './phonemeLipSync';
import { parseWavPcm } from './audio/wav';
import type { ParsedWav } from './audio/wav';

export type { VisemeFrame };
export { parseWavPcm };
export type { ParsedWav };

export interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onInterim?: (transcript: string) => void;
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface VoicePlaybackHandlers {
  onStart: () => void;
  onEnd: () => void;
  onViseme: (mouthOpen: number, visemes?: VisemeFrame) => void;
  onError?: (reason: string) => void;
}

export interface CompanionSpeechOptions {
  emotion?: string;
  adultContentConsent?: boolean;
}

class CompanionVoiceService {
  private recognition: any = null;
  private isListening = false;
  private visemeInterval: number | null = null;
  private visemeRafId: number | null = null;
  private currentPlaybackHandlers: VoicePlaybackHandlers | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeAudioElement: HTMLAudioElement | null = null;
  private activeAudioUrl: string | null = null;
  private primedAudioElement: HTMLAudioElement | null = null;
  private activeAbortController: AbortController | null = null;
  private audioContext: AudioContext | null = null;
  private playbackId = 0;
  private muted = false;
  private recognitionSession = 0;
  private manuallyStoppedRecognition = false;

  constructor() {
    this.initSpeechRecognition();
    this.ensureGlobalUnlock();
  }

  private ensureGlobalUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlockAudio();
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('click', unlock, { capture: true, once: true });
    window.addEventListener('touchstart', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;
      } catch (err) {
        // Safe initialization
      }
    }
  }

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  public isAudioPlaybackSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as any).webkitAudioContext);
  }

  private getAudioContext(): AudioContext | null {
    if (!this.isAudioPlaybackSupported()) return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    return this.audioContext;
  }

  /** Call synchronously from a user gesture so later server audio can autoplay. */
  public unlockAudio(): void {
    const context = this.getAudioContext();
    if (context && context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    try {
      if (context) {
        const buffer = context.createBuffer(1, 1, 22050);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(0);
      }
    } catch {
      // ignore
    }
    try {
      if (typeof window !== 'undefined' && typeof window.Audio !== 'undefined') {
        if (!this.primedAudioElement) {
          this.primedAudioElement = new Audio();
        }
        // Prime HTML5 Audio element inside user gesture to ensure hardware playback rights
        this.primedAudioElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        const p = this.primedAudioElement.play();
        if (p) {
          p.then(() => {
            this.primedAudioElement?.pause();
          }).catch(() => undefined);
        }
      }
    } catch {
      // ignore
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.stopSpeaking();
  }

  /**
   * Starts listening for user voice input
   */
  public startListening(lang: 'ar' | 'en' | 'auto', handlers: SpeechRecognitionHandlers): boolean {
    if (typeof window === 'undefined') return false;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return false;

    if (!window.isSecureContext) {
      handlers.onError('insecure-context');
      handlers.onEnd();
      return true;
    }

    // Stop companion speech if companion is talking when user speaks
    this.stopSpeaking();

    // Clean up any prior recognition session
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // Ignore abort error
      }
      this.recognition = null;
      this.isListening = false;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      this.recognition = recognition;
      const session = ++this.recognitionSession;
      this.manuallyStoppedRecognition = false;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Prioritize Arabic for natural regional interaction unless explicitly specified
      recognition.lang = lang === 'en'
        ? 'en-US'
        : 'ar-SA';

      let receivedFinalTranscript = false;
      let accumulatedFinalText = '';
      let lastSpokenText = '';

      recognition.onstart = () => {
        this.isListening = true;
        handlers.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        if (event.results) {
          const firstResult = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
          for (let i = firstResult; i < event.results.length; i++) {
            const res = event.results[i];
            if (res && res[0]?.transcript) {
              if (res.isFinal) {
                finalText += res[0].transcript;
              } else {
                interimText += res[0].transcript;
              }
            }
          }
        }

        if (interimText.trim()) {
          handlers.onInterim?.(interimText.trim());
        }

        if (finalText.trim()) {
          accumulatedFinalText = `${accumulatedFinalText} ${finalText}`.trim();
        }

        const candidate = `${accumulatedFinalText} ${interimText}`.trim();
        if (candidate) {
          lastSpokenText = candidate;
        }

        if (finalText.trim()) {
          receivedFinalTranscript = true;
        }
      };

      recognition.onerror = (event: any) => {
        this.isListening = false;
        const err = event.error || 'Speech recognition error';
        if (err !== 'aborted' && err !== 'no-speech') {
          // Handled gracefully
        }
        handlers.onError(err);
      };

      recognition.onend = () => {
        this.isListening = false;
        if (session !== this.recognitionSession || this.manuallyStoppedRecognition) {
          handlers.onEnd();
          return;
        }
        const completedText = (accumulatedFinalText || lastSpokenText).trim();
        if (completedText) {
          receivedFinalTranscript = true;
          handlers.onResult(completedText);
        }
        handlers.onEnd();
      };

      recognition.start();
      this.isListening = true;
      return true;
    } catch (err: unknown) {
      this.isListening = false;
      this.recognition = null;
      const errorName = (err as { name?: string } | null)?.name;
      handlers.onError(
        errorName === 'NotAllowedError' || errorName === 'SecurityError'
          ? 'not-allowed'
          : errorName === 'NotFoundError'
            ? 'audio-capture'
            : 'start-failed'
      );
      handlers.onEnd();
      return true;
    }
  }

  /**
   * Stops listening
   */
  public stopListening(): void {
    this.manuallyStoppedRecognition = true;
    this.recognitionSession += 1;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.isListening = false;
    }
  }

  private quotaCooldownUntil = 0;

  public isQuotaCoolingDown(): boolean {
    return Date.now() < this.quotaCooldownUntil;
  }

  public resetQuotaCooldown(): void {
    this.quotaCooldownUntil = 0;
  }

  private speakWithBrowserFallback(text: string, handlers: VoicePlaybackHandlers): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') {
      return false;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = /[\u0600-\u06FF]/.test(text) ? 'ar-SA' : 'en-US';
      utterance.rate = 0.96;
      utterance.pitch = 1.02;
      this.currentPlaybackHandlers = handlers;
      utterance.onstart = () => {
        if (this.currentPlaybackHandlers === handlers) handlers.onStart();
      };
      utterance.onend = () => {
        if (this.currentPlaybackHandlers !== handlers) return;
        this.currentPlaybackHandlers = null;
        handlers.onViseme(0);
        handlers.onEnd();
      };
      utterance.onerror = () => {
        if (this.currentPlaybackHandlers !== handlers) return;
        this.currentPlaybackHandlers = null;
        handlers.onError?.('playback-failed');
        handlers.onViseme(0);
        handlers.onEnd();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      this.currentPlaybackHandlers = null;
      return false;
    }
  }

  /**
   * Requests Gemini TTS and plays physical audio while synchronizing lip visemes.
   * If audio generation, decoding, or browser playback fails, stops immediately
   * without faking mouth movement or articulate gestures.
   */
  public speak(
    text: string,
    handlers: VoicePlaybackHandlers,
    options: CompanionSpeechOptions = {},
  ): void {
    this.stopSpeaking();
    const cleanText = text
      .replace(/^\s*(?:repeat\s*exactly|exactly|egzakly|draft\s*\d*|response)[\s:]*/i, '')
      .replace(/\[EMOTION:\s*[A-Z_]+\]/gi, '')
      .replace(/[*_#`~\[\]]/g, '')
      .trim();

    if (!cleanText || this.muted) {
      handlers.onViseme(0);
      handlers.onEnd();
      return;
    }

    if (options.adultContentConsent !== true) {
      handlers.onError?.('consent-required');
      handlers.onViseme(0);
      handlers.onEnd();
      return;
    }

    if (this.isQuotaCoolingDown()) {
      handlers.onError?.('quota-exhausted');
      handlers.onViseme(0);
      handlers.onEnd();
      return;
    }

    const playbackId = ++this.playbackId;
    const isCurrentPlayback = () => this.playbackId === playbackId;
    const controller = new AbortController();
    this.activeAbortController = controller;
    this.currentPlaybackHandlers = handlers;
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45_000);

    void (async () => {
      try {
        // Kokoro-82M Voice: af_kore (matching Kore's warm, natural feminine timbre)
        const voice = 'af_kore';

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: cleanText.slice(0, 4_000),
            voice,
            emotion: options.emotion || 'NEUTRAL',
            adultContentConsent: options.adultContentConsent,
          }),
        });

        if (!response.ok) {
          if (!isCurrentPlayback()) return;
          const status = response.status;
          if (status === 429) {
            this.quotaCooldownUntil = Date.now() + 60_000;
          }
          const reason = status === 429
            ? 'quota-exhausted'
            : status === 403
              ? 'consent-required'
              : status === 503
                ? 'not-configured'
                : 'unavailable';
          if (!this.speakWithBrowserFallback(cleanText, handlers)) {
            handlers.onError?.(reason);
            handlers.onViseme(0);
            handlers.onEnd();
          }
          return;
        }

        const encodedAudio = await response.arrayBuffer();
        if (!isCurrentPlayback()) return;

        const parsedWav = parseWavPcm(encodedAudio);
        if (!parsedWav) {
          if (!isCurrentPlayback()) return;
          handlers.onError?.('corrupted-audio');
          handlers.onViseme(0);
          handlers.onEnd();
          return;
        }

        const blob = new Blob([encodedAudio], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.volume = 1.0;
        this.activeAudioElement = audio;
        this.activeAudioUrl = audioUrl;

        let completed = false;
        const cleanup = () => {
          if (completed) return;
          completed = true;
          if (this.visemeRafId !== null) {
            cancelAnimationFrame(this.visemeRafId);
            this.visemeRafId = null;
          }
          if (this.activeAudioElement === audio) {
            this.activeAudioElement = null;
          }
          if (this.activeAudioUrl === audioUrl) {
            this.activeAudioUrl = null;
          }
          audio.onended = null;
          audio.onerror = null;
          try {
            audio.pause();
          } catch {
            // ignore
          }
          try {
            URL.revokeObjectURL(audioUrl);
          } catch {
            // ignore
          }
        };

        audio.onended = () => {
          if (!isCurrentPlayback()) {
            cleanup();
            return;
          }
          cleanup();
          this.currentPlaybackHandlers = null;
          handlers.onViseme(0);
          handlers.onEnd();
        };

        audio.onerror = () => {
          if (!isCurrentPlayback()) {
            cleanup();
            return;
          }
          cleanup();
          this.currentPlaybackHandlers = null;
          handlers.onError?.('playback-failed');
          handlers.onViseme(0);
          handlers.onEnd();
        };

        try {
          await audio.play();
        } catch (playError) {
          cleanup();
          if (!isCurrentPlayback()) return;
          console.warn('[AetherAI Voice] Audio playback rejected by browser policy:', playError);
          if (!this.speakWithBrowserFallback(cleanText, handlers)) {
            handlers.onError?.('playback-failed');
            handlers.onViseme(0);
            handlers.onEnd();
          }
          return;
        }

        if (!isCurrentPlayback()) {
          cleanup();
          return;
        }

        // True physical audio playback has started successfully!
        handlers.onStart();

        const timeline = PhoneticLipSyncEngine.buildTimeline(cleanText);
        const pcm = parsedWav.pcm;
        const sampleRate = parsedWav.sampleRate;
        const audioDuration = Math.max(0.1, parsedWav.duration);
        const windowSamples = Math.floor(sampleRate * 0.03);

        const updateVisemes = () => {
          if (!isCurrentPlayback() || audio.paused || audio.ended) return;

          const currentTime = audio.currentTime;
          const progress = Math.min(0.999, Math.max(0, currentTime / audioDuration));
          const currentSample = Math.floor(currentTime * sampleRate);

          let sumSquares = 0;
          const halfWindow = windowSamples >> 1;
          const startSample = Math.max(0, currentSample - halfWindow);
          const endSample = Math.min(pcm.length, currentSample + halfWindow);
          const count = endSample - startSample;

          if (count > 0) {
            for (let i = startSample; i < endSample; i++) {
              const s = pcm[i];
              sumSquares += s * s;
            }
          }
          const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;

          const formant = Math.min(1, rms * 1.6);
          const sibilance = Math.min(1, rms * 0.8);

          const visemeFrame = PhoneticLipSyncEngine.sample(
            timeline,
            progress,
            rms,
            formant,
            sibilance
          );

          handlers.onViseme(visemeFrame.mouthOpen, visemeFrame);
          this.visemeRafId = requestAnimationFrame(updateVisemes);
        };

        this.visemeRafId = requestAnimationFrame(updateVisemes);
      } catch (error: unknown) {
        if (!isCurrentPlayback()) return;
        const isAbort = controller.signal.aborted;
        if (!this.speakWithBrowserFallback(cleanText, handlers)) {
          handlers.onError?.(isAbort && timedOut ? 'timeout' : 'unavailable');
          handlers.onViseme(0);
          handlers.onEnd();
        }
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  }

  /**
   * Immediately stops any active companion speech and resets mouth to closed pose
   */
  public stopSpeaking(): void {
    this.playbackId += 1;
    if (this.visemeRafId !== null) {
      cancelAnimationFrame(this.visemeRafId);
      this.visemeRafId = null;
    }
    if (this.visemeInterval !== null) {
      clearInterval(this.visemeInterval);
      this.visemeInterval = null;
    }
    const audio = this.activeAudioElement;
    this.activeAudioElement = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try { audio.pause(); } catch { /* ignore */ }
      try { audio.src = ''; } catch { /* ignore */ }
    }
    if (this.activeAudioUrl) {
      try {
        URL.revokeObjectURL(this.activeAudioUrl);
      } catch {
        // ignore
      }
      this.activeAudioUrl = null;
    }
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const source = this.activeSource;
    this.activeSource = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
    }
    const handlers = this.currentPlaybackHandlers;
    this.currentPlaybackHandlers = null;
    if (handlers) {
      handlers.onViseme(0, { mouthOpen: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
      handlers.onEnd();
    }
  }
}

export const companionVoice = new CompanionVoiceService();
