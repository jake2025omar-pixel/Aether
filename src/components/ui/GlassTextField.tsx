import React from 'react';

export interface GlassTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
}

export const GlassTextField: React.FC<GlassTextFieldProps> = ({
  error,
  prefixElement,
  suffixElement,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      <div
        className={`crystal-surface rounded-xl flex items-center px-3 py-2.5 transition-all duration-200 focus-within:border-purple-400/50 focus-within:shadow-[0_0_24px_-4px_rgba(168,85,247,0.25)] ${
          error ? 'border-red-500/50' : ''
        } ${className}`}
      >
        {prefixElement && <div className="mr-2 text-white/50">{prefixElement}</div>}
        <input
          className="w-full bg-transparent text-sm text-white placeholder-white/35 focus:outline-none disabled:opacity-40"
          {...props}
        />
        {suffixElement && <div className="ml-2 text-white/50">{suffixElement}</div>}
      </div>
      {error && <p className="text-xs text-red-400 mt-1 pl-1">{error}</p>}
    </div>
  );
};
