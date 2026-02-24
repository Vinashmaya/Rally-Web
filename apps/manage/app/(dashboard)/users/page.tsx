'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Avatar,
  Skeleton,
  EmptyState,
  FilterBar,
  RelativeTime,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import { useUsers, USER_ROLE_DISPLAY, isSalesRole, isServiceRole } from '@rally/firebase';
import type { UserRole } from '@rally/firebase';
import { useTenantStore } from '@rally/services';
import { UserPlus, Users, Search, ArrowUpDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Filter groups — map filter chip values to sets of roles
// ---------------------------------------------------------------------------

const SALES_ROLES: UserRole[] = [
  'owner', 'general_manager', 'sales_manager', 'desk_manager',
  'salesperson', 'bdc_agent', 'finance_manager',
];

const SERVICE_ROLES: UserRole[] = [
  'owner', 'general_manager', 'service_manager',
  'service_advisor', 'technician', 'parts',
];

const OPERATIONS_ROLES: UserRole[] = [
  'porter', 'detailer',
];

type FilterGroup = 'all' | 'sales' | 'service' | 'operations';

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'operations', label: 'Operations' },
] as const;

type SortField = 'name' | 'role' | 'lastActive';

const ROLE_SORT_ORDER: Record<UserRole, number> = {
  owner: 0,
  general_manager: 1,
  sales_manager: 2,
  service_manager: 3,
  finance_manager: 4,
  desk_manager: 5,
  salesperson: 6,
  bdc_agent: 7,
  service_advisor: 8,
  technician: 9,
  porter: 10,
  detailer: 11,
  parts: 12,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActiveRecently(lastActiveAt?: Date): boolean {
  if (!lastActiveAt) return false;
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return lastActiveAt.getTime() > twentyFourHoursAgo;
}

function matchesFilterGroup(role: UserRole, group: FilterGroup): boolean {
  switch (group) {
    case 'all':
      return true;
    case 'sales':
      return SALES_ROLES.includes(role);
    case 'service':
      return SERVICE_ROLES.includes(role);
    case 'operations':
      return OPERATIONS_ROLES.includes(role);
  }
}

function getRoleBadgeVariant(role: UserRole): 'gold' | 'info' | 'success' | 'default' {
  if (role === 'owner' || role === 'general_manager') return 'gold';
  if (isSalesRole(role)) return 'info';
  if (isServiceRole(role)) return 'success';
  return 'default';
}

// ---------------------------------------------------------------------------
// Skeleton Loading Cards
// ---------------------------------------------------------------------------

function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Skeleton variant="circle" className="h-12 w-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-20" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function UsersListPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const [filterGroup, setFilterGroup] = useState<FilterGroup>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');

  const { users, loading, error } = useUsers({ dealershipId, search });

  // Apply filter group
  const filteredUsers = useMemo(() => {
    const filtered = users.filter((u) => matchesFilterGroup(u.role, filterGroup));

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'role':
          return (ROLE_SORT_ORDER[a.role] ?? 99) - (ROLE_SORT_ORDER[b.role] ?? 99);
        case 'lastActive': {
          const aTime = a.lastActiveAt?.getTime() ?? 0;
          const bTime = b.lastActiveAt?.getTime() ?? 0;
          return bTime - aTime; // Most recent first
        }
      }
    });
  }, [users, filterGroup, sortField]);

  // Update filter counts
  const filterOptionsWithCounts: FilterOption[] = useMemo(() => {
    return FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count: opt.value === 'all'
        ? users.length
        : users.filter((u) => matchesFilterGroup(u.role, opt.value as FilterGroup)).length,
    }));
  }, [users]);

  // Cycle sort field
  const cycleSortField = () => {
    const fields: SortField[] = ['name', 'role', 'lastActive'];
    const currentIndex = fields.indexOf(sortField);
    setSortField(fields[(currentIndex + 1) % fields.length] as SortField);
  };

  const sortLabel: Record<SortField, string> = {
    name: 'Name',
    role: 'Role',
    lastActive: 'Last Active',
  } as const;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          {!loading && (
            <Badge variant="default" size="md">
              {filteredUsers.length}
            </Badge>
          )}
        </div>
        <Button
          variant="primary"
          onClick={() => router.push('/users/invite')}
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Filter Bar + Search + Sort */}
      <div className="space-y-3">
        <FilterBar
          options={filterOptionsWithCounts}
          selected={filterGroup}
          onSelect={(v) => setFilterGroup(v as FilterGroup)}
        />
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleSortField}
            className="shrink-0"
          >
            <ArrowUpDown className="h-4 w-4" />
            {sortLabel[sortField]}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card>
          <CardContent>
            <p className="text-sm text-status-error">
              Failed to load users: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <UserCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredUsers.length === 0 && (
        <EmptyState
          icon={Users}
          title="No users found"
          description={
            search
              ? `No users match "${search}". Try a different search.`
              : 'Invite your first team member to get started.'
          }
          action={
            !search ? (
              <Button
                variant="primary"
                onClick={() => router.push('/users/invite')}
              >
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
            ) : undefined
          }
        />
      )}

      {/* User Card Grid */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isActive = isActiveRecently(user.lastActiveAt);

            return (
              <Card
                key={user.id ?? user.email}
                variant="interactive"
                onClick={() => router.push(`/users/${user.id}`)}
              >
                <CardContent className="flex items-center gap-4">
                  {/* Avatar with status indicator */}
                  <div className="relative shrink-0">
                    <Avatar
                      size="lg"
                      name={user.displayName}
                      src={user.photoURL}
                    />
                    {/* Online/offline dot */}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface-raised ${
                        isActive ? 'bg-status-success' : 'bg-text-disabled'
                      }`}
                    />
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {user.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                        {USER_ROLE_DISPLAY[user.role]}
                      </Badge>
                      {user.lastActiveAt && (
                        <RelativeTime date={user.lastActiveAt} />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
