'use client';

import { useState, useEffect } from 'react';
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
import {
  useTenants,
  useAllUsers,
  useAllVehicles,
  useAuditLog,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Activity type → badge variant mapping
// ---------------------------------------------------------------------------

function getActivityType(action: string): 'success' | 'error' | 'warning' | 'info' {
  if (action.includes('provisioned') || action.includes('created') || action.includes('renewed')) return 'success';
  if (action.includes('suspended') || action.includes('deprovision') || action.includes('error')) return 'error';
  if (action.includes('changed') || action.includes('toggled') || action.includes('disabled')) return 'warning';
  return 'info';
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function timeAgo(date: Date | undefined): string {
  if (!date) return '--';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

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
// Server health type
// ---------------------------------------------------------------------------

interface ServerHealthItem {
  label: string;
  value: string;
  icon: typeof Cpu;
  status: 'healthy' | 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const router = useRouter();

  // Real Firestore data via hooks
  const { tenants, loading: tenantsLoading } = useTenants({});
  const { allUsers, loading: usersLoading } = useAllUsers({});
  const { allVehicles, loading: vehiclesLoading } = useAllVehicles({});
  const { auditLogs, loading: activityLoading } = useAuditLog({ limitCount: 10 });

  // Server health — fetched from API route
  const [serverHealth, setServerHealth] = useState<ServerHealthItem[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/system/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.health) {
          setServerHealth(data.health);
        } else {
          // Fallback: build health items from raw data
          const h: ServerHealthItem[] = [];
          if (data.cpu !== undefined) {
            const cpuPercent = Math.round(data.cpu);
            h.push({
              label: 'CPU',
              value: `${cpuPercent}%`,
              icon: Cpu,
              status: cpuPercent > 80 ? 'critical' : cpuPercent > 60 ? 'warning' : 'healthy',
            });
          }
          if (data.memUsed !== undefined && data.memTotal !== undefined) {
            const memGB = (data.memUsed / 1024 / 1024 / 1024).toFixed(1);
            const totalGB = (data.memTotal / 1024 / 1024 / 1024).toFixed(0);
            const pct = data.memUsed / data.memTotal;
            h.push({
              label: 'RAM',
              value: `${memGB} / ${totalGB} GB`,
              icon: MemoryStick,
              status: pct > 0.9 ? 'critical' : pct > 0.7 ? 'warning' : 'healthy',
            });
          }
          if (data.uptime !== undefined) {
            const days = Math.floor(data.uptime / 86400);
            h.push({
              label: 'Uptime',
              value: `${days}d`,
              icon: Clock,
              status: 'healthy',
            });
          }
          if (data.pm2 !== undefined) {
            const online = data.pm2.filter((p: { status: string }) => p.status === 'online').length;
            const total = data.pm2.length;
            h.push({
              label: 'PM2 Processes',
              value: `${online} / ${total} online`,
              icon: Server,
              status: online < total ? 'warning' : 'healthy',
            });
          }
          if (h.length === 0) {
            // Default fallback
            h.push(
              { label: 'CPU', value: '--', icon: Cpu, status: 'healthy' },
              { label: 'RAM', value: '--', icon: MemoryStick, status: 'healthy' },
              { label: 'Disk', value: '--', icon: HardDrive, status: 'healthy' },
              { label: 'PM2', value: '--', icon: Server, status: 'healthy' },
            );
          }
          setServerHealth(h);
        }
      })
      .catch(() => {
        setServerHealth([
          { label: 'CPU', value: '--', icon: Cpu, status: 'healthy' },
          { label: 'RAM', value: '--', icon: MemoryStick, status: 'healthy' },
          { label: 'Disk', value: '--', icon: HardDrive, status: 'healthy' },
          { label: 'PM2', value: '--', icon: Server, status: 'healthy' },
        ]);
      })
      .finally(() => setHealthLoading(false));
  }, []);

  // Compute KPIs from real data
  const kpiLoading = tenantsLoading || usersLoading || vehiclesLoading;

  const kpiStats = [
    {
      label: 'Total Tenants',
      value: tenants.length.toLocaleString(),
      icon: Building2,
    },
    {
      label: 'Total Users',
      value: allUsers.length.toLocaleString(),
      icon: Users,
    },
    {
      label: 'Active Vehicles',
      value: allVehicles.length.toLocaleString(),
      icon: Car,
    },
  ];

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiLoading
          ? Array.from({ length: 3 }).map((_, i) => (
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
          : kpiStats.map((stat) => {
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
            {activityLoading ? (
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
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-text-tertiary">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {auditLogs.map((entry) => {
                  const actType = getActivityType(entry.action ?? '');
                  return (
                    <div
                      key={entry.id ?? entry.action}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition-colors"
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        {actType === 'success' && (
                          <ShieldCheck className="h-4 w-4 text-status-success" />
                        )}
                        {actType === 'info' && (
                          <UserPlus className="h-4 w-4 text-status-info" />
                        )}
                        {actType === 'warning' && (
                          <AlertTriangle className="h-4 w-4 text-status-warning" />
                        )}
                        {actType === 'error' && (
                          <AlertTriangle className="h-4 w-4 text-status-error" />
                        )}
                      </div>

                      {/* Action details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={actType === 'error' ? 'error' : actType === 'warning' ? 'warning' : actType === 'success' ? 'success' : 'info'}
                            size="sm"
                          >
                            {entry.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-text-tertiary mt-0.5 truncate">
                          <span className="text-text-secondary">{entry.actorId ?? 'System'}</span>
                          {entry.targetId ? (
                            <>
                              {' \u2192 '}
                              <span className="font-[family-name:var(--font-geist-mono)] text-text-secondary">
                                {entry.targetId}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="text-xs text-text-tertiary shrink-0">
                        {timeAgo(entry.timestamp)}
                      </span>
                    </div>
                  );
                })}
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
              VPS {process.env.NEXT_PUBLIC_VPS_IP ?? '66.179.189.87'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-8 w-8" />
                    <div className="flex-1 space-y-1">
                      <Skeleton variant="text" className="h-3 w-16" />
                      <Skeleton variant="text" className="h-4 w-24" />
                    </div>
                  </div>
                ))
              : serverHealth.map((item) => {
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
