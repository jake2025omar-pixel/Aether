import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { CrystalSurface } from './ui/CrystalSurface';

interface AboutViewProps {
  onBack: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onBack }) => {
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
      <article className="w-full flex flex-col items-center text-center space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Page Title */}
        <h1 className="text-xl sm:text-2xl font-extralight tracking-[4px] text-white uppercase">
          About Aether
        </h1>

        {/* Authentic Dr. Kenzo Tenma Visual Image from Anime Monster */}
        <CrystalSurface
          rounded="card"
          glow={true}
          className="p-2 sm:p-3 max-w-[220px] sm:max-w-[240px] flex items-center justify-center bg-black/40 border-white/[0.1]"
        >
          <img
            src="/assets/kenzo_tenma.png"
            alt="Dr. Kenzo Tenma — Monster"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Fallback to AniList verified official character image CDN if local path is unavailable
              (e.currentTarget as HTMLImageElement).src =
                'https://s4.anilist.co/file/anilistcdn/character/large/b718-b6ZZVp822lw0.png';
            }}
            className="w-full h-auto rounded-xl object-contain select-none shadow-md"
          />
        </CrystalSurface>

        {/* Philosophy Message */}
        <div className="space-y-3 max-w-md px-4">
          <p className="text-base sm:text-lg font-light text-white/90 leading-relaxed">
            Aether exists to help fight loneliness,
            <br />
            and to be a friend to humanity.
          </p>

          <p className="text-sm sm:text-base font-light text-purple-300 tracking-wide">
            All of this, for humanity.
          </p>
        </div>
      </article>
    </div>
  );
};
