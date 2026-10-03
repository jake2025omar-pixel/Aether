import React, { useState } from 'react';
import { Send, Mic } from 'lucide-react';

interface InteractionBarProps {
  onSendMessage: (query: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export const InteractionBar: React.FC<InteractionBarProps> = ({
  onSendMessage,
  loading = false,
  disabled = false,
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSend = () => {
    if (!inputVal.trim() || loading || disabled) return;
    onSendMessage(inputVal.trim());
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4">
      <div className="crystal-surface rounded-full p-1.5 sm:p-2 flex items-center gap-2 border border-white/[0.08] shadow-[0_12px_40px_-6px_rgba(0,0,0,0.6)]">
        {/* Visual Microphone Button (Phase 04 design system placeholder only - no audio logic) */}
        <button
          type="button"
          aria-label="Voice Input"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/50 hover:text-purple-300 hover:bg-white/[0.06] transition-colors cursor-pointer flex-shrink-0"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* Minimal Text Input */}
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            placeholder="Type to Aether..."
            className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-white/35 focus:outline-none disabled:cursor-not-allowed"
          />
        </div>

        {/* Send Action Button */}
        <button
          onClick={handleSend}
          disabled={!inputVal.trim() || loading || disabled}
          aria-label="Send message"
          className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all duration-150 shadow-[0_0_20px_-2px_rgba(168,85,247,0.5)] flex-shrink-0 cursor-pointer active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
