'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type NavItem } from '@rally/ui';
import { useAuthStore } from '@rally/services';
import {
  LayoutDashboard,
  Building2,
  Users,
  Car,
  Activity,
  Globe,
  ToggleLeft,
  Plug,
  Brain,
  CreditCard,
  ScrollText,
  Server,
} from 'lucide-react';

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'tenants', label: 'Tenants', icon: Building2, href: '/tenants' },
  { id: 'users', label: 'Users', icon: Users, href: '/users' },
  { id: 'vehicles', label: 'Vehicles', icon: Car, href: '/vehicles' },
  { id: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
  { id: 'dns', label: 'DNS', icon: Globe, href: '/dns' },
  { id: 'feature-flags', label: 'Feature Flags', icon: ToggleLeft, href: '/feature-flags' },
  { id: 'integrations', label: 'Integrations', icon: Plug, href: '/integrations' },
  { id: 'ai', label: 'AI', icon: Brain, href: '/ai' },
  { id: 'billing', label: 'Billing', icon: CreditCard, href: '/billing' },
  { id: 'logs', label: 'Logs', icon: ScrollText, href: '/logs' },
  { id: 'system', label: 'System', icon: Server, href: '/system' },
] as const;

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const user = useAuthStore((s) => s.firebaseUser);
  const loading = useAuthStore((s) => s.isLoading);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  // Redirect if not authenticated or not super admin
  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/login');
    }
  }, [user, loading, isSuperAdmin, router]);

  // Loading state — Rally branded spinner
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-2xl font-bold font-mono text-rally-gold">RALLY</span>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-overlay">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-rally-gold" />
          </div>
          <span className="text-xs text-text-tertiary">Super Admin</span>
        </div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

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
        user={{
          name: user.displayName ?? user.email ?? 'Super Admin',
          role: 'Super Admin',
          avatarUrl: user.photoURL ?? undefined,
        }}
        logo={
          <div className="flex flex-col">
            <span className="text-lg font-bold text-rally-gold tracking-tight">
              Rally
            </span>
            <span className="text-[10px] text-text-tertiary -mt-0.5">
              Super Admin
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
