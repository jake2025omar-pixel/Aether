import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Bot,
  User,
  Loader2,
  Mic,
  Send,
} from 'lucide-react';
import { AuthControl } from './AuthControl';
import { CrystalSurface } from './ui/CrystalSurface';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
}

interface ChatViewProps {
  onBackToEnvironment: () => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  loading: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  onBackToEnvironment,
  messages,
  onSendMessage,
  loading,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative select-none z-10">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 z-20 bg-[#07050D]/80 backdrop-blur-md">
        <button
          onClick={onBackToEnvironment}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full crystal-surface hover:bg-white/[0.08] hover:border-purple-400/30 text-xs font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Back to Home"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <span className="text-xs font-mono tracking-[4px] text-white/40 uppercase">
          AETHER
        </span>

        {/* User Account */}
        <AuthControl variant="header" />
      </header>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 max-w-2xl w-full mx-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
            <p className="text-xs text-white/60 font-light">
              Begin a conversation with Aether.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 items-start animate-in fade-in duration-200 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs border ${
                    isUser
                      ? 'bg-purple-600/30 border-purple-400/40 text-purple-200'
                      : 'bg-white/[0.06] border-white/[0.1] text-purple-300'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Bubble Container */}
                <div
                  className={`relative group max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 sm:p-3.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-purple-600/25 border border-purple-400/30 text-white rounded-tr-sm'
                      : 'crystal-surface text-white/90 rounded-tl-sm'
                  }`}
                >
                  {/* Message Text */}
                  <div className="whitespace-pre-wrap select-text font-sans">
                    {msg.text || (
                      <span className="flex items-center gap-1.5 text-purple-300 text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Aether is thinking...</span>
                      </span>
                    )}
                  </div>

                  {/* Copy Button */}
                  {!isUser && msg.text && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] flex items-center justify-end">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-white/50 hover:text-white transition-opacity flex items-center gap-1 text-[11px] cursor-pointer"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-purple-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Input Area */}
      <div className="p-3 sm:p-4 z-20">
        <div className="max-w-2xl mx-auto">
          <CrystalSurface
            rounded="card"
            className="p-1.5 sm:p-2 flex items-end gap-2 border-white/[0.1] shadow-xl"
          >
            {/* Visual Mic Button */}
            <button
              type="button"
              aria-label="Voice Input"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-purple-300 hover:bg-white/[0.06] transition-colors cursor-pointer flex-shrink-0"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Auto-growing Textarea */}
            <div className="flex-1 flex items-center min-h-[44px]">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputResize}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Type to Aether..."
                className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none resize-none max-h-36 disabled:cursor-not-allowed"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all duration-150 shadow-[0_0_18px_-2px_rgba(168,85,247,0.5)] flex-shrink-0 cursor-pointer active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </CrystalSurface>
        </div>
      </div>
    </div>
  );
};
