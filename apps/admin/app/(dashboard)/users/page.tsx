'use client';

import { useState, useMemo } from 'react';
import {
  Badge,
  Input,
  Avatar,
  EmptyState,
  FilterBar,
  DataTable,
  RelativeTime,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  Search,
  MoreHorizontal,
  Eye,
  UserCog,
  Ban,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRole =
  | 'superAdmin'
  | 'principal'
  | 'generalManager'
  | 'salesManager'
  | 'salesperson'
  | 'porter'
  | 'detailer'
  | 'serviceManager';

interface SystemUser {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  dealershipId: string;
  status: 'active' | 'disabled' | 'pending';
  photoURL?: string;
  createdAt: Date;
  lastActiveAt?: Date;
  tenantName: string;
  tenantSlug: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ROLE_DISPLAY: Record<UserRole, string> = {
  superAdmin: 'Super Admin',
  principal: 'Principal',
  generalManager: 'General Manager',
  salesManager: 'Sales Manager',
  salesperson: 'Salesperson',
  porter: 'Porter',
  detailer: 'Detailer',
  serviceManager: 'Service Manager',
} as const;

const ROLE_BADGE_VARIANT: Record<UserRole, 'gold' | 'info' | 'success' | 'warning' | 'default'> = {
  superAdmin: 'gold',
  principal: 'info',
  generalManager: 'info',
  salesManager: 'info',
  salesperson: 'default',
  porter: 'default',
  detailer: 'default',
  serviceManager: 'success',
} as const;

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  active: 'success',
  disabled: 'error',
  pending: 'warning',
} as const;

const ROLE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'superAdmin', label: 'Super Admin' },
  { value: 'principal', label: 'Principal' },
  { value: 'generalManager', label: 'General Manager' },
  { value: 'salesManager', label: 'Sales Manager' },
  { value: 'salesperson', label: 'Salesperson' },
  { value: 'porter', label: 'Porter' },
  { value: 'detailer', label: 'Detailer' },
  { value: 'serviceManager', label: 'Service Manager' },
] as const;

// ---------------------------------------------------------------------------
// Mock Data — 18 users across 4 tenants
// ---------------------------------------------------------------------------

