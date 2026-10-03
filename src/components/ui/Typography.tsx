import React from 'react';

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export const Display: React.FC<TypographyProps & { size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
  as: Component = 'h1',
  className = '',
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-2xl sm:text-3xl font-bold tracking-tight',
    md: 'text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight',
    lg: 'text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight',
  }[size];

  return (
    <Component
      className={`text-slate-100 ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

export const Heading: React.FC<TypographyProps & { level?: 1 | 2 | 3 | 4 }> = ({
  level = 2,
  as,
  className = '',
  children,
  ...props
}) => {
  const Component = as || (`h${level}` as React.ElementType);
  const levelClasses = {
    1: 'text-2xl sm:text-3xl font-bold text-slate-100',
    2: 'text-xl sm:text-2xl font-semibold text-slate-100',
    3: 'text-lg sm:text-xl font-medium text-slate-200',
    4: 'text-base sm:text-lg font-medium text-slate-200',
  }[level];

  return (
    <Component className={`${levelClasses} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export const Text: React.FC<TypographyProps & { variant?: 'body' | 'secondary' | 'muted' }> = ({
  variant = 'body',
  as: Component = 'p',
  className = '',
  children,
  ...props
}) => {
  const variantClasses = {
    body: 'text-sm sm:text-base text-slate-200 leading-relaxed',
    secondary: 'text-sm text-slate-400 leading-normal',
    muted: 'text-xs text-slate-400 leading-normal',
  }[variant];

  return (
    <Component className={`${variantClasses} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export const Caption: React.FC<TypographyProps> = ({
  as: Component = 'span',
  className = '',
  children,
  ...props
}) => {
  return (
    <Component
      className={`text-xs text-slate-400 tracking-wide font-normal ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

export const Label: React.FC<TypographyProps> = ({
  as: Component = 'label',
  className = '',
  children,
  ...props
}) => {
  return (
    <Component
      className={`text-xs sm:text-sm font-medium text-slate-300 block mb-1.5 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};
