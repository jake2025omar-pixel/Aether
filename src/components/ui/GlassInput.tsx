import React from 'react';

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  error?: string | null;
  glow?: boolean;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      leftSlot,
      rightSlot,
      error,
      glow = false,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        <div
          className={`relative flex items-center w-full min-h-[48px] rounded-2xl bg-[#0E121E]/80 border transition-all duration-200 ${
            error
              ? 'border-red-500/50 shadow-[0_0_16px_-3px_rgba(239,68,68,0.25)]'
              : glow
              ? 'border-teal-500/40 shadow-[0_0_20px_-3px_rgba(45,212,191,0.2)]'
              : 'border-white/[0.1] hover:border-white/[0.18] focus-within:border-indigo-400/50 focus-within:shadow-[0_0_20px_-3px_rgba(129,140,248,0.25)]'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {leftSlot && <div className="pl-3.5 pr-1 flex items-center">{leftSlot}</div>}
          
          <input
            ref={ref}
            disabled={disabled}
            className={`w-full bg-transparent px-4 py-2.5 text-sm sm:text-base text-slate-100 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed ${className}`}
            {...props}
          />

          {rightSlot && <div className="pr-2 pl-1 flex items-center gap-1.5">{rightSlot}</div>}
        </div>

        {error && (
          <p className="mt-1.5 text-xs text-red-400 px-2 flex items-center gap-1">
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';
