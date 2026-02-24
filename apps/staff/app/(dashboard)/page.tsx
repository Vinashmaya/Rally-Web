'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Car,
  Users,
  Route,
  TrendingUp,
  ScanLine,
  Eye,
  Clock,
  AlertTriangle,
  Fuel,
  Battery,
  ArrowRight,
  Truck,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
  Button,
  ActivityBadge,
  Avatar,
  RelativeTime,
} from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import {
  useVehicles,
  useActivities,
  USER_ROLE_DISPLAY,
  isSalesRole,
  isManagerRole,
  type UserRole,
  type VehicleActivity,
  type Vehicle,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon: Icon, trend, onClick }: StatCardProps) {
  return (
    <Card variant={onClick ? 'interactive' : 'default'}>
      <CardContent
        className="flex items-start justify-between"
        onClick={onClick}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </span>
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {value}
          </span>
          {trend && (
            <span className="text-xs text-[var(--status-success)]">{trend}</span>
          )}
        </div>
        <div className="rounded-lg bg-[var(--rally-gold-muted)] p-2.5">
          <Icon className="h-5 w-5 text-[var(--rally-gold)]" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quick action button
// ---------------------------------------------------------------------------

interface QuickActionProps {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}

function QuickAction({ label, icon: Icon, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-[var(--radius-rally-lg)] bg-[var(--surface-overlay)] p-4 transition-all duration-150 hover:bg-[var(--surface-border)] hover:shadow-sm cursor-pointer"
    >
      <div className="rounded-full bg-[var(--rally-gold-muted)] p-3">
        <Icon className="h-5 w-5 text-[var(--rally-gold)]" />
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Active activity row
// ---------------------------------------------------------------------------

interface ActivityRowProps {
  activity: VehicleActivity;
  onVehicleClick: () => void;
}

function ActivityRow({ activity, onVehicleClick }: ActivityRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar name={activity.startedByName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">
          <span className="font-medium">{activity.startedByName}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <ActivityBadge activity={activity.state} size="sm" />
          <button
            type="button"
            onClick={onVehicleClick}
            className="font-mono text-xs font-medium text-[var(--rally-gold)] hover:text-[var(--rally-gold-light)] transition-colors cursor-pointer"
          >
            {activity.stockNumber}
          </button>
        </div>
      </div>
      <RelativeTime date={activity.startedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-48" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Salesperson Dashboard
// ---------------------------------------------------------------------------

interface SalespersonDashboardProps {
  firstName: string;
  roleDisplay: string;
  storeName: string;
  vehicles: Vehicle[];
  activities: VehicleActivity[];
  myActivities: VehicleActivity[];
  onNavigate: (path: string) => void;
}

function SalespersonDashboard({
  firstName,
  roleDisplay,
  storeName,
  vehicles,
  activities,
  myActivities,
  onNavigate,
}: SalespersonDashboardProps) {
  const frontlineCount = vehicles.filter((v) => v.status === 'frontline').length;
  const prepCount = vehicles.filter((v) => v.status === 'prep').length;
  const myTestDrives = myActivities.filter((a) => a.state === 'TEST_DRIVE' && a.isActive);
  const myShowings = myActivities.filter((a) => a.state === 'SHOWING' && a.isActive);

  return (
    <>
      {/* Header */}
      <DashboardHeader firstName={firstName} roleDisplay={roleDisplay} storeName={storeName} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="My Test Drives"
          value={String(myTestDrives.length)}
          icon={Route}
          onClick={() => onNavigate('/activity')}
        />
        <StatCard
          label="Vehicles Shown"
          value={String(myShowings.length)}
          icon={Eye}
        />
        <StatCard
          label="Frontline"
          value={String(frontlineCount)}
          icon={Car}
          onClick={() => onNavigate('/inventory')}
        />
        <StatCard
          label="In Prep"
          value={String(prepCount)}
          icon={Clock}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction label="Start Test Drive" icon={Route} onClick={() => onNavigate('/scan')} />
            <QuickAction label="Scan Vehicle" icon={ScanLine} onClick={() => onNavigate('/scan')} />
            <QuickAction label="View Inventory" icon={Car} onClick={() => onNavigate('/inventory')} />
            <QuickAction label="Activity Feed" icon={Eye} onClick={() => onNavigate('/activity')} />
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <ActiveActivitySection
        activities={activities.filter((a) => a.isActive && a.state !== 'AVAILABLE').slice(0, 5)}
        onNavigate={onNavigate}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sales Manager Dashboard
// ---------------------------------------------------------------------------

interface SalesManagerDashboardProps {
  firstName: string;
  roleDisplay: string;
  storeName: string;
  vehicles: Vehicle[];
  activities: VehicleActivity[];
  onNavigate: (path: string) => void;
}

function SalesManagerDashboard({
  firstName,
  roleDisplay,
  storeName,
  vehicles,
  activities,
  onNavigate,
}: SalesManagerDashboardProps) {
  const activeActivities = activities.filter((a) => a.isActive && a.state !== 'AVAILABLE');
  const testDriveCount = activeActivities.filter((a) => a.state === 'TEST_DRIVE').length;
  const showingCount = activeActivities.filter((a) => a.state === 'SHOWING').length;
  const soldCount = activities.filter((a) => a.state === 'SOLD').length;
  const frontlineCount = vehicles.filter((v) => v.status === 'frontline').length;
  const agingVehicles = vehicles.filter((v) => (v.daysOnLot ?? 0) > 45);
  const staleVehicles = vehicles.filter((v) => (v.daysOnLot ?? 0) > 90);
  const vehiclesOnHold = vehicles.filter((v) => v.holdInfo != null);

  // Avg days on lot for frontline
  const frontlineVehicles = vehicles.filter((v) => v.status === 'frontline');
  const avgDaysOnLot = frontlineVehicles.length > 0
    ? Math.round(
        frontlineVehicles.reduce((sum, v) => sum + (v.daysOnLot ?? 0), 0) / frontlineVehicles.length
      )
    : 0;

  return (
    <>
      <DashboardHeader firstName={firstName} roleDisplay={roleDisplay} storeName={storeName} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Active Test Drives"
          value={String(testDriveCount)}
          icon={Route}
          onClick={() => onNavigate('/activity')}
        />
        <StatCard
          label="Currently Showing"
          value={String(showingCount)}
          icon={Eye}
          onClick={() => onNavigate('/activity')}
        />
        <StatCard
          label="Sold"
          value={String(soldCount)}
          icon={TrendingUp}
          trend="This period"
        />
        <StatCard
          label="Avg Days on Lot"
          value={String(avgDaysOnLot)}
          icon={Clock}
        />
      </div>

      {/* Team Activity */}
      <ActiveActivitySection
        activities={activeActivities.slice(0, 8)}
        onNavigate={onNavigate}
        title="Team Activity"
      />

      {/* Inventory Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Inventory Health
            </h2>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('/inventory')}>
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {frontlineCount}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">Frontline</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-[var(--status-warning)] tabular-nums">
                {agingVehicles.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">Aging (45d+)</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-[var(--status-error)] tabular-nums">
                {staleVehicles.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">Stale (90d+)</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {vehiclesOnHold.length}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">On Hold</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Porter Dashboard
// ---------------------------------------------------------------------------

interface PorterDashboardProps {
  firstName: string;
  roleDisplay: string;
  storeName: string;
  vehicles: Vehicle[];
  activities: VehicleActivity[];
  myActivities: VehicleActivity[];
  onNavigate: (path: string) => void;
}

function PorterDashboard({
  firstName,
  roleDisplay,
  storeName,
  vehicles,
  activities,
  myActivities,
  onNavigate,
}: PorterDashboardProps) {
  const fuelingActive = activities.filter((a) => a.isActive && a.state === 'FUELING');
  const chargingActive = activities.filter((a) => a.isActive && a.state === 'CHARGING_RUNNING');
  const offLotActive = activities.filter((a) => a.isActive && a.state === 'OFF_LOT');
  const myRecentMoves = myActivities
    .filter((a) => !a.isActive)
    .slice(0, 5);

  return (
    <>
      <DashboardHeader firstName={firstName} roleDisplay={roleDisplay} storeName={storeName} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Being Fueled"
          value={String(fuelingActive.length)}
          icon={Fuel}
        />
        <StatCard
          label="Charging/Running"
          value={String(chargingActive.length)}
          icon={Battery}
        />
        <StatCard
          label="Off Lot"
          value={String(offLotActive.length)}
          icon={Truck}
          onClick={() => onNavigate('/activity')}
        />
        <StatCard
          label="Total Inventory"
          value={String(vehicles.length)}
          icon={Car}
          onClick={() => onNavigate('/inventory')}
        />
      </div>

      {/* Quick scan — prominent for porters */}
      <Card variant="interactive" onClick={() => onNavigate('/scan')}>
        <CardContent className="flex items-center justify-center gap-3 py-8">
          <div className="rounded-full bg-[var(--rally-gold-muted)] p-4">
            <ScanLine className="h-8 w-8 text-[var(--rally-gold)]" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              Scan Vehicle
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Tap to scan NFC tag or enter stock #
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[var(--rally-gold)]" />
        </CardContent>
      </Card>

      {/* Recent movements */}
      {myRecentMoves.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              My Recent Movements
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-[var(--surface-border)]">
              {myRecentMoves.map((activity) => (
                <div
                  key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
                  className="flex items-center gap-3 py-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-[var(--status-success)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-medium text-[var(--rally-gold)]">
                      {activity.stockNumber}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {' '}&mdash; {activity.yearMakeModel}
                    </span>
                  </div>
                  <ActivityBadge activity={activity.state} size="sm" />
                  <RelativeTime date={activity.endedAt ?? activity.startedAt} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Default Dashboard (other roles)
// ---------------------------------------------------------------------------

interface DefaultDashboardProps {
  firstName: string;
  roleDisplay: string;
  storeName: string;
  vehicles: Vehicle[];
  activities: VehicleActivity[];
  onNavigate: (path: string) => void;
}

function DefaultDashboard({
  firstName,
  roleDisplay,
  storeName,
  vehicles,
  activities,
  onNavigate,
}: DefaultDashboardProps) {
  const frontlineCount = vehicles.filter((v) => v.status === 'frontline').length;
  const activeActivities = activities.filter((a) => a.isActive && a.state !== 'AVAILABLE');
  const soldCount = activities.filter((a) => a.state === 'SOLD').length;

  return (
    <>
      <DashboardHeader firstName={firstName} roleDisplay={roleDisplay} storeName={storeName} />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Inventory"
          value={String(vehicles.length)}
          icon={Car}
          trend={`${frontlineCount} frontline`}
          onClick={() => onNavigate('/inventory')}
        />
        <StatCard
          label="Active Now"
          value={String(activeActivities.length)}
          icon={Users}
          onClick={() => onNavigate('/activity')}
        />
        <StatCard
          label="Test Drives"
          value={String(activeActivities.filter((a) => a.state === 'TEST_DRIVE').length)}
          icon={Route}
        />
        <StatCard
          label="Sold"
          value={String(soldCount)}
          icon={TrendingUp}
        />
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Quick Links</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction label="Inventory" icon={Car} onClick={() => onNavigate('/inventory')} />
            <QuickAction label="Activity" icon={Eye} onClick={() => onNavigate('/activity')} />
            <QuickAction label="Scan" icon={ScanLine} onClick={() => onNavigate('/scan')} />
            <QuickAction label="Lists" icon={Zap} onClick={() => onNavigate('/lists')} />
          </div>
        </CardContent>
      </Card>

      {/* Active activity */}
      <ActiveActivitySection
        activities={activeActivities.slice(0, 5)}
        onNavigate={onNavigate}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared: Dashboard header
// ---------------------------------------------------------------------------

interface DashboardHeaderProps {
  firstName: string;
  roleDisplay: string;
  storeName: string;
}

function DashboardHeader({ firstName, roleDisplay, storeName }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Welcome back, {firstName}
        </h1>
        <Badge variant="gold" size="sm">
          {roleDisplay}
        </Badge>
      </div>
      {storeName && (
        <p className="text-sm text-[var(--text-secondary)]">{storeName}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Active activity section
// ---------------------------------------------------------------------------

interface ActiveActivitySectionProps {
  activities: VehicleActivity[];
  onNavigate: (path: string) => void;
  title?: string;
}

function ActiveActivitySection({ activities, onNavigate, title = 'Active Now' }: ActiveActivitySectionProps) {
  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-success)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--status-success)]" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
            <Badge variant="default" size="sm">{activities.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/activity')}>
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-[var(--surface-border)]">
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
              activity={activity}
              onVehicleClick={() => onNavigate(`/inventory/${activity.vin}`)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.dealerUser);
  const loading = useAuthStore((s) => s.isLoading);
  const currentStore = useTenantStore((s) => s.activeStore);

  const dealershipId = currentStore?.id ?? '';

  const { vehicles, loading: vehiclesLoading } = useVehicles({ dealershipId });
  const { activities, loading: activitiesLoading } = useActivities({
    dealershipId,
    limitCount: 50,
  });

  const firstName = (profile?.displayName ?? user?.displayName ?? 'there').split(' ')[0] ?? 'there';
  const role = (profile?.role ?? 'salesperson') as UserRole;
  const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Staff';
  const storeName = currentStore?.name ?? '';
  const userId = user?.uid ?? '';

  // Filter activities that belong to this user
  const myActivities = useMemo(
    () => activities.filter((a) => a.startedByUserId === userId),
    [activities, userId]
  );

  const onNavigate = (path: string) => router.push(path);

  // Show loading if auth or data is loading
  if (loading || vehiclesLoading || activitiesLoading) {
    return <DashboardSkeleton />;
  }

  // Role-specific dashboards
  switch (role) {
    case 'salesperson':
    case 'bdc_agent':
      return (
        <div className="flex flex-col gap-6">
          <SalespersonDashboard
            firstName={firstName}
            roleDisplay={roleDisplay}
            storeName={storeName}
            vehicles={vehicles}
            activities={activities}
            myActivities={myActivities}
            onNavigate={onNavigate}
          />
        </div>
      );

    case 'sales_manager':
    case 'desk_manager':
    case 'finance_manager':
      return (
        <div className="flex flex-col gap-6">
          <SalesManagerDashboard
            firstName={firstName}
            roleDisplay={roleDisplay}
            storeName={storeName}
            vehicles={vehicles}
            activities={activities}
            onNavigate={onNavigate}
          />
        </div>
      );

    case 'porter':
    case 'detailer':
      return (
        <div className="flex flex-col gap-6">
          <PorterDashboard
            firstName={firstName}
            roleDisplay={roleDisplay}
            storeName={storeName}
            vehicles={vehicles}
            activities={activities}
            myActivities={myActivities}
            onNavigate={onNavigate}
          />
        </div>
      );

    default:
      return (
        <div className="flex flex-col gap-6">
          <DefaultDashboard
            firstName={firstName}
            roleDisplay={roleDisplay}
            storeName={storeName}
            vehicles={vehicles}
            activities={activities}
            onNavigate={onNavigate}
          />
        </div>
      );
  }
}
