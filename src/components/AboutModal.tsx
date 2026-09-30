import React from 'react';
import { X, Sparkles, Zap, Shield } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-[#FFFFFF] border border-[#F0ECE1] rounded-3xl p-6 sm:p-7 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE1]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              A
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">حول AetherAI</h3>
              <p className="text-xs text-purple-600 font-medium">منصة ذكاء اصطناعي مجانية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-5 space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p>
            منصة <strong className="text-slate-900 font-bold">AetherAI</strong> مبنية لتزويد المبدعين ورواد الأعمال والمطورين بأحدث قدرات الذكاء الاصطناعي عبر نموذج <strong className="text-purple-700">Gemini 1.5 Flash</strong> فائق السرعة وبشكل مجاني بالكامل.
          </p>

          <div className="p-3.5 rounded-2xl bg-[#E8D5FF]/40 border border-purple-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
              <Zap className="w-4 h-4 text-[#7C3AED]" />
              <span>استجابة فائقة السرعة</span>
            </div>
            <p className="text-purple-900/80 text-xs">
              تدفق لحظي للردود البرمجية وتوليد الأفكار والاستشارات بدون قيود اشتراك.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#D4F5C5]/40 border border-green-200 space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>مجاني ومدعوم بالمجتمع</span>
            </div>
            <p className="text-emerald-900/80 text-xs">
              يتم تشغيل الخوادم وتطوير المنصة بفضل الدعم اللامركزي عبر شبكة TRC20.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm"
        >
          فهمت، شكراً لك
        </button>
      </div>
    </div>
  );
};
