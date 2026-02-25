'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Globe,
  Calendar,
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
// Types (derived from Firestore schema)
// ---------------------------------------------------------------------------

interface TenantStoreDetail {
  id: string;
  name: string;
  city: string;
  state: string;
  phone?: string;
  status: 'active' | 'suspended';
}

interface TenantDetail {
  id: string;
  name: string;
  ownerId: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  featureFlags?: Record<string, boolean>;
  stores: TenantStoreDetail[];
  stats: {
    users: number;
    stores: number;
    vehicles: number;
  };
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  status: TenantDetail['status'],
): 'success' | 'error' {
  return status === 'active' ? 'success' : 'error';
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

  // Fetch tenant detail from API
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    fetch(`/api/admin/tenants/${groupId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          setTenant(json.data as TenantDetail);
        }
      })
      .catch(() => {
        setTenant(null);
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ---------------------------------------------------------------------------
  // Action handlers — wired to real API routes
  // ---------------------------------------------------------------------------

  const handleToggleSuspend = useCallback(async () => {
    if (!tenant) return;

    const endpoint = tenant.status === 'suspended' ? 'activate' : 'suspend';
    try {
      const res = await fetch(`/api/admin/tenants/${groupId}/${endpoint}`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok) {
        toast({ type: 'error', title: 'Action failed', description: json.error ?? 'Unknown error' });
        return;
      }

      const action = endpoint === 'activate' ? 'activated' : 'suspended';
      toast({
        type: action === 'activated' ? 'success' : 'warning',
        title: `Tenant ${action}`,
        description: `${tenant.name} has been ${action}.`,
      });

      // Refresh data
      setTenant((prev) => prev ? { ...prev, status: endpoint === 'activate' ? 'active' : 'suspended' } : prev);
    } catch {
      toast({ type: 'error', title: 'Network error', description: 'Could not reach the server.' });
    }
  }, [tenant, groupId, toast]);

  const handleImpersonate = useCallback(() => {
    toast({
      type: 'info',
      title: 'Impersonation not yet implemented',
      description: 'This feature will open the tenant portal as the principal user.',
    });
  }, [toast]);

  const handleDelete = useCallback(async () => {
    if (!tenant) return;
    if (deleteConfirmText !== groupId) return;

    try {
      const res = await fetch(`/api/admin/tenants/${groupId}/deprovision`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok) {
        toast({ type: 'error', title: 'Delete failed', description: json.error ?? 'Unknown error' });
        return;
      }

      toast({
        type: 'warning',
        title: 'Tenant deprovisioned',
        description: `${tenant.name} has been scheduled for deletion (30-day recovery window).`,
      });
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      router.push('/tenants');
    } catch {
      toast({ type: 'error', title: 'Network error', description: 'Could not reach the server.' });
    }
  }, [tenant, deleteConfirmText, groupId, toast, router]);

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
              {tenant.name}
            </h1>
            <Badge variant={getStatusBadgeVariant(tenant.status)} size="md">
              {tenant.status}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1 font-[family-name:var(--font-geist-mono)]">
            {tenant.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/tenants`)}>
            <ExternalLink className="h-4 w-4" />
            All Tenants
          </Button>
        </div>
      </div>

      {/* ── Info Card ──────────────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Globe className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Group ID</p>
                <p className="text-sm text-text-primary font-[family-name:var(--font-geist-mono)] mt-0.5">
                  {tenant.id}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Created</p>
                <p className="text-sm text-text-primary mt-0.5">
                  {tenant.createdAt ? formatDate(tenant.createdAt) : '--'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-tertiary uppercase tracking-wider">Owner</p>
                <p className="text-sm text-text-primary font-[family-name:var(--font-geist-mono)] mt-0.5">
                  {tenant.ownerId || '--'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                      {store.city && store.state && (
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {store.city}, {store.state}
                        </span>
                      )}
                      {store.phone && (
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {store.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <p className="text-xs text-text-tertiary font-[family-name:var(--font-geist-mono)]">
                      {store.id}
                    </p>
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
                    : 'Disable portal access for all users. Reversible.'
                  }
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
                  Access the tenant portal as the owner. All actions are logged.
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
                  This will soft-delete <strong>{tenant.name}</strong> and disable all
                  {' '}{tenant.stats.users} user accounts. The tenant will have a 30-day recovery
                  window before permanent deletion.
                </p>
                <p className="text-xs text-text-tertiary">
                  Type <span className="font-[family-name:var(--font-geist-mono)] text-rally-gold">{groupId}</span> to
                  confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={groupId}
                  className="flex h-10 w-full rounded-rally bg-surface-overlay border border-surface-border px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base font-[family-name:var(--font-geist-mono)]"
                />
              </CardContent>
              <CardFooter className="gap-3 pt-4">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteConfirmText !== groupId}
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
