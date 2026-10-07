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
    utterance.rate = isArabic ? 1.0 : 1.05;
    utterance.pitch = 1.15; // Slightly warm, friendly pitch for companion

    // Select the best voice available
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((v) => v.lang.startsWith(isArabic ? 'ar' : 'en'));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    this.currentPlaybackHandlers = handlers;

    // Viseme simulation clock
    let visemePhase = 0;
    const startVisemeLoop = () => {
      if (this.visemeInterval) clearInterval(this.visemeInterval);

      this.visemeInterval = window.setInterval(() => {
        visemePhase += 0.28;
        // Realistic natural phoneme opening (syllables oscillate between 0.05 and 0.65)
        const syllableWave = Math.sin(visemePhase);
        const subHarmonic = Math.cos(visemePhase * 1.8);
        const rawAperture = 0.35 + 0.32 * syllableWave * (0.75 + 0.25 * subHarmonic);
        const mouthOpen = Math.max(0, Math.min(1, rawAperture));
        handlers.onViseme(mouthOpen);
      }, 50);
    };

    const stopVisemeLoop = () => {
      if (this.visemeInterval) {
        clearInterval(this.visemeInterval);
        this.visemeInterval = null;
      }
      handlers.onViseme(0);
    };

    utterance.onstart = () => {
      handlers.onStart();
      startVisemeLoop();
    };

    utterance.onend = () => {
      stopVisemeLoop();
      this.currentUtterance = null;
      handlers.onEnd();
      this.currentPlaybackHandlers = null;
    };

    utterance.onerror = () => {
      stopVisemeLoop();
      this.currentUtterance = null;
      handlers.onEnd();
      this.currentPlaybackHandlers = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Immediately stops any active companion speech and ensures mouth returns to resting pose
   */
  public stopSpeaking(): void {
    if (this.visemeInterval) {
      clearInterval(this.visemeInterval);
      this.visemeInterval = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;

    if (this.currentPlaybackHandlers) {
      this.currentPlaybackHandlers.onViseme(0);
      this.currentPlaybackHandlers.onEnd();
      this.currentPlaybackHandlers = null;
    }
  }
}

export const companionVoice = new CompanionVoiceService();
