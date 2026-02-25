import { headers } from 'next/headers';
import { getAdminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// Server component — no 'use client'
// This is the public-facing landing/splash page for the dealer portal.
// It reads the tenant slug from the middleware-set header and looks up
// the group config from Firestore for branding.

async function getGroupBySlug(slug: string): Promise<{ name: string; logoUrl?: string } | null> {
  try {
    const snapshot = await getAdminDb()
      .collection('groups')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0]!.data();
    return { name: data.name as string, logoUrl: data.logoUrl as string | undefined };
  } catch {
    return null;
  }
}

export default async function PortalLandingPage() {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') ?? 'demo';

  // Look up tenant from Firestore for proper branding
  const group = await getGroupBySlug(tenantSlug);
  const tenantDisplayName = group?.name ?? tenantSlug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Top Rally Branding */}
      <div className="flex flex-col items-center gap-8 max-w-md text-center">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-4">
          {/* Placeholder logo — TODO: load from tenant config */}
          <div className="flex h-16 w-16 items-center justify-center rounded-rally-xl bg-rally-goldMuted">
            <span className="text-2xl font-extrabold font-mono text-rally-gold">
              {tenantDisplayName.slice(0, 2).toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Welcome to {tenantDisplayName}
            </h1>
            <p className="text-sm text-text-secondary max-w-xs">
              Access your dealership portal to view inventory, track activity, and manage your operations.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          <a
            href="/login"
            className="inline-flex items-center justify-center w-full max-w-xs rounded-rally bg-rally-gold px-6 py-3 text-sm font-semibold text-text-inverse hover:bg-rally-goldLight active:bg-rally-goldDim transition-colors shadow-rally-sm hover:shadow-rally"
          >
            Sign In
          </a>

          {/* TODO: Enable public inventory browsing via tenant config flag */}
          <a
            href="/inventory"
            className="inline-flex items-center justify-center text-sm font-medium text-text-secondary hover:text-rally-gold transition-colors"
          >
            View Inventory
          </a>
        </div>

        {/* Powered by Rally */}
        <footer className="flex flex-col items-center gap-2 pt-8 border-t border-surface-border w-full max-w-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-tertiary">Powered by</span>
            <span className="text-xs font-bold text-rally-gold tracking-tight">
              Rally
            </span>
          </div>
          <p className="text-[10px] text-text-disabled">
            Dealership Operating System
          </p>
        </footer>
      </div>
    </main>
  );
}
