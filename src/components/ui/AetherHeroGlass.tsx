import React from 'react';
import { Sparkles } from 'lucide-react';
import { CrystalSurface } from './CrystalSurface';
import { UIColors, UITokens } from '../../styles/tokens';

export interface AetherHeroGlassProps {
  onClick?: () => void;
  className?: string;
}

export const AetherHeroGlass: React.FC<AetherHeroGlassProps> = ({
  onClick,
  className = '',
}) => {
  return (
    <CrystalSurface
      rounded="hero"
      glow={true}
      onClick={onClick}
      className={`p-8 flex flex-col items-center justify-center select-none ${
        onClick ? 'cursor-pointer hover:border-purple-400/30 transition-all duration-300' : ''
      } ${className}`}
      style={{
        padding: `${UITokens.padding.hero}px`,
      }}
    >
      {/* 80px auto-awesome (Sparkles) icon in UIColors.lavender */}
      <Sparkles
        size={UITokens.typography.heroIconSize}
        color={UIColors.lavender}
        className="drop-shadow-[0_0_24px_rgba(168,85,247,0.45)] transition-transform duration-500 hover:scale-105"
      />

      {/* 16px spacing */}
      <div style={{ height: '16px' }} />

      {/* AETHER title with letterSpacing: 8, fontWeight: 200 */}
      <h1
        className="text-3xl sm:text-4xl text-white font-extralight tracking-[8px] uppercase select-none text-center"
        style={{
          letterSpacing: UITokens.typography.heroTitle.letterSpacing,
          fontWeight: UITokens.typography.heroTitle.fontWeight,
        }}
      >
        AETHER
      </h1>
    </CrystalSurface>
  );
};
