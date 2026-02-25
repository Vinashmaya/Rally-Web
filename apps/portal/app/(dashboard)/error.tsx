'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@rally/ui';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="rounded-full bg-[var(--status-error)]/15 p-4">
        <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
      <p className="text-sm text-[var(--text-tertiary)] max-w-sm text-center">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--text-disabled)] font-mono">Error ID: {error.digest}</p>
      )}
      <Button variant="primary" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
