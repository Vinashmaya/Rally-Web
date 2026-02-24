'use client';

import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Shield,
  Car,
  Timer,
  Compass,
  UserCheck,
  IdCard,
  DollarSign,
  Hourglass,
  RefreshCw,
  Hash,
  AlertTriangle,
  AlertOctagon,
  Paintbrush,
  Route,
  Fuel,
  Camera,
  CheckCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import type { Store, DealershipSettings, StoreFeatureFlags } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Helper: meters to miles (1 decimal)
// ---------------------------------------------------------------------------

function metersToMiles(meters: number): string {
  return (meters / 1609.34).toFixed(1);
}

// ---------------------------------------------------------------------------
// Helper: format currency
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// SettingRow — icon + label + value
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
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] w-32 shrink-0">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] truncate">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleRow — disabled switch with label + description
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
}

function ToggleRow({ label, description, checked }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 cursor-not-allowed opacity-50 ${
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
// SectionHeader — groups operational settings
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--rally-gold)] pt-4 pb-1">
      {title}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// StoreCard — clickable store in multi-store selector
// ---------------------------------------------------------------------------

interface StoreCardProps {
  store: Store;
  isActive: boolean;
  onSelect: () => void;
}

function StoreCard({ store, isActive, onSelect }: StoreCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-rally-lg border transition-colors duration-150 text-left w-full cursor-pointer ${
        isActive
          ? 'border-[var(--rally-gold)] bg-[var(--rally-gold)]/10'
          : 'border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--surface-borderHover)]'
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-overlay)] shrink-0">
        <Building2 className="h-5 w-5 text-[var(--text-tertiary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
          {store.name}
        </p>
        <p className="text-xs text-[var(--text-tertiary)] truncate">
          {store.address}, {store.city}, {store.state}
        </p>
      </div>
      {isActive && (
        <CheckCircle className="h-5 w-5 text-[var(--rally-gold)] shrink-0" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="h-6 w-24" />
      </div>
      <Skeleton variant="card" className="h-64" />
      <Skeleton variant="card" className="h-48" />
      <Skeleton variant="card" className="h-80" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Flags section
// ---------------------------------------------------------------------------

function FeatureFlagsCard({ flags }: { flags: StoreFeatureFlags }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Feature Flags</h2>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-[var(--surface-border)]">
          <ToggleRow
            label="Detail Tracking"
            description="Track time spent on vehicle details"
            checked={flags.detailTrackingEnabled}
          />
          <ToggleRow
            label="Fuel Level Tracking"
            description="Require fuel level on return from activities"
            checked={flags.fuelTrackingEnabled}
          />
          <ToggleRow
            label="Delivery Photos"
            description="Require photos at vehicle delivery"
            checked={flags.photoRequiredOnDelivery}
          />
        </div>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Contact admin to change feature flags.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Operational Settings section
// ---------------------------------------------------------------------------

function OperationalSettingsCard({ settings }: { settings: DealershipSettings }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Operational Settings</h2>
      </CardHeader>
      <CardContent>
        {/* Test Drive */}
        <SectionHeader title="Test Drive" />
        <div className="flex flex-col divide-y divide-[var(--surface-border)]">
          <SettingRow
            icon={Timer}
            label="Max Duration"
            value={`${settings.testDriveMaxDuration} minutes`}
          />
          <SettingRow
            icon={Compass}
            label="Geofence Radius"
            value={`${metersToMiles(settings.testDriveGeofenceRadius)} miles`}
          />
          <SettingRow
            icon={UserCheck}
            label="Customer Info"
            value={settings.requireCustomerInfo ? 'Required' : 'Optional'}
          />
          <SettingRow
            icon={IdCard}
            label="License Check"
            value={settings.requireLicenseVerification ? 'Required' : 'Optional'}
          />
          {settings.requireManagerApprovalAbovePrice != null && (
            <SettingRow
              icon={DollarSign}
              label="Mgr Approval"
              value={`Above ${formatCurrency(settings.requireManagerApprovalAbovePrice)}`}
            />
          )}
        </div>

        {/* Hold */}
        <SectionHeader title="Hold" />
        <div className="flex flex-col divide-y divide-[var(--surface-border)]">
          <SettingRow
            icon={Hourglass}
            label="Expiration"
            value={`${settings.holdExpirationHours} hours`}
          />
          <SettingRow
            icon={RefreshCw}
            label="Extensions"
            value={settings.allowHoldExtensions ? 'Allowed' : 'Disabled'}
          />
          {settings.allowHoldExtensions && (
            <SettingRow
              icon={Hash}
              label="Max Extensions"
              value={String(settings.maxHoldExtensions)}
            />
          )}
        </div>

        {/* Alert Thresholds */}
        <SectionHeader title="Alert Thresholds" />
        <div className="flex flex-col divide-y divide-[var(--surface-border)]">
          <SettingRow
            icon={AlertTriangle}
            label="Lot Warning"
            value={`${settings.daysOnLotWarning} days`}
          />
          <SettingRow
            icon={AlertOctagon}
            label="Lot Critical"
            value={`${settings.daysOnLotCritical} days`}
          />
          <SettingRow
            icon={Paintbrush}
            label="Detail Warning"
            value={`${settings.detailTimeWarningMinutes} minutes`}
          />
          <SettingRow
            icon={Route}
            label="Test Drive Warn"
            value={`${settings.testDriveTimeWarningMinutes} minutes`}
          />
        </div>

        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Operational settings are managed by your administrator.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StoresPage() {
  const activeStore = useTenantStore((s) => s.activeStore);
  const availableStores = useTenantStore((s) => s.availableStores);
  const switchStore = useTenantStore((s) => s.switchStore);
  const isLoading = useTenantStore((s) => s.isLoading);

  if (isLoading || !activeStore) {
    return <SettingsSkeleton />;
  }

  const fullAddress = `${activeStore.address}, ${activeStore.city}, ${activeStore.state} ${activeStore.zipCode}`;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Store Settings
        </h1>
        <Badge variant="gold" size="sm">
          {activeStore.name}
        </Badge>
      </div>

      {/* Multi-Store Selector */}
      {availableStores.length > 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Your Stores
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableStores.map((store) => (
                <StoreCard
                  key={store.id ?? store.name}
                  store={store}
                  isActive={store.id === activeStore.id}
                  onSelect={() => switchStore(store)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Information */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Store Information
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-[var(--surface-border)]">
            <SettingRow icon={Building2} label="Name" value={activeStore.name} />
            <SettingRow icon={MapPin} label="Address" value={fullAddress} />
            {activeStore.phone && (
              <SettingRow icon={Phone} label="Phone" value={activeStore.phone} />
            )}
            <SettingRow icon={Clock} label="Timezone" value={activeStore.timezone} />
            <SettingRow
              icon={Shield}
              label="Status"
              value={activeStore.status === 'active' ? 'Active' : 'Suspended'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <FeatureFlagsCard flags={activeStore.featureFlags} />

      {/* Operational Settings */}
      <OperationalSettingsCard settings={activeStore.settings} />
    </div>
  );
}
