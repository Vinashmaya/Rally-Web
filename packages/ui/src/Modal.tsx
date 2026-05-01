'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// Focus trap helper
//
// Returns the first/last tabbable elements in the given container. We keep a
// small inline implementation rather than pulling in a focus-trap library —
// Rally rule 14 keeps deps tight.
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}

// ---------------------------------------------------------------------------
// Modal sizing variants
// ---------------------------------------------------------------------------

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

// ---------------------------------------------------------------------------
// Modal (root)
// ---------------------------------------------------------------------------

export interface ModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the user requests to close (Escape, backdrop click, X button). */
  onClose: () => void;
  /** Modal content — typically <ModalHeader> / <ModalBody> / <ModalFooter>. */
  children: ReactNode;
  /** Width preset. Defaults to 'md'. */
  size?: ModalSize;
  /** Optional aria-labelledby (id of the heading inside ModalHeader). */
  labelledBy?: string;
  /** Optional aria-label fallback when there's no visible heading. */
  ariaLabel?: string;
  /** If true, clicking the backdrop will not close the modal. */
  disableBackdropClose?: boolean;
  /** If true, pressing Escape will not close the modal. */
  disableEscapeClose?: boolean;
  /** Extra className for the dialog panel. */
  className?: string;
}

function Modal({
  open,
  onClose,
  children,
  size = 'md',
  labelledBy,
  ariaLabel,
  disableBackdropClose = false,
  disableEscapeClose = false,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Escape to close
  useEffect(() => {
    if (!open || disableEscapeClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, disableEscapeClose]);

  // Focus management — capture the previously focused element on open, restore
  // on close, and move focus into the panel on the first frame.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;

    // Move focus into the modal on the next tick so portals/transitions settle.
    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusableElements(panel);
      const target = focusables[0] ?? panel;
      target.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(id);
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function') {
        // Restore focus to the trigger element.
        prev.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Focus trap — keep Tab/Shift+Tab inside the panel while open.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab') return;
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        panelRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panelRef.current?.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    },
    [],
  );

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click started on the backdrop itself (prevents
    // accidental close when a drag begins inside the panel and ends on the
    // backdrop).
    if (e.target !== e.currentTarget) return;
    if (disableBackdropClose) return;
    onClose();
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'transition-opacity duration-150 ease-out',
        'opacity-100',
      )}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/70 backdrop-blur-sm',
          'transition-opacity duration-150 ease-out',
        )}
        aria-hidden="true"
        onMouseDown={handleBackdropMouseDown}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full',
          MODAL_SIZE_CLASSES[size],
          'rounded-rally-lg border border-surface-border bg-surface-raised shadow-rally-lg',
          'transition-transform duration-150 ease-out',
          'focus:outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
Modal.displayName = 'Modal';

// ---------------------------------------------------------------------------
// ModalHeader
// ---------------------------------------------------------------------------

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Visible title. Rendered as <h2>. */
  title: string;
  /** Optional id to wire up <Modal labelledBy={...}> for a11y. */
  titleId?: string;
  /** Optional smaller description below the title. */
  description?: ReactNode;
  /** Show the X close button (default: true). */
  showClose?: boolean;
  /** Called when the close button is clicked. */
  onClose?: () => void;
  /** Disable the close button (e.g. while submitting). */
  closeDisabled?: boolean;
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  (
    {
      title,
      titleId,
      description,
      showClose = true,
      onClose,
      closeDisabled = false,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-3 px-5 pt-5 pb-3',
          className,
        )}
        {...props}
      >
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-base font-semibold text-text-primary"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-text-secondary">{description}</p>
          )}
        </div>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            className={cn(
              'shrink-0 text-text-tertiary transition-colors',
              'hover:text-text-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);
ModalHeader.displayName = 'ModalHeader';

// ---------------------------------------------------------------------------
// ModalBody
// ---------------------------------------------------------------------------

export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {}

const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-5 pb-5', className)}
        {...props}
      />
    );
  },
);
ModalBody.displayName = 'ModalBody';

// ---------------------------------------------------------------------------
// ModalFooter
// ---------------------------------------------------------------------------

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {}

const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-end gap-2 px-5 pb-5 pt-2',
          className,
        )}
        {...props}
      />
    );
  },
);
ModalFooter.displayName = 'ModalFooter';

export { Modal, ModalHeader, ModalBody, ModalFooter };
