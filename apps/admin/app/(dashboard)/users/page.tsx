'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Badge,
  Card,
  CardContent,
  Input,
  Avatar,
  EmptyState,
  FilterBar,
  DataTable,
  RelativeTime,
  useToast,
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
  AlertCircle,
  CheckCircle2,
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
  | 'serviceManager'
  // Firestore roles (snake_case from iOS)
  | 'owner'
  | 'general_manager'
  | 'sales_manager'
  | 'service_manager'
  | 'finance_manager'
  | 'desk_manager'
  | 'bdc_agent'
  | 'service_advisor'
  | 'technician'
  | 'parts';

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

const USER_ROLE_DISPLAY: Record<string, string> = {
  superAdmin: 'Super Admin',
  principal: 'Principal',
  generalManager: 'General Manager',
  salesManager: 'Sales Manager',
  salesperson: 'Salesperson',
  porter: 'Porter',
  detailer: 'Detailer',
  serviceManager: 'Service Manager',
  owner: 'Owner',
  general_manager: 'General Manager',
  sales_manager: 'Sales Manager',
  service_manager: 'Service Manager',
  finance_manager: 'Finance Manager',
  desk_manager: 'Desk Manager',
  bdc_agent: 'BDC Agent',
  service_advisor: 'Service Advisor',
  technician: 'Technician',
  parts: 'Parts',
} as const;

const ROLE_BADGE_VARIANT: Record<string, 'gold' | 'info' | 'success' | 'warning' | 'default'> = {
  superAdmin: 'gold',
  principal: 'info',
  generalManager: 'info',
  salesManager: 'info',
  salesperson: 'default',
  porter: 'default',
  detailer: 'default',
  serviceManager: 'success',
  owner: 'gold',
  general_manager: 'info',
  sales_manager: 'info',
  service_manager: 'success',
  finance_manager: 'info',
  desk_manager: 'info',
  bdc_agent: 'default',
  service_advisor: 'default',
  technician: 'default',
  parts: 'default',
} as const;

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  active: 'success',
  disabled: 'error',
  pending: 'warning',
  suspended: 'error',
} as const;

const ROLE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'service_manager', label: 'Service Manager' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'desk_manager', label: 'Desk Manager' },
  { value: 'salesperson', label: 'Salesperson' },
  { value: 'bdc_agent', label: 'BDC Agent' },
  { value: 'porter', label: 'Porter' },
  { value: 'detailer', label: 'Detailer' },
  { value: 'technician', label: 'Technician' },
  { value: 'parts', label: 'Parts' },
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
// API response item shape (from GET /api/admin/users)
// ---------------------------------------------------------------------------

interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  dealershipId: string;
  groupId: string;
  joinedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helper: map API response → SystemUser
// ---------------------------------------------------------------------------

function mapApiUserToSystemUser(apiUser: ApiUser): SystemUser {
  return {
    id: apiUser.id,
    email: apiUser.email || `${apiUser.id}@rally.vin`,
    displayName: apiUser.displayName || apiUser.id,
    role: (apiUser.role ?? 'salesperson') as UserRole,
    dealershipId: apiUser.dealershipId,
    status: (apiUser.status === 'disabled' ? 'disabled' : 'active') as SystemUser['status'],
    createdAt: apiUser.joinedAt ? new Date(apiUser.joinedAt) : new Date(),
    tenantName: apiUser.groupId,
    tenantSlug: apiUser.groupId,
  };
}

// ---------------------------------------------------------------------------
// Action Dropdown
// ---------------------------------------------------------------------------

function ActionMenu({
  user,
  onClose,
  onAction,
}: {
  user: SystemUser;
  onClose: () => void;
  onAction: (uid: string, action: 'view' | 'impersonate' | 'disable' | 'enable') => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-44 rounded-[var(--radius-rally-lg)] bg-[var(--surface-overlay)] border border-[var(--surface-border)] shadow-xl py-1"
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-border)] hover:text-[var(--text-primary)] transition-colors"
        onClick={() => {
          onAction(user.id, 'view');
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
          onAction(user.id, 'impersonate');
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
          onAction(user.id, user.status === 'disabled' ? 'enable' : 'disable');
          onClose();
        }}
      >
        {user.status === 'disabled' ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Ban className="h-3.5 w-3.5" />
        )}
        {user.status === 'disabled' ? 'Enable' : 'Disable'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Cell
// ---------------------------------------------------------------------------

function ActionCell({
  user,
  onAction,
}: {
  user: SystemUser;
  onAction: (uid: string, action: 'view' | 'impersonate' | 'disable' | 'enable') => void;
}) {
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
      {open && (
        <ActionMenu
          user={user}
          onClose={() => setOpen(false)}
          onAction={onAction}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SystemUsersPage() {
  const { toast } = useToast();
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Fetch users from server-side API (merges Firebase Auth + Firestore memberships)
  const [rawUsers, setRawUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: ApiUser[]; error?: string }) => {
        if (json.success && json.data) {
          setRawUsers(json.data);
        } else {
          setError(new Error(json.error ?? 'Failed to load users'));
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error('Failed to load users'));
      })
      .finally(() => setLoading(false));
  }, []);

  // Map API response → SystemUser[]
  const users: SystemUser[] = useMemo(
    () => rawUsers.map(mapApiUserToSystemUser),
    [rawUsers],
  );

  // User action handler
  const handleUserAction = useCallback(
    async (uid: string, action: 'view' | 'impersonate' | 'disable' | 'enable') => {
      if (action === 'view') {
        toast({
          type: 'info',
          title: 'User Profile',
          description: `Viewing profile for user ${uid}`,
        });
        return;
      }

      if (action === 'impersonate') {
        toast({
          type: 'info',
          title: 'Impersonation',
          description: 'Impersonation coming soon',
        });
        return;
      }

      try {
        const res = await fetch(`/api/admin/users/${uid}/${action}`, {
          method: 'POST',
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
          throw new Error(body.message ?? `Failed to ${action} user`);
        }

        toast({
          type: 'success',
          title: `User ${action}d`,
          description: `Successfully ${action}d the user.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast({
          type: 'error',
          title: `Failed to ${action} user`,
          description: message,
        });
      }
    },
    [toast],
  );

  // Column definitions (inside component to access handleUserAction)
  const columns: ColumnDef<SystemUser, unknown>[] = useMemo(() => [
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
      cell: ({ row }) => (
        <ActionCell user={row.original} onAction={handleUserAction} />
      ),
      enableSorting: false,
    },
  ], [handleUserAction]);

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

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-status-error shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Failed to load users</p>
              <p className="text-xs text-text-tertiary mt-1">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
