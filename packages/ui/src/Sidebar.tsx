'use client';

import {
  forwardRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './utils';
import { Avatar } from './Avatar';

// ── Types ─────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string | number;
}

export interface StoreInfo {
  id: string;
  name: string;
  /** Short display name for collapsed mode */
  shortName?: string;
}

export interface UserInfo {
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  /** Navigation items */
  items: NavItem[];
  /** Currently active nav item ID */
  activeId?: string;
  /** Callback when a nav item is clicked */
  onNavigate?: (item: NavItem) => void;
  /** Current store */
  store?: StoreInfo;
  /** Available stores for switcher */
  stores?: StoreInfo[];
  /** Callback when store is switched */
  onStoreSwitch?: (store: StoreInfo) => void;
  /** Current user info */
  user?: UserInfo;
  /** Whether sidebar starts collapsed (tablet mode) */
  defaultCollapsed?: boolean;
  /** Logo element — defaults to Rally text */
  logo?: ReactNode;
}

/**
 * Sidebar — Primary navigation for tablet and desktop.
 *
 * - Rally logo at top
 * - Nav items with Lucide icons, active state = gold left border + gold text
 * - Collapsible on tablet (icon-only mode)
 * - Store switcher near bottom
 * - User profile at very bottom
 */
const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      className,
      items,
      activeId,
      onNavigate,
      store,
      stores,
      onStoreSwitch,
      user,
      defaultCollapsed = false,
      logo,
      ...props
    },
    ref
  ) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

    return (
      <nav
        ref={ref}
        className={cn(
          'flex flex-col h-full',
          'bg-surface-base border-r border-surface-border',
          'transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
          className
        )}
        {...props}
      >
        {/* ── Logo + Collapse Toggle ───────────────────────── */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-surface-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              {logo || (
                <span className="text-lg font-bold text-rally-gold tracking-tight">
                  Rally
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'p-1.5 rounded-rally text-text-tertiary',
              'hover:text-text-primary hover:bg-surface-overlay',
              'transition-colors',
              collapsed && 'mx-auto'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* ── Navigation Items ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <ul className="flex flex-col gap-0.5" role="navigation">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const Icon = item.icon;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate?.(item)}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-rally',
                      'px-3 py-2 text-sm font-medium',
                      'transition-colors duration-150',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'text-rally-gold bg-rally-goldMuted/50 border-l-2 border-rally-gold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay border-l-2 border-transparent'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="text-xs bg-rally-goldMuted text-rally-gold px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Store Switcher ───────────────────────────────── */}
        {store && (
          <div className="px-2 py-2 border-t border-surface-border shrink-0">
            <div className="relative">
              <button
                onClick={() => {
                  if (stores && stores.length > 1) {
                    setStoreDropdownOpen((o) => !o);
                  }
                }}
                className={cn(
                  'flex items-center gap-2 w-full rounded-rally',
                  'px-3 py-2 text-sm',
                  'text-text-secondary hover:text-text-primary hover:bg-surface-overlay',
                  'transition-colors',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? store.name : undefined}
              >
                <div
                  className={cn(
                    'h-6 w-6 rounded bg-rally-goldMuted',
                    'flex items-center justify-center',
                    'text-[10px] font-bold text-rally-gold shrink-0'
                  )}
                >
                  {(store.shortName || store.name).slice(0, 2).toUpperCase()}
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate text-xs">
                      {store.name}
                    </span>
                    {stores && stores.length > 1 && (
                      <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
                    )}
                  </>
                )}
              </button>

              {/* Dropdown */}
              {storeDropdownOpen && stores && !collapsed && (
                <div
                  className={cn(
                    'absolute bottom-full left-0 right-0 mb-1',
                    'bg-surface-raised border border-surface-border',
                    'rounded-rally shadow-rally-lg',
                    'py-1 z-50'
                  )}
                >
                  {stores.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onStoreSwitch?.(s);
                        setStoreDropdownOpen(false);
                      }}
                      className={cn(
                        'flex items-center gap-2 w-full px-3 py-2 text-xs',
                        'transition-colors',
                        s.id === store.id
                          ? 'text-rally-gold bg-rally-goldMuted/50'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── User Profile ─────────────────────────────────── */}
        {user && (
          <div className="px-2 py-3 border-t border-surface-border shrink-0">
            <div
              className={cn(
                'flex items-center gap-3 px-3',
                collapsed && 'justify-center px-0'
              )}
            >
              <Avatar
                size="sm"
                name={user.name}
                src={user.avatarUrl}
              />
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-text-tertiary truncate">
                    {user.role}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    );
  }
);

Sidebar.displayName = 'Sidebar';

export { Sidebar };
