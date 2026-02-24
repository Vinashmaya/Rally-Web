'use client';

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from './utils';

// ── Types ─────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

// ── Context ───────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ── Toast icons / colors ──────────────────────────────────────────

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    containerClass: 'border-status-success/30',
    iconClass: 'text-status-success',
  },
  error: {
    icon: XCircle,
    containerClass: 'border-status-error/30',
    iconClass: 'text-status-error',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'border-status-warning/30',
    iconClass: 'text-status-warning',
  },
  info: {
    icon: Info,
    containerClass: 'border-status-info/30',
    iconClass: 'text-status-info',
  },
} as const;

// ── Single Toast ──────────────────────────────────────────────────

interface ToastCardProps extends HTMLAttributes<HTMLDivElement> {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard = forwardRef<HTMLDivElement, ToastCardProps>(
  ({ item, onDismiss, className, ...props }, ref) => {
    const config = TOAST_CONFIG[item.type];
    const Icon = config.icon;
    const duration = item.duration ?? 5000;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      timerRef.current = setTimeout(() => {
        onDismiss(item.id);
      }, duration);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [item.id, duration, onDismiss]);

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'pointer-events-auto w-full max-w-sm overflow-hidden',
          'rounded-rally-lg border bg-surface-raised shadow-rally-lg',
          'animate-rally-slide-up',
          config.containerClass,
          className
        )}
        onClick={() => onDismiss(item.id)}
        {...props}
      >
        <div className="flex items-start gap-3 p-4">
          <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.iconClass)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            {item.description && (
              <p className="mt-1 text-xs text-text-secondary">{item.description}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(item.id);
            }}
            className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
);
ToastCard.displayName = 'ToastCard';

// ── Provider ──────────────────────────────────────────────────────

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container — bottom-right desktop, bottom-center mobile */}
      <div
        className={cn(
          'fixed z-[100] pointer-events-none',
          'bottom-4 right-4 left-4 sm:left-auto',
          'flex flex-col gap-2 items-center sm:items-end',
        )}
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export type { ToastType, ToastItem };
