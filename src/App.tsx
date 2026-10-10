import React, { useState, useCallback, useRef } from 'react';
import { WardrobeView } from './components/WardrobeView';
import aetherCatalog from './data/aetherCatalog.json';

type ChatMessage = { id: string; sender: 'user' | 'gemini'; text: string };
import { CompanionEnvironment } from './components/CompanionEnvironment';
import { InteractionBar } from './components/InteractionBar';
import { AboutView } from './components/AboutView';
import { SupportView } from './components/SupportView';
import { Navigation, NavDestination } from './components/ui/Navigation';
import { AuthControl } from './components/AuthControl';
import { DeveloperInspectionModal } from './components/dev/DeveloperInspectionModal';
import { Terminal } from 'lucide-react';
import {
  CompanionState,
  CompanionEmotion,
  parseCompanionResponse,
} from './lib/companionPersonality';
import { companionVoice } from './lib/companionVoice';

const pathToView = (path: string): NavDestination => {
  const clean = path.replace(/\/$/, '') || '/';
  if (clean === '/wardrobe') return 'wardrobe';
  if (clean === '/about') return 'about';
  if (clean === '/support') return 'support';
  return 'home';
};

const viewToPath = (view: NavDestination): string => {
  return view === 'home' ? '/' : `/${view}`;
};

