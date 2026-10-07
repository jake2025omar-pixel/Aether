import React, { useState } from 'react';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';

interface SupportViewProps {
  onBack: () => void;
}

const TRC20_ADDRESS = 'TKAWh7LiJY8wEcQ9r6N9e9DasfEEXxDStu';
const EVM_ADDRESS = 'XKO5b41cb1fc2f7442889b3c972d63efcf4fecc92b2';

export const SupportView: React.FC<SupportViewProps> = ({ onBack }) => {
  const [copiedTRC, setCopiedTRC] = useState(false);
  const [copiedEVM, setCopiedEVM] = useState(false);

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
    <div className="w-full min-h-full flex flex-col items-center justify-start px-4 sm:px-6 py-6 sm:py-10 max-w-xl mx-auto z-10">
      {/* Top Bar / Back Navigation */}
      <div className="w-full flex items-center justify-between mb-8 sm:mb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full crystal-surface text-xs font-medium text-white/70 hover:text-white hover:border-purple-400/30 transition-colors cursor-pointer active:scale-95"
          aria-label="Back to Home"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <span className="text-xs tracking-[4px] text-white/40 font-extralight uppercase">
          AETHER
        </span>
      </div>

      {/* Main Container */}
      <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-2xl font-extralight tracking-[4px] text-white uppercase">
            Support Aether
          </h1>
          <p className="text-xs sm:text-sm text-white/50 font-light max-w-md mx-auto leading-relaxed">
            Support is entirely voluntary for those who wish to assist with project development and server maintenance.
          </p>
          <p lang="ar" dir="rtl" className="text-xs sm:text-sm text-white/60 font-light max-w-md mx-auto leading-relaxed">
            من فضلكم ادعموا مشروع إيثر لتغطية تكاليف استضافة الخادم. دعمكم اختياري ويساعدنا على مواصلة تطوير Aether.
          </p>
        </div>

        {/* Support Methods */}
        <div className="space-y-4">
          {/* Method 1: OKX USDT TRC20 */}
          <GlassCard className="p-5 border-white/[0.08] bg-black/30">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-medium text-white">USDT (TRC20)</span>
              <span className="text-purple-300 font-mono text-[11px]">OKX</span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-white/80 break-all select-all text-left mb-3">
              {TRC20_ADDRESS}
            </div>

            <button
              onClick={() => handleCopy(TRC20_ADDRESS, 'trc')}
              className="w-full py-2 px-3 rounded-xl crystal-surface hover:bg-white/[0.08] text-xs font-medium text-white transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95 hover:border-purple-400/35"
            >
              {copiedTRC ? (
                <>
                  <Check className="w-3.5 h-3.5 text-purple-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white/50" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </GlassCard>

          {/* Method 2: Payoneer / EVM */}
          <GlassCard className="p-5 border-white/[0.08] bg-black/30">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-medium text-white">EVM (Ethereum / Polygon / BNB)</span>
              <span className="text-purple-300 font-mono text-[11px]">Payoneer</span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs text-white/80 break-all select-all text-left mb-3">
              {EVM_ADDRESS}
            </div>

            <button
              onClick={() => handleCopy(EVM_ADDRESS, 'evm')}
              className="w-full py-2 px-3 rounded-xl crystal-surface hover:bg-white/[0.08] text-xs font-medium text-white transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-95 hover:border-purple-400/35"
            >
              {copiedEVM ? (
                <>
                  <Check className="w-3.5 h-3.5 text-purple-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white/50" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </GlassCard>

          {/* Quiet Note */}
          <p className="text-center text-[11px] text-white/40 font-light pt-2">
            Deposit to Payoneer via OKX intermediary (TRC20)
          </p>
        </div>
      </div>
    </div>
  );
};
