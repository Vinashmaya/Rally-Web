import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-[var(--surface-base)]">
      <div className="text-6xl font-bold text-[var(--rally-gold)] font-mono">404</div>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Page not found</h1>
      <p className="text-sm text-[var(--text-tertiary)] max-w-xs text-center">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-2 px-6 py-2 bg-[var(--rally-gold)] text-[var(--surface-base)] rounded-[var(--radius-rally)] font-semibold text-sm hover:opacity-90 transition-opacity"
      >
        Go home
      </Link>
    </div>
  );
}
