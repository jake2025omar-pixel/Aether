import React from 'react';

export interface CrystalSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  rounded?: 'card' | 'hero' | 'pill' | 'none';
  children: React.ReactNode;
}

export const CrystalSurface: React.FC<CrystalSurfaceProps> = ({
  glow = false,
  rounded = 'card',
  className = '',
  children,
  style,
  ...props
}) => {
  const roundedClass =
    rounded === 'hero'
      ? 'rounded-3xl'
      : rounded === 'card'
      ? 'rounded-2xl'
      : rounded === 'pill'
      ? 'rounded-full'
      : '';

  const glowStyle = glow
    ? {
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.45), 0 0 40px -6px rgba(168, 85, 247, 0.28)',
      }
    : {};

  return (
    <div
      className={`crystal-surface ${roundedClass} transition-all duration-300 ${className}`}
      style={{ ...glowStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
