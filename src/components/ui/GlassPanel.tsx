import React from 'react';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'subtle' | 'default' | 'elevated' | 'ghost';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  glow?: 'none' | 'cyan' | 'indigo' | 'amber';
  children: React.ReactNode;
}

const variantClasses: Record<NonNullable<GlassPanelProps['variant']>, string> = {
  subtle: 'bg-white/[0.02] border border-white/[0.05]',
  default: 'glass-panel',
  elevated: 'glass-panel-elevated',
  ghost: 'bg-transparent border border-white/[0.05]',
};

const roundedClasses: Record<NonNullable<GlassPanelProps['rounded']>, string> = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-[20px]',
  '2xl': 'rounded-3xl',
  '3xl': 'rounded-[32px]',
  full: 'rounded-full',
};

const glowClasses: Record<NonNullable<GlassPanelProps['glow']>, string> = {
  none: '',
  cyan: 'shadow-[0_0_24px_-4px_rgba(45,212,191,0.15)] border-teal-500/25',
  indigo: 'shadow-[0_0_24px_-4px_rgba(129,140,248,0.15)] border-indigo-500/25',
  amber: 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.15)] border-amber-500/25',
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  variant = 'default',
  rounded = '2xl',
  glow = 'none',
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`relative transition-all duration-200 ${variantClasses[variant]} ${roundedClasses[rounded]} ${glowClasses[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
