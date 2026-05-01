import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// Server component — no 'use client'
// This is the public-facing landing/splash page for the dealer portal.
// It reads the tenant slug from the middleware-set header and looks up
// the group config from Firestore for branding.
// Unknown slugs redirect to rally.vin.

interface TenantBranding {
  name: string;
  logoUrl?: string;
  publicInventoryEnabled: boolean;
}

async function getGroupBySlug(slug: string): Promise<TenantBranding | null> {
  try {
    const snapshot = await getAdminDb()
      .collection('groups')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0]!.data();

    // Branding logo: prefer groups/{groupId}/config/branding.logoUrl, then fall
    // back to a flat `logoUrl` on the group doc (legacy shape from the iOS Dealership model).
    let logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl : undefined;
    try {
      const branding = await getAdminDb()
        .collection('groups')
        .doc(snapshot.docs[0]!.id)
        .collection('config')
        .doc('branding')
        .get();
      if (branding.exists) {
        const b = branding.data();
        if (b && typeof b.logoUrl === 'string') logoUrl = b.logoUrl;
      }
    } catch {
      // Subcollection lookup is optional — fall through to legacy field.
    }

    // Public inventory flag: groups/{groupId}/config/featureFlags.publicInventory
    // (with fallback to the inline featureFlags map on the group doc).
    let publicInventoryEnabled = false;
    const inlineFlag = data.featureFlags as { publicInventory?: unknown } | undefined;
    if (inlineFlag && typeof inlineFlag.publicInventory === 'boolean') {
      publicInventoryEnabled = inlineFlag.publicInventory;
    }
    try {
      const flagsDoc = await getAdminDb()
        .collection('groups')
        .doc(snapshot.docs[0]!.id)
        .collection('config')
        .doc('featureFlags')
        .get();
      if (flagsDoc.exists) {
        const f = flagsDoc.data();
        if (f && typeof f.publicInventory === 'boolean') {
          publicInventoryEnabled = f.publicInventory;
        }
      }
    } catch {
      // Subcollection lookup is optional — fall through to inline flag / default.
    }

    return {
      name: data.name as string,
      logoUrl,
      publicInventoryEnabled,
    };
  } catch {
    return null;
  }
}

export default async function PortalLandingPage() {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') ?? 'demo';

  // Look up tenant from Firestore for proper branding
  const group = await getGroupBySlug(tenantSlug);

  // Unknown tenant slug → redirect to main site
  if (!group) {
    redirect('https://rally.vin');
  }

  const tenantDisplayName = group.name;
  const tenantLogoUrl = group.logoUrl;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Top Rally Branding */}
      <div className="flex flex-col items-center gap-8 max-w-md text-center">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-4">
          {/* Tenant logo from groups/{groupId}/config/branding.logoUrl, with a
              gold-on-black Rally fallback when no branding asset is configured. */}
          {tenantLogoUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-rally-xl bg-rally-goldMuted">
              <Image
                src={tenantLogoUrl}
                alt={`${tenantDisplayName} logo`}
                fill
                sizes="64px"
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-rally-xl bg-rally-goldMuted">
              <span className="text-2xl font-extrabold font-mono text-rally-gold">
                {tenantDisplayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

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

          {/* Public inventory CTA — gated on
              groups/{groupId}/config/featureFlags.publicInventory.
              Hidden entirely when the flag is undefined or false. */}
          {group.publicInventoryEnabled && (
            <a
              href="/inventory"
              className="inline-flex items-center justify-center text-sm font-medium text-text-secondary hover:text-rally-gold transition-colors"
            >
              View Inventory
            </a>
          )}
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