const MOCK_USERS: SystemUser[] = [
  // Gallatin CDJR
  { id: 'u-001', displayName: 'Trey Adcox', email: 'trey@gallatincdjr.com', role: 'superAdmin', dealershipId: 'gallatin-cdjr', status: 'active', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', createdAt: new Date('2025-08-15'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 5), phone: '(615) 555-0101' },
  { id: 'u-002', displayName: 'Robert Lisowski', email: 'robert@gallatincdjr.com', role: 'generalManager', dealershipId: 'gallatin-cdjr', status: 'active', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', createdAt: new Date('2025-09-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 45), phone: '(615) 555-0102' },
  { id: 'u-003', displayName: 'Marcus Williams', email: 'marcus@gallatincdjr.com', role: 'salesManager', dealershipId: 'gallatin-cdjr', status: 'active', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', createdAt: new Date('2025-09-15'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: 'u-004', displayName: 'Jessica Turner', email: 'jessica@gallatincdjr.com', role: 'salesperson', dealershipId: 'gallatin-cdjr', status: 'active', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', createdAt: new Date('2025-10-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 8) },
  { id: 'u-005', displayName: 'Derek Coleman', email: 'derek@gallatincdjr.com', role: 'porter', dealershipId: 'gallatin-cdjr', status: 'active', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', createdAt: new Date('2025-11-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 3) },

  // Music City Toyota
  { id: 'u-006', displayName: 'Sarah Mitchell', email: 'sarah@musiccitytoyota.com', role: 'principal', dealershipId: 'music-city-toyota', status: 'active', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', createdAt: new Date('2025-07-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 15) },
  { id: 'u-007', displayName: 'James Patel', email: 'james@musiccitytoyota.com', role: 'generalManager', dealershipId: 'music-city-toyota', status: 'active', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', createdAt: new Date('2025-08-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 1) },
  { id: 'u-008', displayName: 'Angela Rivera', email: 'angela@musiccitytoyota.com', role: 'salesManager', dealershipId: 'music-city-toyota', status: 'active', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', createdAt: new Date('2025-09-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  { id: 'u-009', displayName: 'Tyler Brooks', email: 'tyler@musiccitytoyota.com', role: 'salesperson', dealershipId: 'music-city-toyota', status: 'active', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', createdAt: new Date('2025-10-15'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 12) },
  { id: 'u-010', displayName: 'Kayla Henderson', email: 'kayla@musiccitytoyota.com', role: 'detailer', dealershipId: 'music-city-toyota', status: 'disabled', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', createdAt: new Date('2025-11-15') },

  // Franklin Chevrolet
  { id: 'u-011', displayName: 'David Chen', email: 'david@franklinchevrolet.com', role: 'principal', dealershipId: 'franklin-chevrolet', status: 'active', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', createdAt: new Date('2025-06-15'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 30) },
  { id: 'u-012', displayName: 'Megan Foster', email: 'megan@franklinchevrolet.com', role: 'generalManager', dealershipId: 'franklin-chevrolet', status: 'active', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', createdAt: new Date('2025-07-15'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 6) },
  { id: 'u-013', displayName: 'Nathan Park', email: 'nathan@franklinchevrolet.com', role: 'serviceManager', dealershipId: 'franklin-chevrolet', status: 'active', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', createdAt: new Date('2025-08-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: 'u-014', displayName: 'Rachel Adams', email: 'rachel@franklinchevrolet.com', role: 'salesperson', dealershipId: 'franklin-chevrolet', status: 'pending', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', createdAt: new Date('2026-02-20') },

  // Hendersonville Ford
  { id: 'u-015', displayName: 'Brian Wallace', email: 'brian@hendersonvilleford.com', role: 'principal', dealershipId: 'hendersonville-ford', status: 'active', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', createdAt: new Date('2025-05-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 1) },
  { id: 'u-016', displayName: 'Amanda Cruz', email: 'amanda@hendersonvilleford.com', role: 'salesManager', dealershipId: 'hendersonville-ford', status: 'active', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', createdAt: new Date('2025-06-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 3) },
  { id: 'u-017', displayName: 'Chris Nguyen', email: 'chris@hendersonvilleford.com', role: 'salesperson', dealershipId: 'hendersonville-ford', status: 'active', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', createdAt: new Date('2025-09-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) },
  { id: 'u-018', displayName: 'Olivia Grant', email: 'olivia@hendersonvilleford.com', role: 'porter', dealershipId: 'hendersonville-ford', status: 'active', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', createdAt: new Date('2025-12-01'), lastActiveAt: new Date(Date.now() - 1000 * 60 * 60 * 5) },
] as const;

// ---------------------------------------------------------------------------
// Tenant color mapping for visual differentiation
// ---------------------------------------------------------------------------

const TENANT_COLORS: Record<string, string> = {
  'gallatin-cdjr': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'music-city-toyota': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'franklin-chevrolet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'hendersonville-ford': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
} as const;

// ---------------------------------------------------------------------------
// Action Dropdown
// ---------------------------------------------------------------------------

function ActionMenu({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-44 rounded-[var(--radius-rally-lg)] bg-[var(--surface-overlay)] border border-[var(--surface-border)] shadow-xl py-1"
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-border)] hover:text-[var(--text-primary)] transition-colors"
        onClick={() => {
          // TODO: Navigate to user detail
          onClose();
        }}
      >
        <Eye className="h-3.5 w-3.5" />
        View Profile
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--rally-gold)] hover:bg-[var(--surface-border)] transition-colors"
        onClick={() => {
          // TODO: Impersonate user
          onClose();
        }}
      >
        <UserCog className="h-3.5 w-3.5" />
        Impersonate
      </button>
      <div className="my-1 border-t border-[var(--surface-border)]" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--surface-border)] transition-colors"
        onClick={() => {
          // TODO: Disable user
          onClose();
        }}
      >
        <Ban className="h-3.5 w-3.5" />
        {user.status === 'disabled' ? 'Enable' : 'Disable'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Cell
// ---------------------------------------------------------------------------

function ActionCell({ user }: { user: SystemUser }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-rally)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && <ActionMenu user={user} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<SystemUser, unknown>[] = [
  {
    accessorKey: 'displayName',
    header: 'Name',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar name={user.displayName} src={user.photoURL} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] truncate">
              {user.email}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => {
      const role = row.original.role;
      return (
        <Badge variant={ROLE_BADGE_VARIANT[role] ?? 'default'} size="sm">
          {USER_ROLE_DISPLAY[role] ?? role}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'tenantName',
    header: 'Tenant',
    cell: ({ row }) => {
      const { tenantSlug, tenantName } = row.original;
      const colorClass = TENANT_COLORS[tenantSlug] ?? 'bg-surface-overlay text-text-secondary border-surface-border';
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass}`}>
          {tenantName}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant={STATUS_BADGE_VARIANT[status] ?? 'default'} size="sm">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'lastActiveAt',
    header: 'Last Active',
    cell: ({ row }) => {
      const lastActive = row.original.lastActiveAt;
      if (!lastActive) {
        return <span className="text-xs text-[var(--text-disabled)]">Never</span>;
      }
      return <RelativeTime date={lastActive} />;
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.lastActiveAt?.getTime() ?? 0;
      const b = rowB.original.lastActiveAt?.getTime() ?? 0;
      return a - b;
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <ActionCell user={row.original} />,
    enableSorting: false,
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SystemUsersPage() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real Firestore collectionGroup query across all tenants
  const users = MOCK_USERS as unknown as SystemUser[];

  // Compute filter counts
  const filterOptionsWithCounts: FilterOption[] = useMemo(() => {
    return ROLE_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? users.length
          : users.filter((u) => u.role === opt.value).length,
    }));
  }, [users]);

  // Filter by role + search
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      );
    }

    return result;
  }, [users, roleFilter, search]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[var(--rally-gold)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            System Users
          </h1>
          <Badge variant="default" size="md">
            {filteredUsers.length}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        All users across all tenants. Manage roles, access, and impersonation.
      </p>

      {/* Filter Bar */}
      <FilterBar
        options={filterOptionsWithCounts}
        selected={roleFilter}
        onSelect={setRoleFilter}
      />

      {/* Search */}
      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        startIcon={<Search className="h-4 w-4" />}
      />

      {/* Empty State */}
      {!loading && filteredUsers.length === 0 && (
        <EmptyState
          icon={Users}
          title="No users found"
          description={
            search
              ? `No users match "${search}". Try a different search term.`
              : 'No users match the current filters.'
          }
        />
      )}

      {/* Data Table */}
      {(loading || filteredUsers.length > 0) && (
        <DataTable<SystemUser>
          columns={columns}
          data={filteredUsers}
          loading={loading}
          globalFilter={search}
          emptyIcon={Users}
          emptyMessage="No users found"
          emptyDescription="Try adjusting your search or filters."
          defaultPageSize={25}
        />
      )}
    </div>
  );
}
