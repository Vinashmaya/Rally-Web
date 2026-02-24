'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from './utils';

/**
 * OfflineBanner — Shows when the browser loses network connectivity.
 * Fixed to top of screen, yellow warning. Auto-hides when reconnected.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className={cn(
        'fixed top-0 left-0 right-0 z-[200]',
        'flex items-center justify-center gap-2',
        'bg-status-warning/90 px-4 py-2',
        'text-sm font-medium text-text-inverse',
        'animate-rally-slide-up'
      )}
    >
      <WifiOff className="h-4 w-4" />
      <span>You&apos;re offline. Changes will sync when reconnected.</span>
    </div>
  );
}
