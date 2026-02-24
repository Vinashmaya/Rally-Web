'use client';

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { cn } from './utils';
import { Avatar } from './Avatar';

// ── Types ─────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Sidebar content — rendered on tablet/desktop */
  sidebar?: ReactNode;
  /** Tab items for mobile bottom nav */
  tabs?: TabItem[];
  /** Currently active tab ID */
  activeTabId?: string;
  /** Tab click handler */
  onTabChange?: (tab: TabItem) => void;
  /** Store name displayed in header */
  storeName?: string;
  /** User info for header avatar */
  userName?: string;
  userAvatarUrl?: string;
  /** Cmd+K trigger callback */
  onCommandPalette?: () => void;
  /** Main page content */
  children: ReactNode;
}

/**
 * AppShell — Main layout wrapper for all Rally apps.
 *
 * Responsive breakpoints:
 * - Mobile  (<640px):  Bottom tab bar, content above
 * - Tablet  (640-1024px): Collapsible sidebar, content area
 * - Desktop (>1024px): Persistent sidebar, content area
 */
const AppShell = forwardRef<HTMLDivElement, AppShellProps>(
  (
    {
      className,
      sidebar,
      tabs,
      activeTabId,
      onTabChange,
      storeName,
      userName,
      userAvatarUrl,
      onCommandPalette,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-screen w-screen overflow-hidden',
          'bg-surface-base text-text-primary',
          className
        )}
        {...props}
      >
        {/* ── Sidebar (hidden on mobile) ────────────────── */}
        {sidebar && (
          <div className="hidden sm:flex shrink-0">
            {sidebar}
          </div>
        )}

        {/* ── Main Content Column ───────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* ── Header Bar ──────────────────────────────── */}
          <header className="flex items-center gap-4 h-14 px-4 border-b border-surface-border shrink-0">
            {/* Store name */}
            {storeName && (
              <span className="text-sm font-medium text-text-secondary hidden sm:block">
                {storeName}
              </span>
            )}

            {/* Cmd+K Search Trigger */}
            <button
              onClick={onCommandPalette}
              className={cn(
                'flex items-center gap-2 flex-1 max-w-md',
                'h-9 px-3 rounded-rally',
                'bg-surface-overlay border border-surface-border',
                'text-sm text-text-disabled',
                'hover:border-surface-borderHover hover:text-text-tertiary',
                'transition-colors'
              )}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-text-tertiary font-mono bg-surface-base px-1.5 py-0.5 rounded">
                <span className="text-xs">&#8984;</span>K
              </kbd>
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* User Avatar */}
            {userName && (
              <Avatar
                size="sm"
                name={userName}
                src={userAvatarUrl}
              />
            )}
          </header>

          {/* ── Page Content ────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>

          {/* ── Mobile Bottom Tab Bar ───────────────────── */}
          {tabs && tabs.length > 0 && (
            <nav className="sm:hidden flex items-center border-t border-surface-border bg-surface-base shrink-0">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange?.(tab)}
                    className={cn(
                      'flex-1 flex flex-col items-center gap-0.5',
                      'py-2 px-1',
                      'text-[10px] font-medium',
                      'transition-colors',
                      isActive
                        ? 'text-rally-gold'
                        : 'text-text-tertiary active:text-text-secondary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
    );
  }
);

AppShell.displayName = 'AppShell';

export { AppShell };
