'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, type NavItem } from '@rally/ui';
import {
  LayoutDashboard,
  Users,
  Store,
  Car,
  TrendingUp,
  FileBarChart,
  Settings,
} from 'lucide-react';

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
