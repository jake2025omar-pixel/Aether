/**
 * Aether Companion Voice System (Speech-to-Text, Text-to-Speech, and Lip Sync Visemes)
 */

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
  onViseme: (mouthOpen: number) => void;
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
  private currentPlaybackHandlers: VoicePlaybackHandlers | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeAbortController: AbortController | null = null;
  private audioContext: AudioContext | null = null;
  private playbackId = 0;
  private muted = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.initSpeechRecognition();
    this.initSpeechSynthesis();
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

  private initSpeechSynthesis() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
    };
  }

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isAudioPlaybackSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
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
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
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
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Prioritize Arabic for natural regional interaction unless explicitly specified
      recognition.lang = lang === 'en'
        ? 'en-US'
        : 'ar-SA';

      let receivedFinalTranscript = false;
      let lastSpokenText = '';

      recognition.onstart = () => {
        this.isListening = true;
        handlers.onStart?.();
      };

      recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        if (event.results) {
          for (let i = 0; i < event.results.length; i++) {
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

        const candidate = (finalText || interimText).trim();
        if (candidate) {
          lastSpokenText = candidate;
        }

        if (finalText.trim()) {
          receivedFinalTranscript = true;
          handlers.onResult(finalText.trim());
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
        if (!receivedFinalTranscript && lastSpokenText.trim()) {
          receivedFinalTranscript = true;
          handlers.onResult(lastSpokenText.trim());
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
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.isListening = false;
    }
  }

  /**
   * Browser SpeechSynthesis fallback
   */
  private speakWithBrowserSynthesis(
    text: string,
    playbackId: number,
    handlers: VoicePlaybackHandlers
  ): void {
    if (!this.isSpeechSynthesisSupported()) {
      handlers.onViseme(0);
      handlers.onEnd();
      return;
    }

    const isCurrentPlayback = () => this.playbackId === playbackId;
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const lang = isArabic ? 'ar-SA' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    utterance.lang = lang;
    utterance.rate = isArabic ? 0.98 : 1.0;
    utterance.pitch = 1.03;

    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
    const language = isArabic ? 'ar' : 'en';
    const normalizedLang = lang.toLowerCase();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === normalizedLang)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(`${language}-`))
      || voices.find((voice) => voice.lang.toLowerCase() === language);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    const words = text.match(/\S+/gu) || [];
    const segments = words.map((word) => {
      const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
      const syllables = isArabic
        ? Math.max(1, Math.min(4, Math.ceil([...letters].length / 3)))
        : Math.max(1, Math.min(4, (letters.match(/[aeiouy]/gi) || []).length));
      return { word, syllables };
    });

    const totalSyllables = segments.reduce((sum, item) => sum + item.syllables, 0);
    const estimatedSeconds = Math.max(1.0, (words.length * 0.42) / (utterance.rate || 1.0));
    const syllableCadence = (estimatedSeconds / Math.max(1, totalSyllables)) * 1000;
    let fallbackSpeechStartedAt = 0;

    utterance.onstart = () => {
      if (!isCurrentPlayback()) return;
      fallbackSpeechStartedAt = performance.now();
      handlers.onStart();

        this.visemeInterval = window.setInterval(() => {
          if (!isCurrentPlayback()) return;
          const elapsedMs = performance.now() - fallbackSpeechStartedAt;
          const syllablePhase = (elapsedMs / Math.max(1, syllableCadence)) % 1;
          const envelope = syllablePhase < 0.14
            ? syllablePhase / 0.14
            : syllablePhase > 0.86
              ? (1 - syllablePhase) / 0.14
              : 1;
          handlers.onViseme(Math.max(0, Math.min(0.62, 0.08 + envelope * 0.50)));
        }, Math.max(30, Math.min(80, Math.round(syllableCadence * 0.25))));
    };

    const cleanup = () => {
      if (!isCurrentPlayback()) return;
      if (this.visemeInterval !== null) {
        window.clearInterval(this.visemeInterval);
        this.visemeInterval = null;
      }
      this.currentUtterance = null;
      handlers.onViseme(0);
      handlers.onEnd();
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      cleanup();
    }
  }

  /** Requests Gemini TTS and drives lip motion from decoded audio amplitude. */
  public speak(
    text: string,
    handlers: VoicePlaybackHandlers,
    options: CompanionSpeechOptions = {},
  ): void {
    this.stopSpeaking();
    if (!text.trim() || this.muted) {
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

    const audioContext = this.getAudioContext();
    if (!audioContext) {
      // Fallback to speech synthesis if AudioContext is unavailable
      this.speakWithBrowserSynthesis(text, this.playbackId, handlers);
      return;
    }

    const playbackId = ++this.playbackId;
    const isCurrentPlayback = () => this.playbackId === playbackId;
    const controller = new AbortController();
    this.activeAbortController = controller;
    this.currentPlaybackHandlers = handlers;
    let timedOut = false;
    let completed = false;
    let smoothedLevel = 0;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45_000);

    const finishPlayback = () => {
      if (!isCurrentPlayback() || completed) return;
      completed = true;
      if (this.visemeInterval !== null) {
        window.clearInterval(this.visemeInterval);
        this.visemeInterval = null;
      }
      this.activeSource = null;
      this.activeAbortController = null;
      this.currentPlaybackHandlers = null;
      handlers.onViseme(0);
      handlers.onEnd();
    };

    void (async () => {
      try {
        if (audioContext.state === 'suspended') await audioContext.resume();

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: text.slice(0, 4_000),
            voice: 'Achernar',
            emotion: options.emotion || 'NEUTRAL',
            adultContentConsent: options.adultContentConsent,
          }),
        });

        if (!response.ok) {
          // If server TTS is temporarily unavailable, fall back to browser speech synthesis
          if (isCurrentPlayback()) {
            this.speakWithBrowserSynthesis(text, playbackId, handlers);
          }
          return;
        }

        const encodedAudio = await response.arrayBuffer();
        if (!isCurrentPlayback()) return;

        const audioBuffer = await audioContext.decodeAudioData(encodedAudio.slice(0));
        if (!isCurrentPlayback()) return;

        const source = audioContext.createBufferSource();
        const analyser = audioContext.createAnalyser();
        const gain = audioContext.createGain();
        const waveform = new Uint8Array(analyser.fftSize);

        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.32;
        analyser.minDecibels = -80;
        analyser.maxDecibels = -10;

        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);

        this.activeSource = source;
        source.onended = finishPlayback;
        handlers.onStart();

        this.visemeInterval = window.setInterval(() => {
          if (!isCurrentPlayback()) return;
          analyser.getByteTimeDomainData(waveform);
          let sumSquares = 0;
          for (const sample of waveform) {
            const centered = (sample - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / waveform.length);
          // Use the measured audio envelope only. The gate removes analyser
          // noise; attack/release keeps the lips readable without popping.
          const gated = Math.max(0, rms - 0.018);
          const target = Math.max(0, Math.min(0.86, gated * 6.8));
          const response = target > smoothedLevel ? 0.52 : 0.24;
          smoothedLevel += (target - smoothedLevel) * response;
          handlers.onViseme(smoothedLevel < 0.012 ? 0 : smoothedLevel);
        }, 32);

        source.start(0);
      } catch (error: unknown) {
        if (!isCurrentPlayback()) return;
        if (controller.signal.aborted && !timedOut) {
          finishPlayback();
          return;
        }
        // Seamless fallback to browser speech synthesis
        this.speakWithBrowserSynthesis(text, playbackId, handlers);
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();
  }

  /**
   * Immediately stops any active companion speech and ensures mouth returns to resting pose
   */
  public stopSpeaking(): void {
    this.playbackId += 1;
    if (this.visemeInterval !== null) {
      window.clearInterval(this.visemeInterval);
      this.visemeInterval = null;
    }
    const handlers = this.currentPlaybackHandlers;
    this.currentPlaybackHandlers = null;
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    const source = this.activeSource;
    this.activeSource = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
    }
    if (this.currentUtterance) {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      this.currentUtterance = null;
    }
    if (handlers) {
      handlers.onViseme(0);
      handlers.onEnd();
    }
  }
}

export const companionVoice = new CompanionVoiceService();
