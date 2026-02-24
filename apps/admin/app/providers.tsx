'use client';

import { useEffect, type ReactNode } from 'react';
import { ToastProvider } from '@rally/ui';
import { useAuthStore } from '@rally/services';

function AuthInitializer({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      unsubscribe();
    };
  }, [initialize]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthInitializer>{children}</AuthInitializer>
    </ToastProvider>
  );
}
