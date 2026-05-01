'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImpersonationBannerProps {
  /** Display name (or email) of the user being impersonated. */
  targetName: string;
  /** Epoch ms when the impersonation began. */
  startedAt: number;
  /** Async callback invoked when the operator clicks "End impersonation". */
  onEnd: () => void | Promise<void>;
  /** Optional className passthrough. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ImpersonationBanner — sticky top banner shown while a super admin is
 * acting as another user. Clicking "End impersonation" calls `onEnd`,
 * which should hit `/api/auth/end-impersonation`, sign out, and route
 * back to the admin console.
 */
export function ImpersonationBanner({
  targetName,
  startedAt,
  onEnd,
  className,
}: ImpersonationBannerProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = useMemo(() => formatElapsed(startedAt, now), [startedAt, now]);

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await onEnd();
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-[150]',
        'flex items-center gap-3',
        'bg-rally-gold text-text-inverse',
        'px-4 py-2 text-sm font-medium',
        'border-b border-rally-goldDim shadow-rally',
        className,
      )}
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0 truncate">
        <span className="font-semibold">Impersonating</span>{' '}
        <span className="font-mono">{targetName}</span>
        <span className="opacity-80"> &middot; {elapsed}</span>
      </div>
      <button
        type="button"
        onClick={handleEnd}
        disabled={ending}
        className={cn(
          'inline-flex items-center gap-1.5',
          'h-7 px-3 rounded-rally',
          'bg-text-inverse/10 hover:bg-text-inverse/20',
          'text-xs font-semibold uppercase tracking-wider',
          'transition-colors',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        )}
      >
        <X className="h-3 w-3" />
        {ending ? 'Ending…' : 'End impersonation'}
      </button>
    </div>
  );
}
