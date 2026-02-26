'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { authFetch } from '@rally/firebase';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Skeleton,
  DataTable,
  useToast,
} from '@rally/ui';
import type { BadgeProps } from '@rally/ui';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  AlertTriangle,
  RefreshCw,
  StopCircle,
  Send,
  Clock,
  Calendar,
  Shield,
  RotateCw,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PM2Process {
  id: string;
  name: string;
  status: 'online' | 'stopped' | 'errored';
  mode: 'cluster' | 'fork';
  instances: number;
  cpuPercent: number;
  memoryMB: number;
  uptime: string;
  restarts: number;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  status: 'active' | 'paused' | 'error';
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface ServerMetrics {
  cpu: { used: number; label: string };
  ram: { usedGB: number; totalGB: number; label: string };
  disk: { usedGB: number; totalGB: number; label: string };
  network: { avgMbps: number; label: string };
}

interface BroadcastInfo {
  message: string;
  timestamp: string;
}

interface HealthResponse {
  success: boolean;
  data: {
    cpu: ServerMetrics['cpu'];
    ram: ServerMetrics['ram'];
    disk: ServerMetrics['disk'];
    network: ServerMetrics['network'];
    pm2: PM2Process[];
    cronJobs: CronJob[];
    lastBroadcast: BroadcastInfo;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const STATUS_BADGE_MAP: Record<PM2Process['status'], BadgeProps['variant']> = {
  online: 'success',
  stopped: 'error',
  errored: 'error',
} as const;

const CRON_STATUS_BADGE_MAP: Record<CronJob['status'], BadgeProps['variant']> = {
  active: 'success',
  paused: 'warning',
  error: 'error',
} as const;

// ---------------------------------------------------------------------------
// Progress Bar Component
// ---------------------------------------------------------------------------

function MetricBar({
  value,
  max,
  label,
  displayValue,
  color = 'bg-rally-gold',
}: {
  value: number;
  max: number;
  label: string;
  displayValue: string;
  color?: string;
}) {
  const percent = Math.round((value / max) * 100);
  const dangerThreshold = 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary">
          {displayValue}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-surface-overlay overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${percent >= dangerThreshold ? 'bg-status-error' : color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[10px] text-text-tertiary text-right font-[family-name:var(--font-geist-mono)]">
        {percent}%
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SystemHealthPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [pm2Processes, setPm2Processes] = useState<PM2Process[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [lastBroadcast, setLastBroadcast] = useState<BroadcastInfo | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  // ── Fetch system health from API ────────────────────────────────

  useEffect(() => {
    setLoading(true);
    authFetch('/api/admin/system/health')
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        if (data.data) {
          setMetrics({
            cpu: data.data.cpu,
            ram: data.data.ram,
            disk: data.data.disk,
            network: data.data.network,
          });
          setPm2Processes(data.data.pm2);
          setCronJobs(data.data.cronJobs);
          setLastBroadcast(data.data.lastBroadcast);
        }
      })
      .catch(() => {
        toast({ type: 'error', title: 'Failed to load system health', description: 'Could not reach the system health API.' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const handleMaintenanceToggle = useCallback(() => {
    const newState = !maintenanceMode;
    authFetch('/api/admin/system/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'maintenance', enabled: newState }),
    })
      .then((res) => res.json())
      .then((data: { success?: boolean; error?: string }) => {
        if (data.success) {
          setMaintenanceMode(newState);
          toast({
            type: newState ? 'warning' : 'success',
            title: newState ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
            description: newState
              ? 'All user-facing apps will show maintenance page.'
              : 'All apps are back online.',
          });
        } else {
          toast({ type: 'error', title: 'Action failed', description: data.error ?? 'Unknown error' });
        }
      })
      .catch(() => {
        toast({ type: 'error', title: 'Action failed', description: 'Network error' });
      });
  }, [maintenanceMode, toast]);

  const handleRestart = useCallback(
    (processName: string) => {
      if (confirmingAction === processName) {
        setConfirmingAction(null);
        authFetch('/api/admin/system/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restart', process: processName }),
        })
          .then((res) => res.json())
          .then((data: { success?: boolean; error?: string }) => {
            if (data.success) {
              toast({
                type: 'success',
                title: `Restarting ${processName}`,
                description: 'Process reload initiated.',
              });
            } else {
              toast({ type: 'error', title: 'Restart failed', description: data.error ?? 'Unknown error' });
            }
          })
          .catch(() => {
            toast({ type: 'error', title: 'Restart failed', description: 'Network error' });
          });
      } else {
        setConfirmingAction(processName);
        // Auto-clear confirmation after 3s
        setTimeout(() => setConfirmingAction(null), 3000);
      }
    },
    [confirmingAction, toast],
  );

  const handleStop = useCallback(
    (processName: string) => {
      const stopKey = `stop-${processName}`;
      if (confirmingAction === stopKey) {
        setConfirmingAction(null);
        authFetch('/api/admin/system/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop', process: processName }),
        })
          .then((res) => res.json())
          .then((data: { success?: boolean; error?: string }) => {
            if (data.success) {
              toast({
                type: 'warning',
                title: `Stopping ${processName}`,
                description: 'Process will be stopped.',
              });
            } else {
              toast({ type: 'error', title: 'Stop failed', description: data.error ?? 'Unknown error' });
            }
          })
          .catch(() => {
            toast({ type: 'error', title: 'Stop failed', description: 'Network error' });
          });
      } else {
        setConfirmingAction(stopKey);
        setTimeout(() => setConfirmingAction(null), 3000);
      }
    },
    [confirmingAction, toast],
  );

  const handleBroadcast = useCallback(() => {
    if (!broadcastMessage.trim()) {
      toast({ type: 'error', title: 'Error', description: 'Message cannot be empty.' });
      return;
    }
    authFetch('/api/admin/system/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'broadcast', message: broadcastMessage.trim() }),
    })
      .then((res) => res.json())
      .then((data: { success?: boolean; error?: string }) => {
        if (data.success) {
          toast({
            type: 'success',
            title: 'Broadcast Sent',
            description: 'Message sent to all connected clients.',
          });
          setLastBroadcast({
            message: broadcastMessage.trim(),
            timestamp: new Date().toISOString(),
          });
          setBroadcastMessage('');
        } else {
          toast({ type: 'error', title: 'Broadcast failed', description: data.error ?? 'Unknown error' });
        }
      })
      .catch(() => {
        toast({ type: 'error', title: 'Broadcast failed', description: 'Network error' });
      });
  }, [broadcastMessage, toast]);

  // PM2 table columns
  const pm2Columns = useMemo<ColumnDef<PM2Process, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary text-sm">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_MAP[row.original.status]} size="sm">
            {row.original.status === 'online' && <CheckCircle2 className="h-2.5 w-2.5" />}
            {row.original.status === 'stopped' && <XCircle className="h-2.5 w-2.5" />}
            {row.original.status === 'errored' && <AlertTriangle className="h-2.5 w-2.5" />}
            {row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
          </Badge>
        ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <span className="text-text-secondary text-sm capitalize">
            {row.original.mode}
          </span>
        ),
      },
      {
        accessorKey: 'instances',
        header: 'Instances',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
            {row.original.instances}
          </span>
        ),
      },
      {
        accessorKey: 'cpuPercent',
        header: 'CPU%',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
            {row.original.cpuPercent}%
          </span>
        ),
      },
      {
        accessorKey: 'memoryMB',
        header: 'Memory',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
            {row.original.memoryMB}
            <span className="text-text-tertiary ml-0.5">MB</span>
          </span>
        ),
      },
      {
        accessorKey: 'uptime',
        header: 'Uptime',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-secondary text-sm">
            {row.original.uptime}
          </span>
        ),
      },
      {
        accessorKey: 'restarts',
        header: 'Restarts',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
            {row.original.restarts}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant={confirmingAction === row.original.name ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleRestart(row.original.name)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {confirmingAction === row.original.name ? 'Confirm' : 'Restart'}
            </Button>
            <Button
              variant={confirmingAction === `stop-${row.original.name}` ? 'danger' : 'ghost'}
              size="sm"
              onClick={() => handleStop(row.original.name)}
            >
              <StopCircle className="h-3.5 w-3.5" />
              {confirmingAction === `stop-${row.original.name}` ? 'Confirm' : 'Stop'}
            </Button>
          </div>
        ),
      },
    ],
    [confirmingAction, handleRestart, handleStop],
  );

  // Total resources
  const totalCPU = useMemo(
    () => pm2Processes.reduce((acc, p) => acc + p.cpuPercent, 0),
    [pm2Processes],
  );
  const totalMemory = useMemo(
    () => pm2Processes.reduce((acc, p) => acc + p.memoryMB, 0),
    [pm2Processes],
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-32" />
          ))}
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            System Health
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Server metrics, process management, and maintenance controls
          </p>
        </div>
        <Button
          variant={maintenanceMode ? 'danger' : 'ghost'}
          size="sm"
          onClick={handleMaintenanceToggle}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
        </Button>
      </div>

      {/* Maintenance mode warning */}
      {maintenanceMode && (
        <div className="flex items-center gap-3 rounded-rally-lg border border-status-error/30 bg-status-error/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-status-error shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-error">
              Maintenance Mode Active
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              All user-facing applications are showing the maintenance page.
            </p>
          </div>
        </div>
      )}

      {/* ── Server Metrics ─────────────────────────────────────── */}
      {metrics ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-rally-gold" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {metrics.cpu.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {metrics.cpu.used}%
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-rally-gold transition-all"
                style={{ width: `${metrics.cpu.used}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* RAM */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <MemoryStick className="h-4 w-4 text-status-info" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {metrics.ram.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {metrics.ram.usedGB}
              <span className="text-sm text-text-secondary ml-1">/ {metrics.ram.totalGB}GB</span>
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-status-info transition-all"
                style={{ width: `${Math.round((metrics.ram.usedGB / metrics.ram.totalGB) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Disk */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="h-4 w-4 text-status-warning" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {metrics.disk.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {metrics.disk.usedGB}
              <span className="text-sm text-text-secondary ml-1">/ {metrics.disk.totalGB}GB</span>
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-status-warning transition-all"
                style={{ width: `${Math.round((metrics.disk.usedGB / metrics.disk.totalGB) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-4 w-4 text-status-success" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {metrics.network.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {metrics.network.avgMbps}
              <span className="text-sm text-text-secondary ml-1">Mbps avg</span>
            </p>
            {/* Sparkline placeholder */}
            <div className="flex items-end gap-px h-6">
              {[40, 65, 55, 70, 50, 80, 60, 45, 75, 55, 65, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-status-success/40"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      ) : !loading ? (
        <div className="text-sm text-text-secondary">No metrics available</div>
      ) : null}

      {/* ── Resource Summary ───────────────────────────────────── */}
      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span>
          Total PM2 CPU:{' '}
          <span className="font-[family-name:var(--font-geist-mono)] text-text-secondary">
            {totalCPU}%
          </span>
        </span>
        <span className="text-surface-border">|</span>
        <span>
          Total PM2 Memory:{' '}
          <span className="font-[family-name:var(--font-geist-mono)] text-text-secondary">
            {(totalMemory / 1024).toFixed(1)}GB
          </span>
        </span>
      </div>

      {/* ── PM2 Process Table ──────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          PM2 Processes
        </h2>
        <DataTable<PM2Process>
          columns={pm2Columns}
          data={pm2Processes}
          emptyMessage="No processes"
          emptyDescription="No PM2 processes found."
          emptyIcon={Server}
          defaultPageSize={10}
        />
      </div>

      {/* ── Broadcast + Cron ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Broadcast Message */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                System Broadcast
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter a system-wide broadcast message..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleBroadcast}
              className="w-full"
            >
              <Send className="h-3.5 w-3.5" />
              Send Broadcast
            </Button>

            {/* Last broadcast */}
            {lastBroadcast && (
            <div className="border-t border-surface-border pt-3">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">
                Last Broadcast
              </p>
              <p className="text-sm text-text-secondary">
                {lastBroadcast.message}
              </p>
              <p className="text-[10px] text-text-tertiary mt-1 font-[family-name:var(--font-geist-mono)]">
                {formatTimestamp(lastBroadcast.timestamp)}
              </p>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Cron Jobs */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Scheduled Tasks
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cronJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start gap-3 p-3 rounded-rally bg-surface-overlay border border-surface-border"
                >
                  <div className="shrink-0 mt-0.5">
                    <Badge variant={CRON_STATUS_BADGE_MAP[job.status]} size="sm">
                      {job.status === 'active' && <CheckCircle2 className="h-2.5 w-2.5" />}
                      {job.status === 'paused' && <StopCircle className="h-2.5 w-2.5" />}
                      {job.status === 'error' && <XCircle className="h-2.5 w-2.5" />}
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {job.name}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {job.schedule}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                      <span className="text-[10px] text-text-tertiary">
                        Last: <span className="font-[family-name:var(--font-geist-mono)]">{formatTimestamp(job.lastRun)}</span>
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        Next: <span className="font-[family-name:var(--font-geist-mono)]">{formatTimestamp(job.nextRun)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
