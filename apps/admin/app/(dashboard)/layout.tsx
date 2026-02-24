'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type NavItem } from '@rally/ui';
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
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
