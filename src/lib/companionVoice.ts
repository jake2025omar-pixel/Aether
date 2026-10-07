/**
 * Aether Companion Voice System (Speech-to-Text, Text-to-Speech, and Lip Sync Visemes)
 */

export interface SpeechRecognitionHandlers {
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

export interface VoicePlaybackHandlers {
  onStart: () => void;
  onEnd: () => void;
  onViseme: (mouthOpen: number) => void;
}

class CompanionVoiceService {
  private recognition: any = null;
  private isListening = false;
  private visemeInterval: number | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private currentPlaybackHandlers: VoicePlaybackHandlers | null = null;
  private playbackId = 0;

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
        console.warn('SpeechRecognition initialization error:', err);
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
    return Boolean(this.recognition);
  }

  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Starts listening for user voice input
   */
  public startListening(lang: 'ar' | 'en' | 'auto', handlers: SpeechRecognitionHandlers): boolean {
    if (!this.recognition) {
      handlers.onError('Speech recognition is not supported in this browser.');
      return false;
    }

    if (this.isListening) {
      this.stopListening();
    }

    // Stop companion speech if companion is talking when user speaks
    this.stopSpeaking();

    this.recognition.lang = lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : navigator.language || 'ar-SA';

    this.recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      handlers.onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      const err = event.error || 'Speech recognition error';
      handlers.onError(err);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      handlers.onEnd();
    };

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err) {
      this.isListening = false;
      handlers.onError('Failed to access microphone.');
      return false;
    }
  }

  /**
   * Stops listening
   */
  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.isListening = false;
    }
  }

  /**
   * Speaks the companion's response and generates real-time lip sync visemes
   */
  public speak(text: string, handlers: VoicePlaybackHandlers): void {
    if (!this.isSpeechSynthesisSupported() || !text.trim()) {
      this.stopSpeaking();
      handlers.onViseme(0);
      handlers.onEnd();
      return;
    }

    this.stopSpeaking();

    // Detect language (Arabic vs English)
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const lang = isArabic ? 'ar-SA' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;
    utterance.lang = lang;
    utterance.rate = isArabic ? 0.98 : 1.0;
    utterance.pitch = 1.03;

    // Prefer the requested regional voice, then any voice in the right language.
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
    const language = isArabic ? 'ar' : 'en';
    const normalizedLang = lang.toLowerCase();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === normalizedLang)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(`${language}-`))
      || voices.find((voice) => voice.lang.toLowerCase() === language);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    const playbackId = ++this.playbackId;
    const isCurrentPlayback = () => this.playbackId === playbackId && this.currentUtterance === utterance;
    this.currentPlaybackHandlers = handlers;
    const words = text.match(/\S+/gu) || [];
    const segments = words.map((word) => {
      const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
      const syllables = isArabic
        ? Math.max(1, Math.min(4, Math.ceil([...letters].length / 3)))
        : Math.max(1, Math.min(4, (letters.match(/[aeiouy]/gi) || []).length));
      const duration = Math.max(140, Math.min(520, 95 + syllables * 115));
      const pause = /[.!?؟،;:]$/u.test(word) ? 180 : 45;
      return { duration, pause, syllables };
    });
    let fallbackStartAt = 0;
    const fallbackSegments = segments.map((segment) => {
      const start = fallbackStartAt;
      fallbackStartAt += segment.duration + segment.pause;
      return { ...segment, start };
    });

    let speechStartedAt = 0;
    let boundaryStartAt = 0;
    let boundaryDuration = 0;
    let boundarySyllables = 1;
    let hasSpeechBoundary = false;
    let completed = false;

    const syllabicAperture = (progress: number, syllableCount: number): number => {
      const clampedProgress = Math.max(0, Math.min(1, progress));
      const syllableProgress = (clampedProgress * syllableCount) % 1;
      const syllablePulse = Math.sin(syllableProgress * Math.PI);
      const wordEnvelope = Math.sin(clampedProgress * Math.PI);
      return Math.max(0, Math.min(0.72, wordEnvelope * (0.28 + syllablePulse * 0.44)));
    };

    const startVisemeLoop = () => {
      if (this.visemeInterval) clearInterval(this.visemeInterval);
      this.visemeInterval = window.setInterval(() => {
        if (!isCurrentPlayback()) return;
        const now = performance.now();
        let progress = -1;
        let syllables = 1;

        if (hasSpeechBoundary) {
          progress = (now - boundaryStartAt) / boundaryDuration;
          syllables = boundarySyllables;
        } else {
          const elapsed = now - speechStartedAt;
          const segment = fallbackSegments.find((item) => elapsed >= item.start && elapsed < item.start + item.duration);
          if (segment) {
            progress = (elapsed - segment.start) / segment.duration;
            syllables = segment.syllables;
          }
        }

        handlers.onViseme(progress >= 0 && progress <= 1 ? syllabicAperture(progress, syllables) : 0);
      }, 40);
    };

    const stopVisemeLoop = () => {
      if (this.visemeInterval) {
        clearInterval(this.visemeInterval);
        this.visemeInterval = null;
      }
      handlers.onViseme(0);
    };

    const finishPlayback = () => {
      if (!isCurrentPlayback() || completed) return;
      completed = true;
      stopVisemeLoop();
      this.currentUtterance = null;
      this.currentPlaybackHandlers = null;
      handlers.onEnd();
    };

    utterance.onstart = () => {
      if (!isCurrentPlayback()) return;
      speechStartedAt = performance.now();
      handlers.onStart();
      startVisemeLoop();
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (!isCurrentPlayback() || event.name !== 'word') return;
      const start = Math.max(0, event.charIndex || 0);
      const fallbackWord = text.slice(start).match(/^[^\s.,!?؟،;:]+/u)?.[0] || '';
      const word = text.slice(start, start + (event.charLength || fallbackWord.length)) || fallbackWord;
      const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
      boundarySyllables = isArabic
        ? Math.max(1, Math.min(4, Math.ceil([...letters].length / 3)))
        : Math.max(1, Math.min(4, (letters.match(/[aeiouy]/gi) || []).length));
      boundaryDuration = Math.max(140, Math.min(520, 95 + boundarySyllables * 115));
      boundaryStartAt = performance.now();
      hasSpeechBoundary = true;
    };

    utterance.onend = finishPlayback;
    utterance.onerror = finishPlayback;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Immediately stops any active companion speech and ensures mouth returns to resting pose
   */
  public stopSpeaking(): void {
    this.playbackId += 1;
    if (this.visemeInterval) {
      clearInterval(this.visemeInterval);
      this.visemeInterval = null;
    }

    const handlers = this.currentPlaybackHandlers;
    this.currentUtterance = null;
    this.currentPlaybackHandlers = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (handlers) {
      handlers.onViseme(0);
      handlers.onEnd();
    }
  }
}

export const companionVoice = new CompanionVoiceService();
