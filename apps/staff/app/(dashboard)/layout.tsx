'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Car,
  ScanLine,
  Activity,
  ListChecks,
  Truck,
  Battery,
  Users,
  Sparkles,
  CreditCard,
  Settings,
} from 'lucide-react';
import { Sidebar, type NavItem } from '@rally/ui';
import { useAuthStore } from '@rally/services';
import { useTenantStore } from '@rally/services';
import { USER_ROLE_DISPLAY, type UserRole } from '@rally/firebase';

const NAV_ITEMS: NavItem[] = [
  // Primary
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'inventory', label: 'Inventory', icon: Car, href: '/inventory' },
  { id: 'scan', label: 'Scan', icon: ScanLine, href: '/scan' },
  { id: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
  { id: 'lists', label: 'Lists', icon: ListChecks, href: '/lists' },
  // Tools
  { id: 'fleet', label: 'Fleet', icon: Truck, href: '/fleet' },
  { id: 'battery', label: 'Battery', icon: Battery, href: '/battery' },
  { id: 'crm', label: 'CRM', icon: Users, href: '/crm' },
  { id: 'ai', label: 'AI', icon: Sparkles, href: '/ai' },
  // Translate — DEFERRED. Page kept at /translate for direct linking, but the
  // nav entry is hidden until the feature is feature-flagged + finished.
  { id: 'cards', label: 'Cards', icon: CreditCard, href: '/cards' },
  // System
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
] as const;

function getActiveNavId(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  const segment = pathname.split('/')[1];
  const match = NAV_ITEMS.find((item) => item.href === `/${segment}`);
  return match?.id ?? 'dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((s) => s.firebaseUser);
  const loading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.dealerUser);

  const currentStore = useTenantStore((s) => s.activeStore);
  const stores = useTenantStore((s) => s.availableStores);
  const switchStore = useTenantStore((s) => s.switchStore);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Don't render the shell while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-bold font-mono text-[var(--rally-gold)]">RALLY</span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--surface-overlay)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--rally-gold)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.displayName ?? user.displayName ?? 'User';
  const role = (profile?.role ?? 'salesperson') as UserRole;
  const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Staff';

  const activeId = getActiveNavId(pathname);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={[...NAV_ITEMS]}
        activeId={activeId}
        onNavigate={(item) => router.push(item.href)}
        store={
          currentStore
            ? { id: currentStore.id ?? '', name: currentStore.name }
            : undefined
        }
        stores={stores.map((s) => ({ id: s.id ?? '', name: s.name }))}
        onStoreSwitch={(s) => {
          const found = stores.find((store) => store.id === s.id);
          if (found) switchStore(found);
        }}
        user={{
          name: displayName,
          role: roleDisplay,
          avatarUrl: profile?.photoURL ?? user.photoURL ?? undefined,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
