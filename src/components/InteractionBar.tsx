import React, { useLayoutEffect, useRef, useState } from 'react';
import { Send, Mic, MicOff, Square, Loader2 } from 'lucide-react';

interface InteractionBarProps {
  onSendMessage: (query: string) => void;
  onToggleVoice: () => void;
  isListening?: boolean;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
  loading?: boolean;
  disabled?: boolean;
  voiceError?: string | null;
}

export const InteractionBar: React.FC<InteractionBarProps> = ({
  onSendMessage,
  onToggleVoice,
  isListening = false,
  isSpeaking = false,
  onStopSpeaking,
  loading = false,
  disabled = false,
  voiceError = null,
}) => {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = 'auto';
    const maxHeight = 128;
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputVal]);

  const handleSend = () => {
    if (!inputVal.trim() || loading || disabled) return;
    onSendMessage(inputVal.trim());
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 flex flex-col items-center gap-1.5">
      {voiceError && (
        <div className="text-[11px] text-rose-300 font-medium px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 backdrop-blur-md animate-in fade-in duration-200">
          {voiceError}
        </div>
      )}

      <div
        className={`w-full crystal-surface rounded-[1.75rem] p-1.5 sm:p-2 flex items-end gap-2 border transition-all duration-300 shadow-[0_12px_40px_-6px_rgba(0,0,0,0.65)] ${
          isListening
            ? 'border-cyan-500/50 shadow-[0_0_25px_-2px_rgba(6,182,212,0.4)]'
            : isSpeaking
            ? 'border-emerald-500/40 shadow-[0_0_25px_-2px_rgba(16,185,129,0.3)]'
            : 'border-white/[0.08]'
        }`}
      >
        {/* Voice Input (Microphone) Action Button */}
        <button
          type="button"
          onClick={onToggleVoice}
          disabled={disabled || loading}
          aria-label={isListening ? 'Stop listening' : 'Start speaking'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 cursor-pointer active:scale-95 ${
            isListening
              ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-pulse'
              : 'text-white/60 hover:text-purple-300 hover:bg-white/[0.08]'
          }`}
          title={isListening ? 'Listening... click to stop' : 'Tap to speak'}
        >
          {isListening ? (
            <MicOff className="w-4 h-4 text-black" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Minimal Text Input */}
        <div className="relative min-w-0 flex-1 flex items-center">
          <textarea
            ref={inputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            rows={1}
            dir="auto"
            aria-label="Message Aether"
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : isSpeaking
                ? 'Aether is speaking...'
                : 'Speak or type to Aether...'
            }
            className="block max-h-32 min-h-10 w-full resize-none overflow-x-hidden bg-transparent px-3 py-2 text-base leading-6 text-white placeholder-white/35 focus:outline-none disabled:cursor-not-allowed md:text-sm"
          />
        </div>

        {/* Stop Speaking Interruption Button if Companion is Speaking */}
        {isSpeaking && onStopSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            aria-label="Stop companion speech"
            title="Stop companion speech"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer mr-1"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        )}

        {/* Send Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputVal.trim() || loading || disabled}
          aria-label="Send message"
          className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all duration-150 shadow-[0_0_20px_-2px_rgba(168,85,247,0.5)] flex-shrink-0 cursor-pointer active:scale-95"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
