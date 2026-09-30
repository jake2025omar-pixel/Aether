import React, { useState } from 'react';
import { X, Cpu, Trash2, CheckCircle2, ShieldCheck, Zap, Loader2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllChats: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearAllChats,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'قل جملة واحدة تؤكد أنك متصل وشغال',
          stream: false,
        }),
      });
      const data = await res.json();
      if (data.text) {
        setTestResult('✅ النموذج متصل ويعمل بنجاح: ' + data.text.substring(0, 40));
      } else {
        setTestResult('⚠️ تعذر استلام رد، تحقق من الخادم.');
      }
    } catch {
      setTestResult('❌ خطأ في الاتصال بالخادم.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-[#FFFFFF] border border-[#F0ECE1] rounded-3xl p-6 sm:p-7 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#F0ECE1]">
          <h3 className="text-base font-bold text-slate-900">إعدادات المنصة ومفتاح الذكاء الاصطناعي</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-5 space-y-4 text-xs sm:text-sm text-slate-600">
          {/* Active Model Card */}
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-[#7C3AED]" />
              <div>
                <div className="font-bold text-slate-900">النموذج الذكي</div>
                <div className="text-[11px] text-purple-700 font-medium">Gemini Flash (أحدث إصدار فائق السرعة)</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>نشط</span>
            </div>
          </div>

          {/* Secure Backend Key Status Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>حالة مفتاح Gemini API</span>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                مربوط بأمان بالخادم
              </span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed mb-3">
              تم تثبيت وربط مفتاحك الخاص في الخادم الخلفي الآمن بنجاح. لا تحتاج للبحث عن صفحة Secrets أو لصقه يدوياً في كل مرة!
            </p>

            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري فحص الاتصال بالنموذج...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>اختبار اتصال Gemini الآن</span>
                </>
              )}
            </button>

            {testResult && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-semibold text-emerald-900 text-center animate-in fade-in">
                {testResult}
              </div>
            )}
          </div>

          {/* Clear Chats Card */}
          <div className="p-4 rounded-2xl bg-[#FFF9F9] border border-red-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">مسح كافة المحادثات</div>
              <div className="text-[11px] text-slate-500">إعادة ضبط سجل المحادثات بالكامل</div>
            </div>
            <button
              onClick={() => {
                onClearAllChats();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};
