'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Skeleton,
  EmptyState,
  useToast,
} from '@rally/ui';
import {
  ArrowLeft,
  Building2,
  Users,
  Car,
  Store,
  Activity,
  Globe,
  Calendar,
  CreditCard,
  User,
  ExternalLink,
  Pause,
  Play,
  UserCheck,
  Trash2,
  AlertTriangle,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantDetail {
  id: string;
  slug: string;
  groupName: string;
  status: 'active' | 'suspended' | 'trial' | 'deprovisioned';
  subdomain: string;
  createdAt: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  principal: {
    name: string;
    email: string;
    uid: string;
  };
  stats: {
    users: number;
    stores: number;
    vehicles: number;
    activeActivities: number;
  };
  stores: Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    phone: string;
    vehicleCount: number;
    userCount: number;
    status: 'active' | 'suspended';
  }>;
}

// ---------------------------------------------------------------------------
// Mock data — TODO: Replace with real API route (GET /api/admin/tenants/[groupId])
// that uses Firebase Admin SDK to fetch group + subcollections
// ---------------------------------------------------------------------------

const MOCK_TENANTS: Record<string, TenantDetail> = {
  grp_001: {
    id: 'grp_001',
    slug: 'gallatin-cdjr',
    groupName: 'Gallatin CDJR',
    status: 'active',
    subdomain: 'gallatin-cdjr.rally.vin',
    createdAt: '2025-11-15T10:30:00Z',
    plan: 'professional',
    principal: {
      name: 'Robert Lisowski',
      email: 'robert@gallatin-cdjr.com',
      uid: 'uid_robert_001',
    },
    stats: {
      users: 45,
      stores: 2,
      vehicles: 892,
      activeActivities: 12,
    },
    stores: [
      {
        id: 'str_001',
        name: 'Gallatin CDJR - Main',
        city: 'Gallatin',
        state: 'TN',
        phone: '(615) 452-1234',
        vehicleCount: 623,
        userCount: 32,
        status: 'active',
      },
      {
        id: 'str_002',
        name: 'Gallatin CDJR - Used',
        city: 'Gallatin',
        state: 'TN',
        phone: '(615) 452-5678',
        vehicleCount: 269,
        userCount: 13,
        status: 'active',
      },
    ],
  },
  grp_002: {
    id: 'grp_002',
    slug: 'nashville-motors',
    groupName: 'Nashville Motors Group',
    status: 'active',
    subdomain: 'nashville-motors.rally.vin',
    createdAt: '2025-12-01T14:00:00Z',
    plan: 'enterprise',
    principal: {
      name: 'James Morrison',
      email: 'james@nashvillemotors.com',
      uid: 'uid_james_002',
    },
    stats: {
      users: 67,
      stores: 3,
      vehicles: 1203,
      activeActivities: 28,
    },
    stores: [
      {
        id: 'str_003',
        name: 'Nashville Motors - Downtown',
        city: 'Nashville',
        state: 'TN',
        phone: '(615) 255-1111',
        vehicleCount: 445,
        userCount: 24,
        status: 'active',
      },
      {
        id: 'str_004',
        name: 'Nashville Motors - Brentwood',
        city: 'Brentwood',
        state: 'TN',
        phone: '(615) 255-2222',
        vehicleCount: 398,
        userCount: 22,
        status: 'active',
      },
      {
        id: 'str_005',
        name: 'Nashville Motors - Hendersonville',
        city: 'Hendersonville',
        state: 'TN',
        phone: '(615) 255-3333',
        vehicleCount: 360,
        userCount: 21,
        status: 'active',
      },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  status: TenantDetail['status'],
): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'suspended':
      return 'error';
    case 'deprovisioned':
      return 'warning';
  }
}

function getPlanBadgeVariant(
  plan: TenantDetail['plan'],
): 'gold' | 'info' | 'success' | 'default' {
  switch (plan) {
    case 'enterprise':
      return 'gold';
    case 'professional':
      return 'info';
    case 'starter':
      return 'success';
    case 'trial':
      return 'default';
  }
}