export default function App() {
  const [activeView, setActiveView] = useState<NavDestination>(() => {
    if (typeof window !== 'undefined') {
      return pathToView(window.location.pathname);
    }
    return 'home';
  });

  const navigateTo = useCallback((view: NavDestination) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      const targetPath = viewToPath(view);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    }
  }, []);

  React.useEffect(() => {
    const handlePopState = () => {
      setActiveView(pathToView(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const primaryCharacterUrl = '/assets/characters/dark_ice/dark_ice.vrm';
  const defaultEnvironment = aetherCatalog.assets[
    aetherCatalog.default_environment as keyof typeof aetherCatalog.assets
  ];
  const primaryEnvironmentUrl = defaultEnvironment?.status === 'WEB_READY'
    && typeof defaultEnvironment.runtime_file === 'string'
    ? defaultEnvironment.runtime_file
    : null;

  // Companion 3D State & Expression
  const [companionState, setCompanionState] = useState<CompanionState>('IDLE');
  const [companionEmotion, setCompanionEmotion] = useState<CompanionEmotion>('NEUTRAL');
  const [visemeMouthOpen, setVisemeMouthOpen] = useState<number>(0);
  const [currentSpeechText, setCurrentSpeechText] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  // Manage chat sessions
  const [currentChatId, setCurrentChatId] = useState<string>('default-session');
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({
    'default-session': [],
  });
  const [loading, setLoading] = useState(false);
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const recoveryTimerRef = useRef<number | null>(null);

  // Global Developer Mode shortcut: Shift + D
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        // Toggle if not typing in input
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setIsDevModalOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reference for history payload
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  /**
   * Handles user input from the 3D room (Voice or Text),
   * querying Gemini and speaking the response aloud with Lip Sync.
   */
  const handleCompanionInteraction = useCallback(async (query: string) => {
    if (!query.trim() || loading) return;

    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }

    // Interrupt any ongoing speech
    companionVoice.stopSpeaking();
    setVoiceError(null);
    setCompanionState('THINKING');
    setLoading(true);

    const userMessageId = 'u-' + Date.now();
    const companionMessageId = 'c-' + Date.now();
    const currentMessages = chatsRef.current[currentChatId] || [];

    // Save into history in background
    setChats((prev) => ({
      ...prev,
      [currentChatId]: [
        ...(prev[currentChatId] || []),
        { id: userMessageId, sender: 'user', text: query },
      ],
    }));

    try {
      const historyPayload = currentMessages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      let res: Response;
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: query.slice(0, 2000),
            history: historyPayload,
            stream: false,
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let rawAnswer = '';
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        console.warn('Chat endpoint returned non-OK status:', res.status, errJson);
        const isArabic = /[\u0600-\u06FF]/.test(query);
        const isNotConfigured = res.status === 503;
        rawAnswer = isArabic
          ? isNotConfigured
            ? '[EMOTION: NEUTRAL] خدمة المحادثة غير مهيأة على الخادم بعد.'
            : '[EMOTION: NEUTRAL] خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً، يرجى المحاولة بعد قليل.'
          : isNotConfigured
            ? '[EMOTION: NEUTRAL] The chat service is not configured on the server yet.'
            : "[EMOTION: NEUTRAL] The chat service is busy right now. Please try again in a moment.";
      } else {
        const data = await res.json();
        rawAnswer = data.text || '';
      }

      // Parse emotion tag and clean spoken text
      const { emotion, cleanText } = parseCompanionResponse(rawAnswer);
      setCompanionEmotion(emotion);

      // Save companion text into history
      setChats((prev) => ({
        ...prev,
        [currentChatId]: [
          ...(prev[currentChatId] || []),
          { id: companionMessageId, sender: 'gemini', text: cleanText },
        ],
      }));

      // Speak response through TTS with live lip sync visemes
      setCurrentSpeechText(cleanText);
      companionVoice.speak(cleanText, {
        onStart: () => {
          setCompanionState('SPEAKING');
        },
        onViseme: (mouthVal) => {
          setVisemeMouthOpen(mouthVal);
        },
        onEnd: () => {
          setCompanionState('IDLE');
          setVisemeMouthOpen(0);
          setCurrentSpeechText(null);
        },
      });
    } catch (err: unknown) {
      console.error('Companion interaction error:', err);
      companionVoice.stopSpeaking();
      setCurrentSpeechText(null);
      setCompanionState('TECHNICAL_ERROR');
      setCompanionEmotion('CONFUSED');
      setVisemeMouthOpen(0);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isArabic = /[\u0600-\u06FF]/.test(query);
      const errMsg = isAbort
        ? (isArabic ? 'استغرقت الاستجابة وقتاً أطول من المعتاد، يرجى إعادة المحاولة.' : 'Request timed out. Please try again.')
        : (isArabic ? 'حدث تأخير في الاتصال، يرجى المحاولة ثانية.' : 'Connection issue. Please try again.');
      setVoiceError(errMsg);
      recoveryTimerRef.current = window.setTimeout(() => {
        setVoiceError(null);
        setCompanionState('RECOVERING');
        recoveryTimerRef.current = window.setTimeout(() => {
          recoveryTimerRef.current = null;
          setCompanionState('IDLE');
        }, 850);
      }, 3500);
    } finally {
      setLoading(false);
    }
  }, [loading, currentChatId]);

  /**
   * Voice Input Trigger (Microphone Recording)
   */
  const handleToggleVoice = useCallback(() => {
    // If companion is speaking, stop speaking immediately
    if (companionState === 'SPEAKING') {
      companionVoice.stopSpeaking();
      setCurrentSpeechText(null);
      setCompanionState('IDLE');
      setVisemeMouthOpen(0);
    }

    // If currently listening, stop
    if (companionState === 'LISTENING') {
      companionVoice.stopListening();
      setCompanionState('IDLE');
      setInterimTranscript(null);
      return;
    }

    setVoiceError(null);
    setInterimTranscript(null);
    setCompanionState('LISTENING');

    const started = companionVoice.startListening('ar', {
      onStart: () => {
        setCompanionState('LISTENING');
        setInterimTranscript(null);
      },
      onInterim: (text) => {
        setInterimTranscript(text);
      },
      onResult: (transcript) => {
        setInterimTranscript(null);
        if (transcript.trim()) {
          handleCompanionInteraction(transcript.trim());
        } else {
          setCompanionState('IDLE');
        }
      },
      onError: (err) => {
        setCompanionState('IDLE');
        setInterimTranscript(null);
        if (err === 'aborted') return;

        const messagesAr: Record<string, string> = {
          'not-allowed': 'يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح ثم المحاولة مرة أخرى.',
          'service-not-allowed': 'التعرف على الصوت محظور في هذا المتصفح. تحقق من صلاحيات الميكروفون.',
          'audio-capture': 'لم يتم العثور على ميكروفون، أو أنه قيد الاستخدام في برنامج آخر.',
          network: 'تعذر الاتصال بخدمة التعرف على الصوت. تحقق من اتصال الإنترنت.',
          'no-speech': 'لم يتم التقاط صوت واضح. اضغط على زر المايك وتحدث مجدداً.',
          'insecure-context': 'يتطلب استخدام الميكروفون اتصالاً آمناً (HTTPS).',
          'language-not-supported': 'المتصفح لا يدعم التعرف على الصوت بهذه اللغة.',
          'start-failed': 'تعذر تشغيل الميكروفون. تحقق من الصلاحيات وحاول ثانية.',
        };

        setVoiceError(messagesAr[err] || 'تعذر تشغيل الميكروفون. يمكنك كتابة رسالتك في الحقل أدناه.');
        setTimeout(() => setVoiceError(null), 5000);
      },
      onEnd: () => {
        setInterimTranscript(null);
        setCompanionState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
      },
    });

    if (!started) {
      setCompanionState('IDLE');
      setVoiceError('التعرف الصوتي المباشر غير مدعوم في هذا المتصفح. يمكنك كتابة رسالتك مباشرة.');
      setTimeout(() => setVoiceError(null), 5000);
    }
  }, [companionState, handleCompanionInteraction]);

  const handleStopSpeaking = useCallback(() => {
    companionVoice.stopSpeaking();
    setCurrentSpeechText(null);
    setCompanionState('IDLE');
    setVisemeMouthOpen(0);
  }, []);

  return (
    <div className="aether-app-shell relative w-screen h-screen overflow-hidden bg-[#06030B] text-white flex flex-col font-sans select-none">
      {/* 0. Full-Screen 3D Room & Companion Fixed Canvas Backdrop */}
      {activeView === 'home' && (
        <div className="fixed inset-0 z-0 pointer-events-auto">
          <CompanionEnvironment
            companionState={companionState}
            companionEmotion={companionEmotion}
            visemeMouthOpen={visemeMouthOpen}
            onStartInteraction={handleToggleVoice}
            companionModelUrl={primaryCharacterUrl}
            roomModelUrl={primaryEnvironmentUrl}
            currentSpeechText={currentSpeechText}
          />
        </div>
      )}

      {/* 1. TOP MINIMAL HUD BAR */}
      <header className="fixed top-0 inset-x-0 h-16 px-4 sm:px-8 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Quiet Brand Wordmark & Discrete Dev Trigger */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 p-1.5 text-xs font-mono tracking-[4px] text-white/50 hover:text-white transition-colors cursor-pointer uppercase"
            title="Home"
          >
            <span>AETHER</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDevModalOpen(true)}
            className="p-1 rounded text-white/20 hover:text-purple-300 transition-colors cursor-pointer"
            title="Internal 3D Asset Inspection (Shift + D)"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Desktop Navigation HUD */}
        <div className="hidden md:flex items-center pointer-events-auto">
          <Navigation
            currentView={activeView}
            onSelectView={navigateTo}
          />
        </div>

        {/* Right: User Authentication Pill */}
        <div className="pointer-events-auto">
          <AuthControl variant="header" />
        </div>
      </header>

      {/* 2. MAIN VIEWPORT AREA */}
      <main className="flex-1 w-full h-full relative overflow-hidden pt-16 pb-3 sm:pb-6 flex flex-col z-10 pointer-events-none">
        {activeView === 'home' && (
          <div className="relative w-full h-full flex flex-col justify-end overflow-hidden pointer-events-none">
            {/* Bottom Floating Interaction Bar (Microphone + Text + Send) */}
            <div className="relative w-full pb-1 sm:pb-3 z-20 pointer-events-auto">
              <InteractionBar
                onSendMessage={handleCompanionInteraction}
                onToggleVoice={handleToggleVoice}
                isListening={companionState === 'LISTENING'}
                isSpeaking={companionState === 'SPEAKING'}
                onStopSpeaking={handleStopSpeaking}
                loading={loading || companionState === 'THINKING'}
                voiceError={voiceError}
                interimTranscript={interimTranscript}
                onFocusChange={setIsComposerFocused}
              />
            </div>
          </div>
        )}

        {/* Wardrobe is intentionally separate from the room; chat remains voice-first and has no duplicate page. */}
        {activeView === 'wardrobe' && (
          <WardrobeView onBack={() => navigateTo('home')} />
        )}

        {activeView === 'about' && (
          <div className="flex-1 overflow-y-auto">
            <AboutView onBack={() => navigateTo('home')} />
          </div>
        )}

        {activeView === 'support' && (
          <div className="flex-1 overflow-y-auto">
            <SupportView onBack={() => navigateTo('home')} />
          </div>
        )}
      </main>

      {/* 3. MOBILE FLOATING NAVIGATION HUD (Docked at bottom on mobile) */}
      <div
        className={`fixed bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none md:hidden px-4 transition-all duration-200 ${
          isComposerFocused ? 'opacity-0 translate-y-6 pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
        <Navigation
          currentView={activeView}
          onSelectView={navigateTo}
        />
      </div>

      {/* 4. ISOLATED DEVELOPER MODE INSPECTION MODAL (Hidden from end users) */}
      <DeveloperInspectionModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
      />
    </div>
  );
}
