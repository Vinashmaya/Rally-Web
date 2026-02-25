'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#09090B', color: '#FAFAFA', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem' }}>
          <div style={{ fontSize: '3rem' }}>⚠</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ fontSize: '0.875rem', color: '#71717A', maxWidth: '24rem', textAlign: 'center' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#52525B', fontFamily: 'monospace' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            type="button"
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.5rem',
              backgroundColor: '#D4A017',
              color: '#09090B',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
