'use client';

import { useState, useMemo, useCallback } from 'react';
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
// Mock Data
// ---------------------------------------------------------------------------

const SERVER_METRICS = {
  cpu: { used: 23, label: 'CPU Usage' },
  ram: { usedGB: 8.2, totalGB: 24, label: 'RAM Usage' },
  disk: { usedGB: 142, totalGB: 720, label: 'Disk Usage' },
  network: { avgMbps: 12, label: 'Network' },
} as const;

const PM2_PROCESSES: PM2Process[] = [
  { id: 'pm2-001', name: 'rally-staff', status: 'online', mode: 'cluster', instances: 4, cpuPercent: 12, memoryMB: 880, uptime: '3d 14h', restarts: 0 },
  { id: 'pm2-002', name: 'rally-manage', status: 'online', mode: 'cluster', instances: 2, cpuPercent: 5, memoryMB: 440, uptime: '3d 14h', restarts: 0 },
  { id: 'pm2-003', name: 'rally-admin', status: 'online', mode: 'fork', instances: 1, cpuPercent: 2, memoryMB: 210, uptime: '3d 14h', restarts: 0 },
  { id: 'pm2-004', name: 'rally-portal', status: 'online', mode: 'cluster', instances: 2, cpuPercent: 8, memoryMB: 360, uptime: '3d 14h', restarts: 0 },
] as const;

const CRON_JOBS: CronJob[] = [
  { id: 'cron-001', name: 'Cleanup deprovisioned tenants', schedule: 'Daily at 3:00 AM', lastRun: '2026-02-24T03:00:00Z', nextRun: '2026-02-25T03:00:00Z', status: 'active' },
  { id: 'cron-002', name: 'Analytics rollup', schedule: 'Hourly', lastRun: '2026-02-24T09:00:00Z', nextRun: '2026-02-24T10:00:00Z', status: 'active' },
  { id: 'cron-003', name: 'SSL cert renewal check', schedule: 'Daily at 2:00 AM', lastRun: '2026-02-24T02:00:00Z', nextRun: '2026-02-25T02:00:00Z', status: 'active' },
  { id: 'cron-004', name: 'PM2 log rotation', schedule: 'Daily at midnight', lastRun: '2026-02-24T00:00:00Z', nextRun: '2026-02-25T00:00:00Z', status: 'active' },
] as const;

const LAST_BROADCAST = {
  message: 'Scheduled maintenance window: Feb 22 2:00-4:00 AM CST. Expect brief downtime.',
  timestamp: '2026-02-21T18:00:00Z',
} as const;

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
  const [loading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  const handleMaintenanceToggle = useCallback(() => {
    if (!maintenanceMode) {
      // Turning on — confirm
      setMaintenanceMode(true);
      toast({
        type: 'warning',
        title: 'Maintenance Mode Enabled',
        description: 'All user-facing apps will show maintenance page.',
      });
    } else {
      setMaintenanceMode(false);
      toast({
        type: 'success',
        title: 'Maintenance Mode Disabled',
        description: 'All apps are back online.',
      });
    }
  }, [maintenanceMode, toast]);

  const handleRestart = useCallback(
    (processName: string) => {
      if (confirmingAction === processName) {
        setConfirmingAction(null);
        toast({
          type: 'success',
          title: `Restarting ${processName}`,
          description: 'Process reload initiated.',
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
        toast({
          type: 'warning',
          title: `Stopping ${processName}`,
          description: 'Process will be stopped.',
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
    toast({
      type: 'success',
      title: 'Broadcast Sent',
      description: `Message sent to all connected clients.`,
    });
    setBroadcastMessage('');
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
    () => PM2_PROCESSES.reduce((acc, p) => acc + p.cpuPercent, 0),
    [],
  );
  const totalMemory = useMemo(
    () => PM2_PROCESSES.reduce((acc, p) => acc + p.memoryMB, 0),
    [],
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-rally-gold" />
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {SERVER_METRICS.cpu.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {SERVER_METRICS.cpu.used}%
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-rally-gold transition-all"
                style={{ width: `${SERVER_METRICS.cpu.used}%` }}
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
                {SERVER_METRICS.ram.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {SERVER_METRICS.ram.usedGB}
              <span className="text-sm text-text-secondary ml-1">/ {SERVER_METRICS.ram.totalGB}GB</span>
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-status-info transition-all"
                style={{ width: `${Math.round((SERVER_METRICS.ram.usedGB / SERVER_METRICS.ram.totalGB) * 100)}%` }}
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
                {SERVER_METRICS.disk.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {SERVER_METRICS.disk.usedGB}
              <span className="text-sm text-text-secondary ml-1">/ {SERVER_METRICS.disk.totalGB}GB</span>
            </p>
            <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
              <div
                className="h-2 rounded-full bg-status-warning transition-all"
                style={{ width: `${Math.round((SERVER_METRICS.disk.usedGB / SERVER_METRICS.disk.totalGB) * 100)}%` }}
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
                {SERVER_METRICS.network.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)] mb-2">
              {SERVER_METRICS.network.avgMbps}
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
          data={PM2_PROCESSES as unknown as PM2Process[]}
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
            <div className="border-t border-surface-border pt-3">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1.5">
                Last Broadcast
              </p>
              <p className="text-sm text-text-secondary">
                {LAST_BROADCAST.message}
              </p>
              <p className="text-[10px] text-text-tertiary mt-1 font-[family-name:var(--font-geist-mono)]">
                {formatTimestamp(LAST_BROADCAST.timestamp)}
              </p>
            </div>
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
              {CRON_JOBS.map((job) => (
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
