'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Skeleton,
  EmptyState,
  useToast,
} from '@rally/ui';
import { useFeatureFlags } from '@rally/firebase';
import type { FeatureFlag as FirestoreFeatureFlag } from '@rally/firebase';
import {
  ToggleLeft,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  tenantOverrides: Record<string, boolean>;
  updatedAt: string;
  updatedBy: string;
}

// ── Toggle Switch ──────────────────────────────────────────────────
// Inline styled toggle. Gold when on, border when off.

function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'cursor-pointer disabled:pointer-events-none disabled:opacity-50',
        checked
          ? 'bg-rally-gold'
          : 'bg-surface-overlay border border-surface-border',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full shadow-rally-sm',
          'transition-transform duration-200 ease-in-out',
          checked
            ? 'translate-x-6 bg-text-inverse'
            : 'translate-x-0.5 bg-text-tertiary',
        ].join(' ')}
      />
    </button>
  );
}

// ── Map Firestore flags to page-level FeatureFlag ─────────────────

function mapFirestoreFlag(f: FirestoreFeatureFlag): FeatureFlag {
  return {
    id: f.id ?? f.key,
    key: f.key,
    name: f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: f.description ?? '',
    enabled: f.enabled,
    rolloutPercentage: f.rolloutPercentage ?? (f.enabled ? 100 : 0),
    tenantOverrides: f.tenantOverrides ?? {},
    updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : String(f.updatedAt),
    updatedBy: '',
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTenantLabel(slug: string): string {
  const labels: Record<string, string> = {
    'gallatin-cdjr': 'Gallatin CDJR',
    'acme-motors': 'Acme Motors',
    'prestige-auto': 'Prestige Auto',
  };
  return labels[slug] ?? slug;
}

// ── Feature Flag Card ──────────────────────────────────────────────

function FlagCard({
  flag,
  onToggle,
  onToggleTenant,
  onUpdateRollout,
}: {
  flag: FeatureFlag;
  onToggle: (id: string, enabled: boolean) => void;
  onToggleTenant: (flagId: string, tenantSlug: string, enabled: boolean) => void;
  onUpdateRollout: (flagId: string, percentage: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tenantEntries = Object.entries(flag.tenantOverrides);
  const isPartialRollout = flag.enabled && flag.rolloutPercentage < 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-text-primary">
                {flag.name}
              </h3>
              {isPartialRollout && (
                <Badge variant="warning" size="sm">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Partial Rollout
                </Badge>
              )}
              {!flag.enabled && (
                <Badge variant="default" size="sm">
                  Disabled
                </Badge>
              )}
            </div>
            <p className="text-sm text-text-secondary mt-1">
              {flag.description}
            </p>
            <p className="font-[family-name:var(--font-geist-mono)] text-xs text-text-tertiary mt-2">
              {flag.key}
            </p>
          </div>
          <ToggleSwitch
            checked={flag.enabled}
            onChange={(val) => onToggle(flag.id, val)}
            label={`Toggle ${flag.name}`}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rollout Percentage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Rollout
            </span>
            <span className="text-xs font-medium text-text-primary font-[family-name:var(--font-geist-mono)]">
              {flag.rolloutPercentage}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-full rounded-full bg-rally-gold transition-all duration-300 ease-out"
              style={{ width: `${flag.rolloutPercentage}%` }}
            />
          </div>
          {flag.enabled && (
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={flag.rolloutPercentage}
              onChange={(e) => onUpdateRollout(flag.id, Number(e.target.value))}
              className="w-full h-1 appearance-none cursor-pointer bg-transparent
                [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-overlay
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rally-gold [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:shadow-rally-sm
                [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-overlay
                [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-rally-gold [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-rally-sm"
              aria-label={`Rollout percentage for ${flag.name}`}
            />
          )}
        </div>

        {/* Tenant Overrides (expandable) */}
        {tenantEntries.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-rally-gold hover:text-rally-goldLight transition-colors cursor-pointer"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Users className="h-3.5 w-3.5" />
              Tenant Overrides ({tenantEntries.length})
            </button>

            {expanded && (
              <div className="mt-3 space-y-2 pl-6">
                {tenantEntries.map(([slug, enabled]) => (
                  <div
                    key={slug}
                    className="flex items-center justify-between py-2 px-3 rounded-rally bg-surface-overlay"
                  >
                    <span className="text-sm text-text-primary">
                      {getTenantLabel(slug)}
                    </span>
                    <ToggleSwitch
                      checked={enabled}
                      onChange={(val) => onToggleTenant(flag.id, slug, val)}
                      label={`Toggle ${flag.name} for ${getTenantLabel(slug)}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Clock className="h-3.5 w-3.5" />
          <span>Updated {formatDate(flag.updatedAt)} by {flag.updatedBy}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const { featureFlags: firestoreFlags, loading, error } = useFeatureFlags();
  const flags: FeatureFlag[] = firestoreFlags.map(mapFirestoreFlag);
  const [search, setSearch] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      const flag = flags.find((f) => f.id === id);
      fetch(`/api/admin/feature-flags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
        .then((res) => res.json())
        .then((data: { success?: boolean; error?: string }) => {
          if (data.success) {
            toast({
              type: enabled ? 'success' : 'warning',
              title: `${flag?.name ?? 'Flag'} ${enabled ? 'enabled' : 'disabled'}`,
              description: enabled
                ? 'Flag is now active globally.'
                : 'Flag has been disabled for all tenants.',
            });
          } else {
            toast({ type: 'error', title: 'Toggle failed', description: data.error ?? 'Unknown error' });
          }
        })
        .catch(() => {
          toast({ type: 'error', title: 'Toggle failed', description: 'Network error' });
        });
    },
    [flags, toast],
  );

  const handleToggleTenant = useCallback(
    (flagId: string, tenantSlug: string, enabled: boolean) => {
      const flag = flags.find((f) => f.id === flagId);
      const updatedOverrides = { ...(flag?.tenantOverrides ?? {}), [tenantSlug]: enabled };

      fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantOverrides: updatedOverrides }),
      })
        .then((res) => res.json())
        .then((data: { success?: boolean; error?: string }) => {
          if (data.success) {
            toast({
              type: 'info',
              title: 'Tenant override updated',
              description: `${getTenantLabel(tenantSlug)} override set to ${enabled ? 'enabled' : 'disabled'}.`,
            });
          } else {
            toast({ type: 'error', title: 'Override failed', description: data.error ?? 'Unknown error' });
          }
        })
        .catch(() => {
          toast({ type: 'error', title: 'Override failed', description: 'Network error' });
        });
    },
    [flags, toast],
  );

  const handleUpdateRollout = useCallback(
    (flagId: string, percentage: number) => {
      fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolloutPercentage: percentage }),
      }).catch(() => {
        toast({ type: 'error', title: 'Rollout update failed', description: 'Network error' });
      });
    },
    [toast],
  );

  // ── Filter by search ─────────────────────────────────────────────

  const filteredFlags = flags.filter((flag) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      flag.name.toLowerCase().includes(q) ||
      flag.key.toLowerCase().includes(q) ||
      flag.description.toLowerCase().includes(q)
    );
  });

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Feature Flags</h1>
          <p className="text-sm text-text-secondary mt-1">
            Global feature toggles with per-tenant overrides
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            const key = window.prompt('Flag key (e.g. new_feature):');
            if (!key) return;
            const description = window.prompt('Flag description:') ?? '';
            const id = key.replace(/\s+/g, '_').toLowerCase();

            fetch('/api/admin/feature-flags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, name: key, enabled: false, description }),
            })
              .then((res) => res.json())
              .then((data: { success?: boolean; error?: string }) => {
                if (data.success) {
                  toast({ type: 'success', title: 'Flag created', description: `${key} has been added.` });
                } else {
                  toast({ type: 'error', title: 'Create failed', description: data.error ?? 'Unknown error' });
                }
              })
              .catch(() => {
                toast({ type: 'error', title: 'Create failed', description: 'Network error' });
              });
          }}
        >
          <Plus className="h-4 w-4" />
          Create Flag
        </Button>
      </div>

      {/* Summary Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="gold" size="md">
          {flags.length} Total
        </Badge>
        <Badge variant="success" size="md">
          {flags.filter((f) => f.enabled).length} Active
        </Badge>
        <Badge variant="default" size="md">
          {flags.filter((f) => !f.enabled).length} Disabled
        </Badge>
        <Badge variant="warning" size="md">
          {flags.filter((f) => f.enabled && f.rolloutPercentage < 100).length} Partial Rollout
        </Badge>
      </div>

      {/* Search */}
      <div className="w-full sm:w-80">
        <Input
          placeholder="Search flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-48" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 rounded-rally-lg border border-status-error/30 bg-status-error/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-status-error shrink-0" />
          <p className="text-sm text-status-error">
            Failed to load feature flags: {error.message}
          </p>
        </div>
      )}

      {/* Flag Cards */}
      {!loading && filteredFlags.length === 0 ? (
        <EmptyState
          icon={ToggleLeft}
          title="No feature flags found"
          description="No flags match the current search criteria."
        />
      ) : !loading ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredFlags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              onToggle={handleToggle}
              onToggleTenant={handleToggleTenant}
              onUpdateRollout={handleUpdateRollout}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
