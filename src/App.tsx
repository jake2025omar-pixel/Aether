import React, { useState } from 'react';
import { ChatView, ChatMessage } from './components/ChatView';
import { CompanionEnvironment } from './components/CompanionEnvironment';
import { InteractionBar } from './components/InteractionBar';
import { AboutView } from './components/AboutView';
import { SupportView } from './components/SupportView';
import { Navigation, NavDestination } from './components/ui/Navigation';
import { AuthControl } from './components/AuthControl';
import { AtmosphericSpace } from './components/AtmosphericSpace';

export default function App() {
  const [activeView, setActiveView] = useState<NavDestination>('home');

  // Manage chat session
  const [currentChatId, setCurrentChatId] = useState<string>('default-session');
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({
    'default-session': [],
  });
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || loading) return;

    setActiveView('chat');

    const userMessageId = 'u-' + Date.now();
    const geminiMessageId = 'g-' + Date.now();

    const currentMessages = chats[currentChatId] || [];

    // Update messages in state
    setChats((prev) => ({
      ...prev,
      [currentChatId]: [
        ...(prev[currentChatId] || []),
        { id: userMessageId, sender: 'user', text: query },
        { id: geminiMessageId, sender: 'gemini', text: '' },
      ],
    }));

    setLoading(true);

    try {
      const historyPayload = currentMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No readable stream returned');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedAnswer = '';

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.replace('data: ', '').trim());
              if (data.text) {
                streamedAnswer += data.text;
                setChats((prev) => ({
                  ...prev,
                  [currentChatId]: (prev[currentChatId] || []).map((msg) =>
                    msg.id === geminiMessageId ? { ...msg, text: streamedAnswer } : msg
                  ),
                }));
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Ignore non-json
            }
          }
        }
      }

      // If streaming response was empty, fallback to non-streaming call
      if (!streamedAnswer.trim()) {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            history: historyPayload,
            stream: false,
          }),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.text) {
            streamedAnswer = fallbackData.text;
            setChats((prev) => ({
              ...prev,
              [currentChatId]: (prev[currentChatId] || []).map((msg) =>
                msg.id === geminiMessageId ? { ...msg, text: streamedAnswer } : msg
              ),
            }));
          }
        }
      }
    } catch (err: unknown) {
      console.error('Chat error:', err);
      setChats((prev) => ({
        ...prev,
        [currentChatId]: (prev[currentChatId] || []).map((msg) =>
          msg.id === geminiMessageId
            ? {
                ...msg,
                text: 'Connection to server failed. Please try again.',
              }
            : msg
        ),
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07050D] text-white flex flex-col font-sans select-none">
      {/* Dynamic Cosmic Atmosphere & Pointer Splat Background */}
      <AtmosphericSpace />

      {/* 1. TOP MINIMAL HUD BAR */}
      <header className="fixed top-0 inset-x-0 h-16 px-4 sm:px-8 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Quiet Brand Wordmark */}
        <div className="pointer-events-auto">
          <button
            onClick={() => setActiveView('home')}
            className="flex items-center gap-2 p-1.5 text-xs font-mono tracking-[4px] text-white/50 hover:text-white transition-colors cursor-pointer uppercase"
            title="Home"
          >
            <span>AETHER</span>
          </button>
        </div>

        {/* Center: Desktop Navigation HUD */}
        <div className="hidden md:flex items-center pointer-events-auto">
          <Navigation
            currentView={activeView}
            onSelectView={setActiveView}
          />
        </div>

        {/* Right: User Authentication Pill */}
        <div className="pointer-events-auto">
          <AuthControl variant="header" />
        </div>
      </header>

      {/* 2. MAIN VIEWPORT AREA */}
      <main className="flex-1 w-full h-full relative overflow-hidden pt-16 pb-20 md:pb-6 flex flex-col z-10">
        {activeView === 'home' && (
          <div className="relative w-full h-full flex flex-col justify-between">
            {/* Center Anchor: Quister Landing Hero Crystal Surface */}
            <div className="flex-1 flex items-center justify-center">
              <CompanionEnvironment
                onStartInteraction={() => setActiveView('chat')}
              />
            </div>

            {/* Bottom Floating Interaction Bar */}
            <div className="w-full pb-4 sm:pb-8 z-20">
              <InteractionBar
                onSendMessage={handleSendMessage}
                loading={loading}
              />
            </div>
          </div>
        )}

        {activeView === 'chat' && (
          <ChatView
            onBackToEnvironment={() => setActiveView('home')}
            messages={chats[currentChatId] || []}
            onSendMessage={handleSendMessage}
            loading={loading}
          />
        )}

        {activeView === 'about' && (
          <div className="flex-1 overflow-y-auto">
            <AboutView onBack={() => setActiveView('home')} />
          </div>
        )}

        {activeView === 'support' && (
          <div className="flex-1 overflow-y-auto">
            <SupportView onBack={() => setActiveView('home')} />
          </div>
        )}
      </main>

      {/* 3. MOBILE FLOATING NAVIGATION HUD (Docked at bottom on mobile) */}
      <div className="fixed bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none md:hidden px-4">
        <Navigation
          currentView={activeView}
          onSelectView={setActiveView}
        />
      </div>
    </div>
  );
}
