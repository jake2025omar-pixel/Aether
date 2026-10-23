import { PhoneticLipSyncEngine, VisemeFrame } from './phonemeLipSync';

export type { VisemeFrame };

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
  private activeAbortController: AbortController | null = null;
  private audioContext: AudioContext | null = null;
  private playbackId = 0;
  private muted = false;

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
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    try {
      // 1-sample buffer played synchronously inside user gesture guarantees audio output permissions
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
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
      handlers.onError?.('unavailable');
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
    let completed = false;
    let smoothedLevel = 0;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 45_000);

    const finishPlayback = () => {
      if (!isCurrentPlayback() || completed) return;
      completed = true;
      if (this.visemeRafId !== null) {
        cancelAnimationFrame(this.visemeRafId);
        this.visemeRafId = null;
      }
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

        const cleanText = text
          .replace(/^\s*(?:repeat\s*exactly|exactly|draft\s*\d*|response)[\s:]*/i, '')
          .replace(/\[EMOTION:\s*[A-Z_]+\]/gi, '')
          .replace(/[*_#`~\[\]]/g, '')
          .trim();

        // Strictly lock Korean voice configuration to 'Kore'
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: cleanText.slice(0, 4_000),
            voice: 'Kore',
            emotion: options.emotion || 'NEUTRAL',
            adultContentConsent: options.adultContentConsent,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn('[AetherAI Voice] Gemini TTS returned non-OK status:', response.status, errData);
          if (isCurrentPlayback()) {
            handlers.onError?.(response.status === 429 ? 'rate-limit' : 'unavailable');
            // Animate companion's speaking articulation so character talks throughout the message reading time
            handlers.onStart();
            const timeline = PhoneticLipSyncEngine.buildTimeline(cleanText);
            const words = cleanText.match(/\S+/gu) || [];
            const estimatedMs = Math.max(4000, Math.min(12000, words.length * 360));
            const startMs = performance.now();

            this.visemeInterval = window.setInterval(() => {
              if (!isCurrentPlayback()) return;
              const elapsedMs = performance.now() - startMs;
              if (elapsedMs >= estimatedMs) {
                finishPlayback();
                return;
              }
              const progress = Math.min(0.999, elapsedMs / estimatedMs);
              const syllableCadence = 160;
              const phase = (elapsedMs / syllableCadence) % 1;
              const openCurve = Math.sin(phase * Math.PI);
              const pseudoRms = Math.max(0.04, openCurve * 0.24);
              const frame = PhoneticLipSyncEngine.sample(timeline, progress, pseudoRms);
              handlers.onViseme(frame.mouthOpen, frame);
            }, 30);
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
        gain.gain.value = 1.0;
        const waveform = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);

        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.28;
        analyser.minDecibels = -75;
        analyser.maxDecibels = -10;

        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);

        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume();
          } catch {
            // ignore
          }
        }

        this.activeSource = source;
        source.onended = finishPlayback;
        handlers.onStart();

        const timeline = PhoneticLipSyncEngine.buildTimeline(cleanText);
        const audioDuration = Math.max(0.2, audioBuffer.duration);
        let audioStartTime = audioContext.currentTime;

        // Phoneme-aligned real-time lip-sync loop driven by audio playback clock
        const updateVisemes = () => {
          if (!isCurrentPlayback()) return;
          analyser.getByteFrequencyData(frequencyData);
          analyser.getByteTimeDomainData(waveform);

          let sumSquares = 0;
          for (let i = 0; i < waveform.length; i++) {
            const centered = (waveform[i] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / waveform.length);

          // Vocal tract formant resonance band (vowel phonemes: ~280Hz to 2300Hz, bins 3 to 25)
          let formantSum = 0;
          const minBin = 3;
          const maxBin = Math.min(25, frequencyData.length);
          for (let i = minBin; i < maxBin; i++) {
            formantSum += frequencyData[i];
          }
          const avgFormant = formantSum / (maxBin - minBin) / 255;

          // High frequency friction / sibilance band (~4000Hz to 8000Hz, bins 42 to 85)
          let sibilanceSum = 0;
          const sibMin = Math.min(42, frequencyData.length);
          const sibMax = Math.min(85, frequencyData.length);
          for (let i = sibMin; i < sibMax; i++) {
            sibilanceSum += frequencyData[i];
          }
          const avgSibilance = sibilanceSum / Math.max(1, sibMax - sibMin) / 255;

          // Calculate precise timeline progress from audio context playback clock
          const elapsed = audioContext.currentTime - audioStartTime;
          const progress = Math.min(0.999, Math.max(0, elapsed / audioDuration));

          const visemeFrame = PhoneticLipSyncEngine.sample(
            timeline,
            progress,
            rms,
            avgFormant,
            avgSibilance
          );

          handlers.onViseme(visemeFrame.mouthOpen, visemeFrame);
          this.visemeRafId = requestAnimationFrame(updateVisemes);
        };

        this.visemeRafId = requestAnimationFrame(updateVisemes);
        source.start(0);
        audioStartTime = audioContext.currentTime;
      } catch (error: unknown) {
        if (!isCurrentPlayback()) return;
        const isAbort = controller.signal.aborted;
        handlers.onError?.(isAbort && timedOut ? 'timeout' : 'unavailable');
        handlers.onStart();
        const timeline = PhoneticLipSyncEngine.buildTimeline(text);
        const words = text.match(/\S+/gu) || [];
        const estimatedMs = Math.max(4000, Math.min(12000, words.length * 360));
        const startMs = performance.now();

        this.visemeInterval = window.setInterval(() => {
          if (!isCurrentPlayback()) return;
          const elapsedMs = performance.now() - startMs;
          if (elapsedMs >= estimatedMs) {
            finishPlayback();
            return;
          }
          const progress = Math.min(0.999, elapsedMs / estimatedMs);
          const syllableCadence = 160;
          const phase = (elapsedMs / syllableCadence) % 1;
          const openCurve = Math.sin(phase * Math.PI);
          const pseudoRms = Math.max(0.04, openCurve * 0.24);
          const frame = PhoneticLipSyncEngine.sample(timeline, progress, pseudoRms);
          handlers.onViseme(frame.mouthOpen, frame);
        }, 30);
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
    if (this.visemeRafId !== null) {
      cancelAnimationFrame(this.visemeRafId);
      this.visemeRafId = null;
    }
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
    if (handlers) {
      handlers.onViseme(0, { mouthOpen: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 });
      handlers.onEnd();
    }
  }
}

export const companionVoice = new CompanionVoiceService();
