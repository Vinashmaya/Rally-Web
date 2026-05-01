'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch, useDocument } from '@rally/firebase';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  EmptyState,
  Skeleton,
  useToast,
} from '@rally/ui';
import {
  Plug,
  RefreshCw,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Settings,
  HelpCircle,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — must match server payload at /api/admin/integrations/health
// ---------------------------------------------------------------------------

type IntegrationStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'unconfigured';
type IntegrationType = 'crm' | 'dms' | 'tracking' | 'communication' | 'infrastructure';

interface IntegrationHealth {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  color: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  lastChecked: string;
  error?: string;
}

interface IntegrationsHealthDoc {
  integrations: IntegrationHealth[];
  lastChecked: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  IntegrationStatus,
  {
    label: string;
    badgeVariant: 'success' | 'warning' | 'error' | 'default';
    dotClass: string;
    pulse: boolean;
    icon: typeof CheckCircle2;
  }
> = {
  healthy: {
    label: 'Healthy',
    badgeVariant: 'success',
    dotClass: 'bg-status-success',
    pulse: false,
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    badgeVariant: 'warning',
    dotClass: 'bg-status-warning',
    pulse: true,
    icon: AlertTriangle,
  },
  down: {
    label: 'Down',
    badgeVariant: 'error',
    dotClass: 'bg-status-error',
    pulse: true,
    icon: XCircle,
  },
  unknown: {
    label: 'Unknown',
    badgeVariant: 'default',
    dotClass: 'bg-text-tertiary',
    pulse: false,
    icon: HelpCircle,
  },
  unconfigured: {
    label: 'Not Configured',
    badgeVariant: 'default',
    dotClass: 'bg-text-tertiary',
    pulse: false,
    icon: Settings,
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  return `${ms}ms`;
}

function getLatencyColor(ms: number | null): string {
  if (ms === null) return 'text-text-tertiary';
  if (ms < 200) return 'text-status-success';
  if (ms < 800) return 'text-status-warning';
  return 'text-status-error';
}

function getTypeLabel(type: IntegrationType): string {
  const labels: Record<IntegrationType, string> = {
    crm: 'CRM',
    dms: 'DMS',
    tracking: 'Tracking',
    communication: 'Communication',
    infrastructure: 'Infrastructure',
  };
  return labels[type] ?? type;
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: IntegrationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className="relative flex h-3 w-3">
      {config.pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotClass}`}
        />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${config.dotClass}`} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Integration card
// TODO: Per-integration row click → details panel showing recent error
// rates / per-probe history (need a new `system/integrationsHealthHistory`
// doc with rolling samples). Out of scope for this sprint.
// ---------------------------------------------------------------------------

function IntegrationCard({
  integration,
  onRefresh,
  refreshing,
}: {
  integration: IntegrationHealth;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const statusConfig = STATUS_CONFIG[integration.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ backgroundColor: `${integration.color}20`, color: integration.color }}
            >
              {integration.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary">{integration.name}</h3>
                <Badge variant="default" size="sm">
                  {getTypeLabel(integration.type)}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                {integration.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusDot status={integration.status} />
            <Badge variant={statusConfig.badgeVariant} size="sm">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Response Time
            </p>
            <p
              className={`text-lg font-bold font-[family-name:var(--font-geist-mono)] ${getLatencyColor(integration.latencyMs)}`}
            >
              {formatLatency(integration.latencyMs)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Last Check
            </p>
            <p className="text-sm font-medium text-text-secondary font-[family-name:var(--font-geist-mono)]">
              {formatTimestamp(integration.lastChecked)}
            </p>
          </div>
        </div>

        {integration.error && (
          <div className="mt-3 rounded-rally bg-status-error/10 border border-status-error/30 px-3 py-2">
            <p className="text-xs text-status-error font-[family-name:var(--font-geist-mono)] break-words">
              {integration.error}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <Button variant="secondary" size="sm" loading={refreshing} onClick={onRefresh}>
          <Zap className="h-3.5 w-3.5" />
          Re-probe
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Real-time listener on the cached health doc.
  const { data: doc, loading: docLoading } = useDocument<IntegrationsHealthDoc & { id: string }>(
    'system/integrationsHealth',
  );

  const integrations = doc?.integrations ?? [];
  const lastGlobalCheck = doc?.lastChecked ?? null;

  // On first mount, hit the GET endpoint so the route either serves a cached
  // payload or runs a fresh probe and writes the Firestore doc — which our
  // useDocument listener picks up.
  useEffect(() => {
    if (hasFetched) return;
    setHasFetched(true);
    authFetch('/api/admin/integrations/health')
      .then((res) => res.json())
      .catch(() => {
        toast({
          type: 'error',
          title: 'Failed to load integration health',
          description: 'Could not reach the integrations API.',
        });
      });
  }, [hasFetched, toast]);

  const handleRefreshAll = useCallback(() => {
    setRefreshing(true);
    authFetch('/api/admin/integrations/health', { method: 'POST' })
      .then((res) => res.json())
      .then((payload: { success?: boolean; error?: string }) => {
        if (payload.success) {
          toast({
            type: 'success',
            title: 'Health probes complete',
            description: 'All integrations re-checked.',
          });
        } else {
          toast({
            type: 'error',
            title: 'Refresh failed',
            description: payload.error ?? 'Unknown error',
          });
        }
      })
      .catch(() => {
        toast({ type: 'error', title: 'Refresh failed', description: 'Network error' });
      })
      .finally(() => setRefreshing(false));
  }, [toast]);

  // Per-integration "Re-probe" button uses the same POST — there's no
  // single-integration probe endpoint, since probing is cheap in parallel.
  const handleRefreshOne = useCallback(
    (_id: string) => {
      handleRefreshAll();
    },
    [handleRefreshAll],
  );

  // Summary
  const summary = useMemo(() => {
    return {
      healthy: integrations.filter((i) => i.status === 'healthy').length,
      degraded: integrations.filter((i) => i.status === 'degraded').length,
      down: integrations.filter((i) => i.status === 'down').length,
      unknown: integrations.filter((i) => i.status === 'unknown').length,
      unconfigured: integrations.filter((i) => i.status === 'unconfigured').length,
    };
  }, [integrations]);

  const initialLoading = docLoading && integrations.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Integration Health</h1>
          <p className="text-sm text-text-secondary mt-1">
            External service connectivity and performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Last checked:{' '}
              <span className="text-text-secondary font-[family-name:var(--font-geist-mono)]">
                {formatTimestamp(lastGlobalCheck)}
              </span>
            </span>
          </div>
          <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefreshAll}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Badges */}
      {!initialLoading && (
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="success" size="md">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {summary.healthy} Healthy
          </Badge>
          {summary.degraded > 0 && (
            <Badge variant="warning" size="md">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {summary.degraded} Degraded
            </Badge>
          )}
          {summary.down > 0 && (
            <Badge variant="error" size="md">
              <XCircle className="h-3 w-3 mr-1" />
              {summary.down} Down
            </Badge>
          )}
          {summary.unknown > 0 && (
            <Badge variant="default" size="md">
              <HelpCircle className="h-3 w-3 mr-1" />
              {summary.unknown} Unknown
            </Badge>
          )}
          {summary.unconfigured > 0 && (
            <Badge variant="default" size="md">
              <Settings className="h-3 w-3 mr-1" />
              {summary.unconfigured} Not Configured
            </Badge>
          )}
        </div>
      )}

      {/* Body */}
      {initialLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-44" />
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No integration data yet"
          description="Run a refresh to probe all integrations."
          action={
            <Button variant="primary" size="md" loading={refreshing} onClick={handleRefreshAll}>
              <RefreshCw className="h-4 w-4" />
              Run Health Probes
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onRefresh={() => handleRefreshOne(integration.id)}
              refreshing={refreshing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
