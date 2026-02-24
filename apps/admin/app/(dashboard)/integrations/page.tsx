'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  EmptyState,
  useToast,
} from '@rally/ui';
import {
  Plug,
  Plus,
  RefreshCw,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Settings,
  Zap,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

type IntegrationStatus = 'healthy' | 'degraded' | 'down' | 'unconfigured';
type IntegrationType = 'crm' | 'dms' | 'tracking' | 'communication' | 'infrastructure';

interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  responseTimeMs: number;
  errorRate: number;
  lastChecked: string;
  description: string;
  color: string;
}

// ── Mock Data ──────────────────────────────────────────────────────

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'int-1',
    name: 'Vincue',
    type: 'dms',
    status: 'healthy',
    responseTimeMs: 180,
    errorRate: 0.1,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'Dealer Management System — inventory sync, deal management, and reporting.',
    color: '#3B82F6',
  },
  {
    id: 'int-2',
    name: 'DriveCentric',
    type: 'crm',
    status: 'healthy',
    responseTimeMs: 220,
    errorRate: 0.3,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'Customer Relationship Management — lead tracking, follow-ups, and customer history.',
    color: '#8B5CF6',
  },
  {
    id: 'int-3',
    name: 'eLead',
    type: 'crm',
    status: 'degraded',
    responseTimeMs: 890,
    errorRate: 5.2,
    lastChecked: '2026-02-24T09:54:00Z',
    description: 'CRM platform — lead management and internet lead routing. Experiencing elevated latency.',
    color: '#F59E0B',
  },
  {
    id: 'int-4',
    name: 'Kahu',
    type: 'tracking',
    status: 'healthy',
    responseTimeMs: 150,
    errorRate: 0,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'Vehicle tracking and lot management — GPS positions and theft recovery.',
    color: '#22C55E',
  },
  {
    id: 'int-5',
    name: 'Ghost',
    type: 'tracking',
    status: 'unconfigured',
    responseTimeMs: 0,
    errorRate: 0,
    lastChecked: '',
    description: 'Rally OBD2 hardware — telematics, battery health, and iBeacon lot tracking.',
    color: '#D4A017',
  },
  {
    id: 'int-6',
    name: 'Mapbox',
    type: 'infrastructure',
    status: 'healthy',
    responseTimeMs: 95,
    errorRate: 0,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'Maps and geocoding — dealership lot maps, vehicle positioning, and route planning.',
    color: '#0EA5E9',
  },
  {
    id: 'int-7',
    name: 'Cloudflare',
    type: 'infrastructure',
    status: 'healthy',
    responseTimeMs: 12,
    errorRate: 0,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'CDN and DNS — edge caching, DDoS protection, and subdomain management.',
    color: '#F97316',
  },
  {
    id: 'int-8',
    name: 'Firebase',
    type: 'infrastructure',
    status: 'healthy',
    responseTimeMs: 45,
    errorRate: 0,
    lastChecked: '2026-02-24T09:55:00Z',
    description: 'Backend platform — Auth, Firestore, and Storage. Shared with iOS app.',
    color: '#EAB308',
  },
] as const;

// ── Status Config ──────────────────────────────────────────────────

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
  unconfigured: {
    label: 'Not Configured',
    badgeVariant: 'default',
    dotClass: 'bg-text-tertiary',
    pulse: false,
    icon: Settings,
  },
} as const;

// ── Helpers ────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatResponseTime(ms: number): string {
  if (ms === 0) return '--';
  return `${ms}ms`;
}

function formatErrorRate(rate: number): string {
  if (rate === 0) return '0%';
  return `${rate}%`;
}

function getResponseTimeColor(ms: number): string {
  if (ms === 0) return 'text-text-tertiary';
  if (ms < 200) return 'text-status-success';
  if (ms < 500) return 'text-status-warning';
  return 'text-status-error';
}

