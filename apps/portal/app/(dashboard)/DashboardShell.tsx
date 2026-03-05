'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Car,
  Activity,
  Settings,
} from 'lucide-react';
import { Sidebar, type NavItem } from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';

// ---------------------------------------------------------------------------
// Portal nav — intentionally simple. 4 items only.
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'inventory', label: 'Inventory', icon: Car, href: '/inventory' },
  { id: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
] as const;

function getActiveNavId(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  const segment = pathname.split('/')[1];
  const match = NAV_ITEMS.find((item) => item.href === `/${segment}`);
  return match?.id ?? 'dashboard';
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((s) => s.firebaseUser);
  const loading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.dealerUser);

  const currentStore = useTenantStore((s) => s.activeStore);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Loading state — Rally branded spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-bold font-mono text-rally-gold">RALLY</span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-rally-gold" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.displayName ?? user.displayName ?? 'User';
  const activeId = getActiveNavId(pathname);

  const tenantName = currentStore?.name ?? 'Dealer Portal';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={[...NAV_ITEMS]}
        activeId={activeId}
        onNavigate={(item) => router.push(item.href)}
        store={{
          id: currentStore?.id ?? 'demo',
          name: tenantName,
        }}
        user={{
          name: displayName,
          role: 'Dealer Portal',
          avatarUrl: profile?.photoURL ?? user.photoURL ?? undefined,
        }}
        logo={
          <div className="flex flex-col">
            <span className="text-lg font-bold text-rally-gold tracking-tight">
              Rally
            </span>
            <span className="text-[10px] text-text-tertiary -mt-0.5">
              Dealer Portal
            </span>
          </div>
        }
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
