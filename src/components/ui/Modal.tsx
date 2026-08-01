import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** `sheet` slides from the bottom — used inside the 430px coach viewport. */
  variant?: 'center' | 'sheet';
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex animate-fade-in bg-ink-deep/45 p-4',
        variant === 'sheet' ? 'items-end p-0' : 'items-center justify-center',
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-full w-full flex-col overflow-hidden bg-canvas shadow-modal',
          variant === 'sheet'
            ? 'animate-slide-up rounded-t-2xl'
            : 'max-w-lg animate-pop-in rounded-lg',
          className,
        )}
      >
        {title && (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-6 py-5">
            <div className="min-w-0 text-[18px] font-semibold leading-[1.4] text-ink">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="-mr-2 -mt-1 shrink-0 rounded-sm p-2 text-steel transition-colors hover:bg-surface hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-hairline bg-surface-soft px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