function getErrorRateColor(rate: number): string {
  if (rate === 0) return 'text-status-success';
  if (rate < 2) return 'text-status-warning';
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

// ── Status Dot ─────────────────────────────────────────────────────

function StatusDot({ status }: { status: IntegrationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className="relative flex h-3 w-3">
      {config.pulse && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dotClass}`}
        />
      )}
      <span
        className={`relative inline-flex h-3 w-3 rounded-full ${config.dotClass}`}
      />
    </span>
  );
}

// ── Integration Card ───────────────────────────────────────────────

function IntegrationCard({
  integration,
  onTest,
  testing,
}: {
  integration: Integration;
  onTest: (id: string) => void;
  testing: boolean;
}) {
  const statusConfig = STATUS_CONFIG[integration.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo circle with initial */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ backgroundColor: `${integration.color}20`, color: integration.color }}
            >
              {integration.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary">
                  {integration.name}
                </h3>
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
        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Response Time */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Response Time
            </p>
            <p
              className={`text-lg font-bold font-[family-name:var(--font-geist-mono)] ${getResponseTimeColor(integration.responseTimeMs)}`}
            >
              {formatResponseTime(integration.responseTimeMs)}
            </p>
          </div>

          {/* Error Rate */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Error Rate
            </p>
            <p
              className={`text-lg font-bold font-[family-name:var(--font-geist-mono)] ${getErrorRateColor(integration.errorRate)}`}
            >
              {formatErrorRate(integration.errorRate)}
            </p>
          </div>

          {/* Last Checked */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
              Last Check
            </p>
            <p className="text-sm font-medium text-text-secondary font-[family-name:var(--font-geist-mono)]">
              {formatTimestamp(integration.lastChecked)}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <Button
          variant={integration.status === 'unconfigured' ? 'primary' : 'secondary'}
          size="sm"
          loading={testing}
          onClick={() => onTest(integration.id)}
        >
          {integration.status === 'unconfigured' ? (
            <>
              <Settings className="h-3.5 w-3.5" />
              Configure
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              Test Connection
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [integrations] = useState<Integration[]>(
    INITIAL_INTEGRATIONS.map((i) => ({ ...i }))
  );
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [lastGlobalCheck] = useState('2026-02-24T09:55:00Z');

  // ── Test connection handler ──────────────────────────────────────

  const handleTest = useCallback(
    (id: string) => {
      const integration = integrations.find((i) => i.id === id);
      if (!integration) return;

      if (integration.status === 'unconfigured') {
        toast({
          type: 'info',
          title: 'Configuration required',
          description: `${integration.name} needs API credentials before it can be tested. Configure in Settings.`,
        });
        return;
      }

      // Simulate test connection
      setTestingIds((prev) => new Set(prev).add(id));

      setTimeout(() => {
        setTestingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        if (integration.status === 'degraded') {
          toast({
            type: 'warning',
            title: `${integration.name} — Degraded`,
            description: `Connection succeeded but response time is elevated (${integration.responseTimeMs}ms). Error rate: ${integration.errorRate}%.`,
          });
        } else if (integration.status === 'down') {
          toast({
            type: 'error',
            title: `${integration.name} — Connection Failed`,
            description: 'Unable to reach the service. Check API credentials and network connectivity.',
          });
        } else {
          toast({
            type: 'success',
            title: `${integration.name} — Healthy`,
            description: `Connection successful. Response time: ${integration.responseTimeMs}ms.`,
          });
        }
      }, 1500);
    },
    [integrations, toast],
  );

  // ── Summary stats ────────────────────────────────────────────────

  const healthyCount = integrations.filter((i) => i.status === 'healthy').length;
  const degradedCount = integrations.filter((i) => i.status === 'degraded').length;
  const downCount = integrations.filter((i) => i.status === 'down').length;
  const unconfiguredCount = integrations.filter((i) => i.status === 'unconfigured').length;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Integration Health
          </h1>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast({
                type: 'info',
                title: 'Refreshing all connections...',
                description: 'Health check will run against all configured integrations.',
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Summary Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="success" size="md">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {healthyCount} Healthy
        </Badge>
        {degradedCount > 0 && (
          <Badge variant="warning" size="md">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {degradedCount} Degraded
          </Badge>
        )}
        {downCount > 0 && (
          <Badge variant="error" size="md">
            <XCircle className="h-3 w-3 mr-1" />
            {downCount} Down
          </Badge>
        )}
        {unconfiguredCount > 0 && (
          <Badge variant="default" size="md">
            <Settings className="h-3 w-3 mr-1" />
            {unconfiguredCount} Not Configured
          </Badge>
        )}
      </div>

      {/* Integration Cards Grid */}
      {integrations.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No integrations configured"
          description="Add external service integrations to monitor connectivity and performance."
          action={
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4" />
              Add Integration
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onTest={handleTest}
              testing={testingIds.has(integration.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
