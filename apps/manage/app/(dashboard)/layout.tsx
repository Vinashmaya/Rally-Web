'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type NavItem } from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import { USER_ROLE_DISPLAY, type UserRole } from '@rally/firebase';
import {
  LayoutDashboard,
  Users,
  Store,
  Car,
  TrendingUp,
  FileBarChart,
  Settings,
} from 'lucide-react';

// Roles allowed to access the Management Console (must match middleware)
const MANAGEMENT_ROLES = ['owner', 'general_manager', 'sales_manager', 'finance_manager'];

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'users', label: 'Users', icon: Users, href: '/users' },
  { id: 'stores', label: 'Stores', icon: Store, href: '/stores' },
  { id: 'inventory', label: 'Inventory', icon: Car, href: '/inventory' },
  { id: 'performance', label: 'Performance', icon: TrendingUp, href: '/performance' },
  { id: 'reports', label: 'Reports', icon: FileBarChart, href: '/reports' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
] as const;

export default function ManageDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const user = useAuthStore((s) => s.firebaseUser);
  const loading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.dealerUser);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const currentStore = useTenantStore((s) => s.activeStore);
  const stores = useTenantStore((s) => s.availableStores);
  const switchStore = useTenantStore((s) => s.switchStore);

  // Redirect if not authenticated or insufficient role
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !isSuperAdmin) {
      const role = profile?.role;
      if (!role || !MANAGEMENT_ROLES.includes(role)) {
        router.push('/login?error=insufficient_role');
      }
    }
  }, [user, loading, profile, isSuperAdmin, router]);

  // Loading state — Rally branded spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-bold font-mono text-rally-gold">RALLY</span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-rally-gold" />
          </div>
          <span className="text-xs text-text-tertiary">Management Console</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = profile?.displayName ?? user.displayName ?? 'Manager';
  const role = (profile?.role ?? 'general_manager') as UserRole;
  const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Manager';

  // Determine active nav item from pathname
  const activeId =
    NAV_ITEMS.find((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname.startsWith(item.href)
    )?.id ?? 'dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <Sidebar
        items={NAV_ITEMS}
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
        logo={
          <div className="flex flex-col">
            <span className="text-lg font-bold text-rally-gold tracking-tight">
              Rally
            </span>
            <span className="text-[10px] text-text-tertiary -mt-0.5">
              Management
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
