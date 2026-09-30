import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView, ChatMessage } from './components/ChatView';
import { HeroView } from './components/HeroView';
import { SupportDrawer } from './components/SupportDrawer';
import { AboutModal } from './components/AboutModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Default to hero so the user lands on the colorful Givingli-style Bento Grid!
  const [activeView, setActiveView] = useState<'chat' | 'hero'>('hero');
  const [supportOpen, setSupportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Manage chat sessions
  const [currentChatId, setCurrentChatId] = useState<string>('default-session');
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({
    'default-session': [],
  });
  const [chatHistory, setChatHistory] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-collapse sidebar on smaller screens on mount
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const handleNewChat = () => {
    const newId = 'chat-' + Date.now();
    setChats((prev) => ({ ...prev, [newId]: [] }));
    setCurrentChatId(newId);
    setActiveView('chat');
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
    setActiveView('chat');
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory((prev) => prev.filter((c) => c.id !== id));
    setChats((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (currentChatId === id) {
      const remaining = chatHistory.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setCurrentChatId(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  const handleClearAllChats = () => {
    setChatHistory([]);
    const freshId = 'chat-' + Date.now();
    setChats({ [freshId]: [] });
    setCurrentChatId(freshId);
  };

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || loading) return;

    setActiveView('chat');

    const userMessageId = 'u-' + Date.now();
    const geminiMessageId = 'g-' + Date.now();

    const currentMessages = chats[currentChatId] || [];
    const isFirstMessage = currentMessages.length === 0;

    // Update messages in state
    setChats((prev) => ({
      ...prev,
      [currentChatId]: [
        ...(prev[currentChatId] || []),
        { id: userMessageId, sender: 'user', text: query },
        { id: geminiMessageId, sender: 'gemini', text: '' },
      ],
    }));

    // Update history title if first message
    if (isFirstMessage) {
      const title = query.length > 28 ? query.substring(0, 28) + '...' : query;
      setChatHistory((prev) => [{ id: currentChatId, title }, ...prev]);
    }

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

      // If streaming response was somehow empty, fallback to non-streaming call
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
                text: 'عذراً، حدث خطأ أثناء الاتصال بمحرك Gemini 1.5 Flash. يرجى المحاولة ثانية.',
              }
            : msg
        ),
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#FFFCF5] overflow-hidden text-slate-800 font-sans">
      {/* 1. LEFT SIDEBAR (260px, White #FFFFFF, collapsible) */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleToggleSidebar}
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onOpenSupport={() => {
          setSupportOpen(true);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onOpenAbout={() => {
          setAboutOpen(true);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setSettingsOpen(true);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        chatHistory={chatHistory}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* 2. MAIN AREA (Creamy white #FFFCF5) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#FFFCF5] relative">
        {activeView === 'chat' ? (
          <ChatView
            onToggleSidebar={handleToggleSidebar}
            messages={chats[currentChatId] || []}
            onSendMessage={handleSendMessage}
            loading={loading}
          />
        ) : (
          <HeroView
            onToggleSidebar={handleToggleSidebar}
            onStartChat={() => setActiveView('chat')}
          />
        )}
      </main>

      {/* 3. SUPPORT DRAWER (White Bento Style, slides from right when "الدعم" is clicked) */}
      <SupportDrawer
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
      />

      {/* 4. ABOUT MODAL ("حول") */}
      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* 5. SETTINGS MODAL */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClearAllChats={handleClearAllChats}
      />
    </div>
  );
}
