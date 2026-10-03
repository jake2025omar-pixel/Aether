import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger' | 'celestial';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  // Primary action button (calm indigo glow)
  primary:
    'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium border border-indigo-400/30 shadow-[0_0_20px_-3px_rgba(99,102,241,0.35)]',
  // Celestial teal accent
  celestial:
    'bg-teal-500/90 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-semibold border border-teal-300/40 shadow-[0_0_20px_-3px_rgba(45,212,191,0.4)]',
  // Secondary button
  secondary:
    'bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-900 text-slate-100 font-medium border border-white/10',
  // Translucent glass button
  glass:
    'glass-pill hover:bg-white/[0.12] active:bg-white/[0.06] text-slate-100 font-medium border border-white/[0.12] shadow-sm',
  // Ghost button
  ghost:
    'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.03] text-slate-300 hover:text-white',
  // Danger button
  danger:
    'bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/10 text-red-200 border border-red-500/30 shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-xs px-3 py-1.5 min-h-[36px] rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2 min-h-[44px] rounded-xl gap-2',
  lg: 'text-base px-5 py-2.5 min-h-[48px] rounded-2xl gap-2.5',
  icon: 'p-2 min-h-[44px] min-w-[44px] rounded-xl justify-center items-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'glass',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
