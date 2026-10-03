import React from 'react';
import { Loader2 } from 'lucide-react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'glass' | 'ghost' | 'primary' | 'celestial';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  'aria-label': string;
}

const sizeClasses: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'w-9 h-9 min-w-[36px] min-h-[36px] text-sm rounded-lg',
  md: 'w-11 h-11 min-w-[44px] min-h-[44px] text-base rounded-xl',
  lg: 'w-13 h-13 min-w-[48px] min-h-[48px] text-lg rounded-2xl',
};

const variantClasses: Record<NonNullable<IconButtonProps['variant']>, string> = {
  glass:
    'glass-pill hover:bg-white/[0.12] active:bg-white/[0.06] text-slate-200 hover:text-white border border-white/[0.1] shadow-xs',
  ghost:
    'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.03] text-slate-400 hover:text-white',
  primary:
    'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-[0_0_16px_-2px_rgba(99,102,241,0.4)] border border-indigo-400/30',
  celestial:
    'bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 shadow-[0_0_16px_-2px_rgba(45,212,191,0.4)] border border-teal-300/40',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'glass',
      size = 'md',
      loading = false,
      disabled = false,
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
        className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
