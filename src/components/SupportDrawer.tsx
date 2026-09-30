import React, { useState } from 'react';
import { X, Copy, Check, Heart, AlertCircle, Shield } from 'lucide-react';

interface SupportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TRC20_ADDRESS = 'TKAWh7LiJY8wEcQ9r6N9e9DasfEEXxDStu';
const EVM_ADDRESS = 'XKO5b41cb1fc2f7442889b3c972d63efcf4fecc92b2';

export const SupportDrawer: React.FC<SupportDrawerProps> = ({ isOpen, onClose }) => {
  const [copiedTRC, setCopiedTRC] = useState(false);
  const [copiedEVM, setCopiedEVM] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (address: string, type: 'trc' | 'evm') => {
    navigator.clipboard.writeText(address);
    if (type === 'trc') {
      setCopiedTRC(true);
      setTimeout(() => setCopiedTRC(false), 2000);
    } else {
      setCopiedEVM(true);
      setTimeout(() => setCopiedEVM(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container (White Bento Style, Slides from right, 300ms) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          className="w-screen max-w-md bg-[#FFFFFF] border-l border-[#F0ECE1] shadow-2xl p-6 sm:p-7 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300"
          dir="rtl"
        >
          {/* Header */}
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-[#F0ECE1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-pink-100 border border-pink-200 flex items-center justify-center text-pink-600">
                  <Heart className="w-5 h-5 fill-pink-500" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">ادعم المشروع</h2>
                  <p className="text-xs text-slate-500 font-medium">مبادرة مجانية لدعم مجتمع المطورين والرواد</p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pastel Bento Boxes for Addresses */}
            <div className="mt-6 space-y-4">
              {/* TRC20 Box (Soft Pastel Lavender/Emerald Bento) */}
              <div className="p-5 rounded-3xl bg-[#E8D5FF]/50 border border-purple-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    USDT TRC20 (Tron)
                  </span>
                  <span className="text-[11px] font-bold text-purple-700 bg-white/80 px-2 py-0.5 rounded-full">
                    الشبكة المفضلة
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-purple-200 font-mono text-xs sm:text-sm text-purple-950 break-all select-all mb-3 text-left shadow-xs">
                  {TRC20_ADDRESS}
                </div>

                <button
                  onClick={() => handleCopy(TRC20_ADDRESS, 'trc')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-[#7C3AED]/25 cursor-pointer"
                >
                  {copiedTRC ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>تم نسخ العنوان بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ عنوان TRC20</span>
                    </>
                  )}
                </button>
              </div>

              {/* EVM Box (Soft Pastel Pink/Sky Bento) */}
              <div className="p-5 rounded-3xl bg-[#C5E8FF]/40 border border-blue-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    EVM (Ethereum / BNB / Polygon)
                  </span>
                  <span className="text-[11px] font-semibold text-blue-700 bg-white/80 px-2 py-0.5 rounded-full">
                    محفظة EVM
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-blue-200 font-mono text-xs sm:text-sm text-blue-950 break-all select-all mb-3 text-left shadow-xs">
                  {EVM_ADDRESS}
                </div>

                <button
                  onClick={() => handleCopy(EVM_ADDRESS, 'evm')}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 border border-blue-300 text-blue-900 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-xs"
                >
                  {copiedEVM ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">تم نسخ العنوان بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ عنوان EVM</span>
                    </>
                  )}
                </button>
              </div>

              {/* Note: Required text in soft pastel yellow banner */}
              <div className="p-4 rounded-2xl bg-[#FFE78A]/40 border border-amber-300 text-amber-950 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <p className="font-semibold">
                  إيداع إلى بايونير عبر وسيط OKX - TRC20
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Button */}
          <div className="pt-6 border-t border-[#F0ECE1] mt-6">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
