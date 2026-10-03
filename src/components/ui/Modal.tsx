import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { GlassPanel } from './GlassPanel';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const maxWidthClasses: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'aether-modal-title' : undefined}
    >
      {/* Dark frosted backdrop */}
      <div
        className="fixed inset-0 bg-[#05060A]/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className={`relative w-full ${maxWidthClasses[maxWidth]} my-auto z-10 animate-in fade-in zoom-in-95 duration-200`}>
        <GlassPanel
          variant="elevated"
          rounded="2xl"
          className="p-5 sm:p-7 border border-white/[0.12] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)]"
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-white/[0.08]">
              <div>
                {title && (
                  <h2
                    id="aether-modal-title"
                    className="text-lg sm:text-xl font-semibold text-white tracking-tight"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 text-xs sm:text-sm text-white/50">
                    {description}
                  </p>
                )}
              </div>

              {showCloseButton && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Close"
                  onClick={onClose}
                  className="text-white/50 hover:text-white flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              )}
            </div>
          )}

          {/* Body Content */}
          <div className="text-white/80 text-sm leading-relaxed">{children}</div>
        </GlassPanel>
      </div>
    </div>
  );
};
