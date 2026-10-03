import React from 'react';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs min-h-[36px]'
      : size === 'lg'
      ? 'px-6 py-3 text-base min-h-[48px]'
      : 'px-4 py-2 text-sm min-h-[44px]';

  const variantClasses =
    variant === 'primary'
      ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white border border-purple-400/40 shadow-[0_0_24px_-4px_rgba(168,85,247,0.45)]'
      : variant === 'ghost'
      ? 'bg-transparent hover:bg-white/[0.06] text-white/70 hover:text-white border border-transparent'
      : 'crystal-surface hover:bg-white/[0.09] hover:border-purple-400/35 text-white/90 hover:text-white active:scale-95';

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:pointer-events-none select-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
