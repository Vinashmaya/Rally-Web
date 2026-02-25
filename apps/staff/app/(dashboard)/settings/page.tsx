'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Shield,
  MapPin,
  Building2,
  LogOut,
  Map,
  Bell,
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
import { useToast } from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import { USER_ROLE_DISPLAY, type UserRole, updateUserPreferences } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Detail row component
// ---------------------------------------------------------------------------

interface SettingRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function SettingRow({ icon: Icon, label, value }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] w-28 shrink-0">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle row component
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ icon: Icon, label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          checked
            ? 'bg-[var(--rally-gold)]'
            : 'bg-[var(--surface-border)]'
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
// Loading skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" className="h-16 w-16" />
        <div className="flex flex-col gap-1">
          <Skeleton variant="text" className="h-6 w-40" />
          <Skeleton variant="text" className="h-4 w-24" />
        </div>
      </div>
      <Skeleton variant="card" className="h-48" />
      <Skeleton variant="card" className="h-32" />
      <Skeleton variant="card" className="h-32" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const dealerUser = useAuthStore((s) => s.dealerUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const activeStore = useTenantStore((s) => s.activeStore);

  // Local preference state — initialized from Firestore, writes back on change
  const preferences = dealerUser?.preferences;
  const [mapView, setMapView] = useState<string>(preferences?.defaultMapView ?? 'map');
  const [notifications, setNotifications] = useState<boolean>(preferences?.notificationsEnabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push('/login');
  }, [signOut, router]);

  const handlePreferenceChange = useCallback(async (key: string, value: unknown) => {
    const uid = firebaseUser?.uid;
    if (!uid) return;

    setSaving(true);
    try {
      const updatedPrefs = {
        ...preferences,
        [key]: value,
      };
      await updateUserPreferences(uid, updatedPrefs);
      toast({ type: 'success', title: 'Preference saved' });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Could not update preference.',
      });
    } finally {
      setSaving(false);
    }
  }, [firebaseUser?.uid, preferences, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <SettingsSkeleton />
      </div>
    );
  }

  const displayName = dealerUser?.displayName ?? firebaseUser?.displayName ?? 'User';
  const email = dealerUser?.email ?? firebaseUser?.email ?? '--';
  const phone = dealerUser?.phone ?? '--';
  const role = (dealerUser?.role ?? 'salesperson') as UserRole;
  const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Staff';
  const photoURL = dealerUser?.photoURL ?? firebaseUser?.photoURL ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>

      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar
          name={displayName}
          src={photoURL}
          size="lg"
        />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {displayName}
          </h2>
          <Badge variant="gold" size="sm">
            {roleDisplay}
          </Badge>
        </div>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Profile</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-[var(--surface-border)]">
            <SettingRow icon={User} label="Name" value={displayName} />
            <SettingRow icon={Mail} label="Email" value={email} />
            <SettingRow icon={Phone} label="Phone" value={phone} />
            <SettingRow icon={Shield} label="Role" value={roleDisplay} />
          </div>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">
            Profile information is managed by your administrator.
          </p>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Preferences</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-[var(--surface-border)]">
            <ToggleRow
              icon={Map}
              label="Satellite Map View"
              description="Use satellite imagery as the default map view"
              checked={mapView === 'satellite'}
              onChange={(checked) => {
                const newVal = checked ? 'satellite' : 'map';
                setMapView(newVal);
                handlePreferenceChange('defaultMapView', newVal);
              }}
              disabled={saving}
            />
            <ToggleRow
              icon={Bell}
              label="Notifications"
              description="Receive push notifications for activity updates"
              checked={notifications}
              onChange={(checked) => {
                setNotifications(checked);
                handlePreferenceChange('notificationsEnabled', checked);
              }}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Store Info */}
      {activeStore && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Current Store
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-[var(--surface-border)]">
              <SettingRow icon={Building2} label="Store" value={activeStore.name} />
              <SettingRow
                icon={MapPin}
                label="Address"
                value={`${activeStore.address}, ${activeStore.city}, ${activeStore.state} ${activeStore.zipCode}`}
              />
              {activeStore.phone && (
                <SettingRow icon={Phone} label="Phone" value={activeStore.phone} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account actions */}
      <Card>
        <CardContent>
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
