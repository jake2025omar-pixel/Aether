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
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewportBaselineRef = useRef(0);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = Number.parseFloat(window.getComputedStyle(textarea).maxHeight) || 144;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputVal]);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const visibleHeight = () => viewport.height + (viewport.offsetTop || 0);
    const readLayoutHeight = () => visibleHeight();
    viewportBaselineRef.current = readLayoutHeight();

    const isComposerFocused = () => document.activeElement === textareaRef.current;
    const handleViewportChange = () => {
      if (!isComposerFocused()) {
        viewportBaselineRef.current = readLayoutHeight();
        setKeyboardOffset(0);
        return;
      }

      const baseline = viewportBaselineRef.current || readLayoutHeight();
      const offset = Math.max(0, baseline - visibleHeight());
      setKeyboardOffset(offset > 80 ? offset : 0);
    };

    const handleFocus = () => {
      // Capture the pre-keyboard size before the visual viewport begins shrinking.
      viewportBaselineRef.current = readLayoutHeight();
      requestAnimationFrame(handleViewportChange);
    };
    const handleBlur = () => window.setTimeout(handleViewportChange, 120);

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    const textarea = textareaRef.current;
    textarea?.addEventListener('focus', handleFocus);
    textarea?.addEventListener('blur', handleBlur);

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      textarea?.removeEventListener('focus', handleFocus);
      textarea?.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleSend = () => {
    const message = inputVal.trim();
    if (!message || loading || disabled) return;
    onSendMessage(message);
    setInputVal('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        transition: 'transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}
      className="w-full max-w-xl mx-auto px-4 flex flex-col items-center gap-1.5"
    >
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
          {isListening ? <MicOff className="w-4 h-4 text-black" /> : <Mic className="w-4 h-4" />}
        </button>

        <div className="relative flex-1 min-w-0 flex items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            dir="auto"
            maxLength={2000}
            value={inputVal}
            onChange={(event) => setInputVal(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            aria-label="Message Aether"
            placeholder={
              isListening
                ? 'Listening to your voice...'
                : isSpeaking
                  ? 'Aether is speaking...'
                  : 'Speak or type to Aether...'
            }
            className="w-full max-h-[40svh] min-h-10 resize-none overflow-x-hidden overflow-y-hidden break-words bg-transparent px-3 py-2 text-base sm:text-sm leading-6 text-white placeholder-white/35 focus:outline-none disabled:cursor-not-allowed [overflow-wrap:anywhere]"
          />
        </div>

        {isSpeaking && onStopSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            aria-label="Stop companion speech"
            title="Stop companion speech"
            className="w-8 h-8 mb-1 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer mr-1"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!inputVal.trim() || loading || disabled}
          aria-label="Send message"
          className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition-all duration-150 shadow-[0_0_20px_-2px_rgba(168,85,247,0.5)] flex-shrink-0 cursor-pointer active:scale-95"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
