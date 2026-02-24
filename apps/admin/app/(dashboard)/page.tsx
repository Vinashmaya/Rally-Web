'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Skeleton,
  StatChart,
} from '@rally/ui';
import type { StatChartDataPoint } from '@rally/ui';
import {
  Building2,
  Users,
  Car,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Server,
  Plus,
  ScrollText,
  Activity,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Mock Data — TODO: Replace with real Firestore admin queries via API routes
// ---------------------------------------------------------------------------

const MOCK_KPI = [
  {
    label: 'Total Tenants',
    value: '12',
    change: '+2',
    changeLabel: 'this month',
    icon: Building2,
    sparkline: [
      { value: 4 }, { value: 5 }, { value: 6 }, { value: 6 },
      { value: 7 }, { value: 8 }, { value: 9 }, { value: 10 },
      { value: 10 }, { value: 11 }, { value: 11 }, { value: 12 },
    ] satisfies StatChartDataPoint[],
  },
  {
    label: 'Total Users',
    value: '342',
    change: '+28',
    changeLabel: 'this month',
    icon: Users,
    sparkline: [
      { value: 210 }, { value: 228 }, { value: 245 }, { value: 261 },
      { value: 278 }, { value: 290 }, { value: 302 }, { value: 310 },
      { value: 318 }, { value: 325 }, { value: 334 }, { value: 342 },
    ] satisfies StatChartDataPoint[],
  },
  {
    label: 'Active Vehicles',
    value: '4,891',
    change: '+156',
    changeLabel: 'this week',
    icon: Car,
    sparkline: [
      { value: 4200 }, { value: 4310 }, { value: 4380 }, { value: 4420 },
      { value: 4490 }, { value: 4550 }, { value: 4610 }, { value: 4680 },
      { value: 4720 }, { value: 4790 }, { value: 4840 }, { value: 4891 },
    ] satisfies StatChartDataPoint[],
  },
  {
    label: 'System Uptime',
    value: '99.97%',
    change: '47d',
    changeLabel: 'since last restart',
    icon: Clock,
    sparkline: [
      { value: 99.9 }, { value: 100 }, { value: 100 }, { value: 99.8 },
      { value: 100 }, { value: 100 }, { value: 100 }, { value: 99.95 },
      { value: 100 }, { value: 100 }, { value: 99.99 }, { value: 99.97 },
    ] satisfies StatChartDataPoint[],
  },
] as const;

// TODO: Replace with real audit log query via API route (GET /api/admin/audit-log?limit=10)
const MOCK_ACTIVITY = [
  { id: '1', action: 'tenant.provisioned', actor: 'System', target: 'gallatin-cdjr', time: '2 min ago', type: 'success' as const },
  { id: '2', action: 'user.created', actor: 'trey@rally.vin', target: 'john.doe@gallatin.com', time: '15 min ago', type: 'info' as const },
  { id: '3', action: 'user.role_changed', actor: 'admin@rally.vin', target: 'jane.smith@dealer.com', time: '1 hr ago', type: 'warning' as const },
  { id: '4', action: 'tenant.suspended', actor: 'admin@rally.vin', target: 'test-dealer-old', time: '3 hr ago', type: 'error' as const },
  { id: '5', action: 'vehicle.bulk_import', actor: 'sync-service', target: 'nashville-motors', time: '4 hr ago', type: 'info' as const },
  { id: '6', action: 'dns.record_created', actor: 'System', target: 'springfield-auto.rally.vin', time: '6 hr ago', type: 'success' as const },
  { id: '7', action: 'user.login', actor: 'trey@rally.vin', target: 'admin.rally.vin', time: '8 hr ago', type: 'info' as const },
  { id: '8', action: 'ssl.cert_renewed', actor: 'System', target: 'liberty-ford.rally.vin', time: '12 hr ago', type: 'success' as const },
  { id: '9', action: 'feature_flag.toggled', actor: 'admin@rally.vin', target: 'nfc_enabled', time: '1 day ago', type: 'warning' as const },
  { id: '10', action: 'tenant.provisioned', actor: 'System', target: 'cookeville-chevy', time: '2 days ago', type: 'success' as const },
] as const;

// TODO: Replace with real server health API (GET /api/admin/system/health)
const MOCK_SERVER_HEALTH = [
  { label: 'CPU', value: '23%', icon: Cpu, status: 'healthy' as const },
  { label: 'RAM', value: '14.2 / 24 GB', icon: MemoryStick, status: 'healthy' as const },
  { label: 'Disk', value: '186 / 720 GB', icon: HardDrive, status: 'healthy' as const },
  { label: 'PM2 Processes', value: '9 / 9 online', icon: Server, status: 'healthy' as const },
] as const;

// ---------------------------------------------------------------------------
// Activity type → badge variant mapping
// ---------------------------------------------------------------------------

const ACTIVITY_BADGE_MAP = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
} as const;