function getStoreBadgeVariant(
  status: 'active' | 'suspended',
): 'success' | 'error' {
  return status === 'active' ? 'success' : 'error';
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const groupId = typeof params.groupId === 'string' ? params.groupId : (params.groupId?.[0] ?? '');

  // TODO: Replace with real API route query
  const tenant = MOCK_TENANTS[groupId] ?? null;
  const loading = false;

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ---------------------------------------------------------------------------
  // Action handlers — TODO: Wire to real API routes
  // ---------------------------------------------------------------------------

  const handleToggleSuspend = useCallback(() => {
    if (!tenant) return;

    const action = tenant.status === 'suspended' ? 'activated' : 'suspended';
    toast({
      type: action === 'activated' ? 'success' : 'warning',
      title: `Tenant ${action}`,
      description: `${tenant.groupName} has been ${action}.`,
    });
    // TODO: Call POST /api/admin/tenants/[groupId]/suspend or /activate
  }, [tenant, toast]);

  const handleImpersonate = useCallback(() => {
    toast({
      type: 'info',
      title: 'Impersonation not yet implemented',
      description: 'This feature will open the tenant portal as the principal user.',
    });
    // TODO: Generate impersonation token and redirect to tenant portal
  }, [toast]);

  const handleDelete = useCallback(() => {
    if (!tenant) return;
    if (deleteConfirmText !== tenant.slug) return;

    toast({
      type: 'error',
      title: 'Tenant deprovisioned',
      description: `${tenant.groupName} has been scheduled for deletion (30-day recovery window).`,
    });
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
    // TODO: Call POST /api/admin/tenants/[groupId]/deprovision
  }, [tenant, deleteConfirmText, toast]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-6 w-48" />
        <Skeleton variant="card" className="h-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Not found state
  // ---------------------------------------------------------------------------

  if (!tenant) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/tenants')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Button>
        <EmptyState
          icon={Building2}
          title="Tenant not found"
          description={`No tenant found with ID "${groupId}". It may have been deleted or the ID is incorrect.`}
          action={
            <Button
              variant="primary"
              onClick={() => router.push('/tenants')}
            >
              View All Tenants
            </Button>
          }
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main detail view
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* ── Back + Header ──────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/tenants')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {tenant.groupName}
            </h1>
            <Badge variant={getStatusBadgeVariant(tenant.status)} size="md">
              {tenant.status}
            </Badge>
            <Badge variant={getPlanBadgeVariant(tenant.plan)} size="md">
              {tenant.plan}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1 font-[family-name:var(--font-geist-mono)]">
            {tenant.slug}.rally.vin
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://${tenant.subdomain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
              Visit Portal
            </Button>
          </a>
        </div>
      </div>

      {/* ── Info Card ──────────────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Subdomain</p>
                <a
                  href={`https://${tenant.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-rally-gold hover:text-rally-goldLight transition-colors flex items-center gap-1 mt-0.5"
                >
                  {tenant.subdomain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Created</p>
                <p className="text-sm text-text-primary mt-0.5">
                  {formatDate(tenant.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Plan</p>
                <p className="text-sm text-text-primary mt-0.5 capitalize">
                  {tenant.plan}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Principal</p>
                <p className="text-sm text-text-primary mt-0.5">
                  {tenant.principal.name}
                </p>
                <p className="text-xs text-text-tertiary">
                  {tenant.principal.email}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Users className="h-4 w-4 text-rally-gold" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Users</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {tenant.stats.users}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Store className="h-4 w-4 text-status-info" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Stores</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {tenant.stats.stores}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Car className="h-4 w-4 text-status-success" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Vehicles</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {tenant.stats.vehicles.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Activity className="h-4 w-4 text-status-warning" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Active</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {tenant.stats.activeActivities}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Stores List ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-rally-gold" />
              <h2 className="text-sm font-semibold text-text-primary">
                Stores
              </h2>
              <Badge variant="default" size="sm">
                {tenant.stores.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tenant.stores.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No stores"
              description="This tenant has no stores configured yet."
            />
          ) : (
            <div className="divide-y divide-surface-border">
              {tenant.stores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-surface-overlay transition-colors"
                >
                  <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
                    <Building2 className="h-4 w-4 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {store.name}
                      </p>
                      <Badge variant={getStoreBadgeVariant(store.status)} size="sm">
                        {store.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-text-tertiary flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {store.city}, {store.state}
                      </span>
                      <span className="text-xs text-text-tertiary flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {store.phone}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-text-tertiary">Vehicles</p>
                      <p className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary tabular-nums">
                        {store.vehicleCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-tertiary">Users</p>
                      <p className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary tabular-nums">
                        {store.userCount}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Action Buttons ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Actions
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Suspend / Activate */}
          <div className="flex items-center justify-between p-3 rounded-rally bg-surface-overlay border border-surface-border">
            <div className="flex items-center gap-3">
              {tenant.status === 'suspended' ? (
                <Play className="h-4 w-4 text-status-success" />
              ) : (
                <Pause className="h-4 w-4 text-status-warning" />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {tenant.status === 'suspended' ? 'Activate Tenant' : 'Suspend Tenant'}
                </p>
                <p className="text-xs text-text-tertiary">
                  {tenant.status === 'suspended'
                    ? 'Re-enable portal access and user accounts.'
                    : 'Disable portal access for all users. Reversible.'}
                </p>
              </div>
            </div>
            <Button
              variant={tenant.status === 'suspended' ? 'primary' : 'secondary'}
              size="sm"
              onClick={handleToggleSuspend}
            >
              {tenant.status === 'suspended' ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Activate
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Suspend
                </>
              )}
            </Button>
          </div>

          {/* Impersonate */}
          <div className="flex items-center justify-between p-3 rounded-rally bg-surface-overlay border border-surface-border">
            <div className="flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-status-info" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Impersonate Principal
                </p>
                <p className="text-xs text-text-tertiary">
                  Access the tenant portal as {tenant.principal.name}. All actions are logged.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImpersonate}
            >
              <UserCheck className="h-4 w-4" />
              Impersonate
            </Button>
          </div>

          {/* Delete — with confirmation */}
          <div className="flex items-center justify-between p-3 rounded-rally bg-status-error/5 border border-status-error/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-status-error" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Delete Tenant
                </p>
                <p className="text-xs text-text-tertiary">
                  Schedule for deletion with a 30-day recovery window. DNS and vhost remain during recovery.
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          {/* Delete confirmation dialog */}
          {showDeleteConfirm && (
            <Card className="border-status-error/30">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-status-error" />
                  <h3 className="text-sm font-semibold text-text-primary">
                    Confirm Deletion
                  </h3>
                </div>
                <p className="text-sm text-text-secondary">
                  This will soft-delete <strong>{tenant.groupName}</strong> and disable all
                  {' '}{tenant.stats.users} user accounts. The tenant will have a 30-day recovery
                  window before permanent deletion.
                </p>
                <p className="text-xs text-text-tertiary">
                  Type <span className="font-[family-name:var(--font-geist-mono)] text-rally-gold">{tenant.slug}</span> to
                  confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={tenant.slug}
                  className="flex h-10 w-full rounded-rally bg-surface-overlay border border-surface-border px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base font-[family-name:var(--font-geist-mono)]"
                />
              </CardContent>
              <CardFooter className="gap-3 pt-4">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteConfirmText !== tenant.slug}
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Confirm Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
