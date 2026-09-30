import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  ArrowUp,
  Paperclip,
  Copy,
  Check,
  Sparkles,
  Bot,
  User,
  Loader2,
  ChevronDown,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
}

interface ChatViewProps {
  onToggleSidebar: () => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  loading: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  onToggleSidebar,
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#FFFCF5] text-slate-800 overflow-hidden relative font-sans">
      {/* Top Bar Minimal (Light Mode) */}
      <header className="h-14 border-b border-[#F0ECE1] flex items-center justify-between px-3 sm:px-4 z-10 bg-[#FFFCF5]/90 backdrop-blur-md">
        {/* Left: Hamburger Button (Always visible) */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-600 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
          title="قائمة التنقل"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Center: Model Name */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-black/5 cursor-pointer transition-colors border border-purple-200/60 bg-purple-50/60">
          <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
          <span className="font-semibold text-xs sm:text-sm text-purple-950">
            AetherAI - Gemini 1.5 Flash Free
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
        </div>

        {/* Right placeholder to keep model centered */}
        <div className="w-9" />
      </header>

      {/* Messages Scroll Area (Centered max-width 768px) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-[768px] mx-auto w-full flex flex-col space-y-6">
          {/* Empty state greeting when no messages */}
          {messages.length === 0 && (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#7C3AED] flex items-center justify-center text-white mb-4 shadow-xl shadow-[#7C3AED]/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
                كيف يمكنني مساعدتك اليوم؟
              </h2>
              <p className="text-sm text-slate-500 max-w-md">
                محرك ذكاء اصطناعي فائق السرعة عبر Gemini 1.5 Flash مجاناً لتحويل أفكارك إلى نجاح رقمي.
              </p>

              {/* Quick Prompt Cards with Pastel Tones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-xl text-right" dir="rtl">
                <button
                  onClick={() => onSendMessage('اقترح خطة إطلاق مشروع SaaS من الصفر')}
                  className="p-4 rounded-2xl bg-[#FFFFFF] hover:bg-[#FDF9F0] border border-[#EDE8DC] text-xs sm:text-sm text-slate-700 transition-all text-right shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                    <span>خطة إطلاق مشروع SaaS</span>
                  </div>
                  <div className="text-slate-500 text-xs">من الفكرة إلى النموذج الأولي المربح</div>
                </button>

                <button
                  onClick={() => onSendMessage('اكتب كود React + Tailwind عصري وجميل')}
                  className="p-4 rounded-2xl bg-[#FFFFFF] hover:bg-[#FDF9F0] border border-[#EDE8DC] text-xs sm:text-sm text-slate-700 transition-all text-right shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                    <span>توليد أكواد برمجية نظيفة</span>
                  </div>
                  <div className="text-slate-500 text-xs">TypeScript، واجهات وتكاملات برمجية</div>
                </button>

                <button
                  onClick={() => onSendMessage('كيف أستفيد من شبكة TRC20 في المعاملات المالية؟')}
                  className="p-4 rounded-2xl bg-[#FFFFFF] hover:bg-[#FDF9F0] border border-[#EDE8DC] text-xs sm:text-sm text-slate-700 transition-all text-right shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>استخدام شبكة TRC20</span>
                  </div>
                  <div className="text-slate-500 text-xs">رسوم منخفضة وتأكيد فوري عبر OKX</div>
                </button>

                <button
                  onClick={() => onSendMessage('لخص استراتيجية نمو رقمي مبتكرة لهذا العام')}
                  className="p-4 rounded-2xl bg-[#FFFFFF] hover:bg-[#FDF9F0] border border-[#EDE8DC] text-xs sm:text-sm text-slate-700 transition-all text-right shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span>استراتيجيات النمو الرقمي</span>
                  </div>
                  <div className="text-slate-500 text-xs">تسويق، أتمتة، واستقطاب العملاء</div>
                </button>
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {isUser ? (
                  /* User message: soft rounded bubble */
                  <div
                    className="max-w-[80%] sm:max-w-[70%] bg-[#F0ECE1] text-slate-900 px-5 py-3 rounded-[24px] text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap shadow-xs text-right"
                    dir="auto"
                  >
                    {msg.text}
                  </div>
                ) : (
                  /* AI message: transparent with purple avatar on left, with copy button */
                  <div className="w-full flex items-start gap-3 sm:gap-4 py-2">
                    {/* Purple Avatar on Left */}
                    <div className="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm shadow-[#7C3AED]/30">
                      <Sparkles className="w-4 h-4" />
                    </div>

                    {/* AI Message Content */}
                    <div className="flex-1 min-w-0 space-y-2 text-right" dir="auto">
                      <div className="text-sm sm:text-base text-slate-800 leading-relaxed break-words whitespace-pre-wrap bg-white/70 p-4 sm:p-5 rounded-2xl border border-[#EDE8DC] shadow-xs">
                        {msg.text || (
                          <div className="flex items-center gap-2 text-purple-700 py-1" dir="rtl">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-semibold">جاري الكتابة عبر Gemini Flash...</span>
                          </div>
                        )}
                      </div>

                      {/* Copy button under each AI message */}
                      {msg.text && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="نسخ الرسالة"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 text-[11px] font-semibold">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-medium">نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Input (Fixed bottom, centered max-width 768px, rounded 28px pill shape, background #FFFFFF) */}
      <div className="w-full pb-4 px-4 z-10 bg-gradient-to-t from-[#FFFCF5] via-[#FFFCF5]/90 to-transparent pt-3">
        <div className="max-w-[768px] mx-auto w-full">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center gap-2 bg-[#FFFFFF] rounded-[28px] px-3.5 py-2 shadow-lg shadow-black/[0.04] border border-[#E5E0D5] focus-within:border-[#7C3AED]/70 transition-colors"
          >
            {/* Attachment Icon */}
            <button
              type="button"
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 cursor-pointer"
              title="إرفاق ملف"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input field */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputResize}
              onKeyDown={handleKeyDown}
              placeholder="اسأل أي شيء..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm sm:text-base text-slate-800 placeholder-slate-400 outline-none resize-none py-1.5 max-h-[160px] text-right"
              dir="rtl"
            />

            {/* Send Arrow Button Inside Input (Purple #7C3AED) */}
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                input.trim() && !loading
                  ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-md shadow-[#7C3AED]/30'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              aria-label="إرسال"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </form>

          {/* Footnote */}
          <div className="text-[11px] text-slate-400 text-center mt-2 font-medium">
            قد يقدم AetherAI معلومات غير دقيقة. يرجى التحقق من المعلومات المهمة.
          </div>
        </div>
      </div>
    </div>
  );
};
