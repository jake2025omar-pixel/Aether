import React from 'react';
import { UITokens } from '../../styles/tokens';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  interactive = false,
  glow = false,
  className = '',
  children,
  style,
  ...props
}) => {
  const interactiveClasses = interactive
    ? 'cursor-pointer hover:bg-white/[0.08] hover:border-purple-400/30 hover:translate-y-[-1px] active:translate-y-[0px] transition-all duration-200'
    : '';

  const glowStyle = glow
    ? {
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45), 0 0 30px -4px rgba(168, 85, 247, 0.20)',
      }
    : {
        boxShadow: UITokens.crystalShadowSubtle,
      };

  return (
    <div
      className={`crystal-surface rounded-2xl ${interactiveClasses} ${className}`}
      style={{
        padding: `${UITokens.padding.card}px`,
        borderRadius: `${UITokens.radius.card}px`,
        ...glowStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