// ---------------------------------------------------------------------------
// Server health status → color mapping
// ---------------------------------------------------------------------------

function getHealthColor(status: 'healthy' | 'warning' | 'critical'): string {
  switch (status) {
    case 'healthy':
      return 'text-status-success';
    case 'warning':
      return 'text-status-warning';
    case 'critical':
      return 'text-status-error';
  }
}

function getHealthDotColor(status: 'healthy' | 'warning' | 'critical'): string {
  switch (status) {
    case 'healthy':
      return 'bg-status-success';
    case 'warning':
      return 'bg-status-warning';
    case 'critical':
      return 'bg-status-error';
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const router = useRouter();
  // TODO: Replace with real loading state from API queries
  const [loading] = useState(false);

  return (
    <div className="p-6 space-y-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            System Overview
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Platform-wide metrics and system health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/logs')}
          >
            <ScrollText className="h-4 w-4" />
            View Logs
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push('/tenants/create')}
          >
            <Plus className="h-4 w-4" />
            Provision Tenant
          </Button>
        </div>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton variant="text" className="h-3 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton variant="text" className="h-8 w-20" />
                  <Skeleton variant="text" className="h-3 w-32 mt-2" />
                </CardContent>
              </Card>
            ))
          : MOCK_KPI.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                        {stat.label}
                      </p>
                      <Icon className="h-4 w-4 text-text-tertiary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="success" size="sm">
                        {stat.change}
                      </Badge>
                      <span className="text-xs text-text-tertiary">
                        {stat.changeLabel}
                      </span>
                    </div>
                    <StatChart
                      data={[...stat.sparkline]}
                      height={40}
                      className="mt-3"
                    />
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* ── Recent Activity + Server Health ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity — 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-rally-gold" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Recent Activity
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/activity')}
              >
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-8 w-8" />
                    <div className="flex-1 space-y-1">
                      <Skeleton variant="text" className="h-3 w-48" />
                      <Skeleton variant="text" className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {MOCK_ACTIVITY.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition-colors"
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {entry.type === 'success' && (
                        <ShieldCheck className="h-4 w-4 text-status-success" />
                      )}
                      {entry.type === 'info' && (
                        <UserPlus className="h-4 w-4 text-status-info" />
                      )}
                      {entry.type === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-status-warning" />
                      )}
                      {entry.type === 'error' && (
                        <AlertTriangle className="h-4 w-4 text-status-error" />
                      )}
                    </div>

                    {/* Action details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ACTIVITY_BADGE_MAP[entry.type]}
                          size="sm"
                        >
                          {entry.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">
                        <span className="text-text-secondary">{entry.actor}</span>
                        {' \u2192 '}
                        <span className="font-[family-name:var(--font-geist-mono)] text-text-secondary">
                          {entry.target}
                        </span>
                      </p>
                    </div>

                    {/* Time */}
                    <span className="text-xs text-text-tertiary shrink-0">
                      {entry.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Server Health — 1/3 width */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-rally-gold" />
              <h2 className="text-sm font-semibold text-text-primary">
                Server Health
              </h2>
            </div>
            <p className="text-xs text-text-tertiary">
              VPS 74.208.123.209
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-8 w-8" />
                    <div className="flex-1 space-y-1">
                      <Skeleton variant="text" className="h-3 w-16" />
                      <Skeleton variant="text" className="h-4 w-24" />
                    </div>
                  </div>
                ))
              : MOCK_SERVER_HEALTH.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-3 rounded-rally bg-surface-overlay border border-surface-border"
                    >
                      <div className="shrink-0 p-2 rounded-rally bg-surface-base">
                        <Icon className="h-4 w-4 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-tertiary uppercase tracking-wider">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-text-primary font-[family-name:var(--font-geist-mono)]">
                          {item.value}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`h-2 w-2 rounded-full ${getHealthDotColor(item.status)}`}
                        />
                        <span className={`text-xs font-medium ${getHealthColor(item.status)}`}>
                          {item.status === 'healthy' ? 'OK' : item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Quick Actions
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={() => router.push('/tenants/create')}
            >
              <Building2 className="h-4 w-4" />
              Provision Tenant
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push('/tenants')}
            >
              <Building2 className="h-4 w-4" />
              Manage Tenants
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push('/users')}
            >
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/logs')}
            >
              <ScrollText className="h-4 w-4" />
              View Logs
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/system')}
            >
              <Server className="h-4 w-4" />
              System Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
