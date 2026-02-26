'use client';

import { Card, CardContent } from '@rally/ui';
import { AlertCircle } from 'lucide-react';

export default function LotConfigError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-status-error shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">Lot Config Error</p>
            <p className="text-xs text-text-tertiary mt-1">{error.message}</p>
          </div>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-lg bg-surface-overlay border border-surface-border text-text-secondary text-sm hover:bg-surface-hover transition-colors"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
