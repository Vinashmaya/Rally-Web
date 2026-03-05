'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Image,
  Palette,
  Link2,
  Bell,
  Mail,
  AlertTriangle,
  Activity,
  User,
  Shield,
  LogOut,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Skeleton,
  Avatar,
} from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import { USER_ROLE_DISPLAY, type UserRole } from '@rally/firebase';

// ---------------------------------------------------------------------------
// ToggleRow — disabled toggle with label + description
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
}

function ToggleRow({ icon: Icon, label, description, checked }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-text-tertiary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-not-allowed opacity-50 ${
          checked
            ? 'bg-rally-gold'
            : 'bg-surface-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          } mt-0.5`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CRM Integration row
// ---------------------------------------------------------------------------

interface IntegrationRowProps {
  name: string;
  status: 'connected' | 'not-connected';
}

function IntegrationRow({ name, status }: IntegrationRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Link2 className="h-4 w-4 text-text-tertiary shrink-0" />
      <span className="text-sm font-medium text-text-primary flex-1">
        {name}
      </span>
      <Badge
        variant={status === 'connected' ? 'success' : 'default'}
        size="sm"
      >
        {status === 'connected' ? 'Connected' : 'Not Connected'}
      </Badge>
      <Button variant="ghost" size="sm" disabled>
        Configure
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton variant="text" className="h-8 w-32" />
      <Skeleton variant="card" className="h-40" />
      <Skeleton variant="card" className="h-48" />
      <Skeleton variant="card" className="h-48" />
      <Skeleton variant="card" className="h-32" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManageSettingsPage() {
  const router = useRouter();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const dealerUser = useAuthStore((s) => s.dealerUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const activeStore = useTenantStore((s) => s.activeStore);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/login');
  }, [signOut, router]);

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const displayName = dealerUser?.displayName ?? firebaseUser?.displayName ?? 'User';
  const email = dealerUser?.email ?? firebaseUser?.email ?? '--';
  const role = (dealerUser?.role ?? 'salesperson') as UserRole;
  const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Staff';

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Management console configuration
        </p>
      </div>

      {/* Branding */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Branding</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-rally-lg bg-surface-overlay border border-surface-border shrink-0">
                {activeStore?.logoUrl ? (
                  <img
                    src={activeStore.logoUrl}
                    alt={`${activeStore.name} logo`}
                    className="h-full w-full object-contain rounded-rally-lg"
                  />
                ) : (
                  <Image className="h-8 w-8 text-text-disabled" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Store Logo</p>
                <p className="text-xs text-text-tertiary">
                  {activeStore?.logoUrl ? 'Logo uploaded' : 'No logo uploaded'}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled>
                Upload Logo
              </Button>
            </div>

            {/* Primary Color */}
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-rally-lg border border-surface-border shrink-0"
                style={{
                  backgroundColor: activeStore?.primaryColor ?? 'var(--rally-gold)',
                }}
              >
                <Palette className="h-6 w-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">Primary Color</p>
                <p className="text-xs text-text-tertiary font-mono">
                  {activeStore?.primaryColor ?? '#D4A017'}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled>
                Change Color
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-text-tertiary">
            Branding changes will be available in a future update.
          </p>
        </CardContent>
      </Card>

      {/* CRM Integration */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            CRM Integration
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
            <IntegrationRow name="Vincue" status="not-connected" />
            <IntegrationRow name="DriveCentric" status="not-connected" />
            <IntegrationRow name="eLead" status="not-connected" />
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            CRM integrations will be available in a future update.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Notifications
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
            <ToggleRow
              icon={Mail}
              label="Daily Summary Email"
              description="Receive daily inventory and activity summary"
              checked={false}
            />
            <ToggleRow
              icon={AlertTriangle}
              label="Stale Inventory Alerts"
              description="Get notified when vehicles exceed aging threshold"
              checked={false}
            />
            <ToggleRow
              icon={Activity}
              label="New Activity Notifications"
              description="Real-time alerts for test drives and showings"
              checked={false}
            />
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            Email notifications will be available in a future update.
          </p>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Account</h2>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Avatar
              name={displayName}
              src={dealerUser?.photoURL ?? firebaseUser?.photoURL ?? undefined}
              size="lg"
            />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {displayName}
              </p>
              <p className="text-xs text-text-secondary truncate">{email}</p>
              <Badge variant="gold" size="sm" className="w-fit">
                {roleDisplay}
              </Badge>
            </div>
          </div>
          <Button
            variant="danger"
            size="md"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
