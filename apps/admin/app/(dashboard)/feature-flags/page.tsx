'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { authFetch, useFeatureFlags, useTenants } from '@rally/firebase';
import type { FeatureFlag as FirestoreFeatureFlag, DealerGroup } from '@rally/firebase';
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
  Modal,
  ModalHeader,
  ModalBody,
} from '@rally/ui';
import {
  ToggleLeft,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  AlertTriangle,
  Trash2,
  X,
} from 'lucide-react';

// ── Zod schemas ────────────────────────────────────────────────────

const FLAG_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

const createFlagSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .regex(
      FLAG_KEY_REGEX,
      'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
    ),
  description: z.string().max(500).optional(),
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100),
});

type CreateFlagInput = z.infer<typeof createFlagSchema>;

// ── Page-level type ────────────────────────────────────────────────

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  tenantOverrides: Record<string, boolean>;
  updatedAt: string;
}

// ── Toggle Switch ──────────────────────────────────────────────────

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

// ── Map Firestore flag → page flag ─────────────────────────────────

function mapFirestoreFlag(f: FirestoreFeatureFlag): FeatureFlag {
  const id = f.id ?? f.key;
  const updatedAt =
    f.updatedAt instanceof Date
      ? f.updatedAt.toISOString()
      : typeof f.updatedAt === 'string'
        ? f.updatedAt
        : new Date().toISOString();
  return {
    id,
    key: f.key,
    name: f.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: f.description ?? '',
    enabled: f.enabled,
    rolloutPercentage: f.rolloutPercentage ?? (f.enabled ? 100 : 0),
    tenantOverrides: f.tenantOverrides ?? {},
    updatedAt,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Create Flag Modal ──────────────────────────────────────────────

function CreateFlagModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateFlagInput) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [rolloutPercent, setRolloutPercent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset on close
  useEffect(() => {
    if (!open) {
      setKey('');
      setDescription('');
      setEnabled(false);
      setRolloutPercent(0);
      setErrors({});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = createFlagSchema.safeParse({
      key,
      description: description || undefined,
      enabled,
      rolloutPercent,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onCreate(result.data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-flag-modal-title"
    >
      <ModalHeader
        title="Create Feature Flag"
        titleId="create-flag-modal-title"
        onClose={onClose}
        closeDisabled={submitting}
      />
      <ModalBody>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="flag-key"
            className="block text-xs font-medium uppercase tracking-wider text-text-secondary mb-1.5"
          >
            Key
          </label>
          <Input
            id="flag-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="new_feature"
            autoFocus
            disabled={submitting}
          />
          {errors.key && (
            <p className="text-xs text-status-error mt-1">{errors.key}</p>
          )}
          <p className="text-xs text-text-tertiary mt-1">
            Lowercase letters, numbers, and underscores. Must start with a letter.
          </p>
        </div>
        <div>
          <label
            htmlFor="flag-description"
            className="block text-xs font-medium uppercase tracking-wider text-text-secondary mb-1.5"
          >
            Description
          </label>
          <Input
            id="flag-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of what this flag controls"
            disabled={submitting}
          />
          {errors.description && (
            <p className="text-xs text-status-error mt-1">{errors.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between rounded-rally bg-surface-overlay px-3 py-2.5">
          <div>
            <p className="text-sm text-text-primary">Enabled on create</p>
            <p className="text-xs text-text-tertiary">
              You can flip this any time after creation.
            </p>
          </div>
          <ToggleSwitch
            checked={enabled}
            onChange={setEnabled}
            label="Enabled on create"
            disabled={submitting}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="flag-rollout"
              className="block text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Rollout
            </label>
            <span className="text-xs font-medium text-text-primary font-[family-name:var(--font-geist-mono)]">
              {rolloutPercent}%
            </span>
          </div>
          <input
            id="flag-rollout"
            type="range"
            min={0}
            max={100}
            step={5}
            value={rolloutPercent}
            onChange={(e) => setRolloutPercent(Number(e.target.value))}
            disabled={submitting}
            className="w-full h-1 appearance-none cursor-pointer bg-transparent
              [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-overlay
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rally-gold [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:shadow-rally-sm
              [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-overlay
              [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-rally-gold [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-rally-sm"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Flag'}
          </Button>
        </div>
      </form>
      </ModalBody>
    </Modal>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────

function DeleteConfirmModal({
  open,
  flag,
  onClose,
  onConfirm,
}: {
  open: boolean;
  flag: FeatureFlag | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!flag) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="delete-flag-modal-title"
    >
      <ModalHeader
        title="Delete Feature Flag"
        titleId="delete-flag-modal-title"
        onClose={onClose}
        closeDisabled={submitting}
      />
      <ModalBody>
      <div className="space-y-4">
        <p className="text-sm text-text-primary">
          Are you sure you want to delete{' '}
          <span className="font-[family-name:var(--font-geist-mono)] text-rally-gold">
            {flag.key}
          </span>
          ?
        </p>
        <p className="text-xs text-text-secondary">
          This action cannot be undone. Code that consumes this flag will fall back to its default.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={handleConfirm}
            disabled={submitting}
          >
            <Trash2 className="h-4 w-4" />
            {submitting ? 'Deleting…' : 'Delete Flag'}
          </Button>
        </div>
      </div>
      </ModalBody>
    </Modal>
  );
}

// ── Tenant Override Editor (inline) ────────────────────────────────

function TenantOverrideEditor({
  flag,
  tenants,
  onSetOverride,
  onRemoveOverride,
}: {
  flag: FeatureFlag;
  tenants: DealerGroup[];
  onSetOverride: (flagId: string, tenantId: string, enabled: boolean) => void;
  onRemoveOverride: (flagId: string, tenantId: string) => void;
}) {
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const tenantsById = useMemo(() => {
    const map: Record<string, DealerGroup> = {};
    for (const t of tenants) {
      if (t.id) map[t.id] = t;
    }
    return map;
  }, [tenants]);

  const overrideEntries = Object.entries(flag.tenantOverrides);
  const availableTenants = tenants.filter(
    (t) => t.id && !(t.id in flag.tenantOverrides),
  );

  const handleAdd = () => {
    if (!selectedTenantId) return;
    onSetOverride(flag.id, selectedTenantId, true);
    setSelectedTenantId('');
  };

  return (
    <div className="space-y-3 pl-6">
      {overrideEntries.length === 0 && (
        <p className="text-xs text-text-tertiary italic">
          No per-tenant overrides. The global toggle and rollout apply to all tenants.
        </p>
      )}
      {overrideEntries.map(([tenantId, enabled]) => {
        const tenant = tenantsById[tenantId];
        return (
          <div
            key={tenantId}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-rally bg-surface-overlay"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary truncate">
                {tenant?.name ?? tenantId}
              </p>
              {tenant?.slug && (
                <p className="text-xs text-text-tertiary font-[family-name:var(--font-geist-mono)] truncate">
                  {tenant.slug}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={enabled}
                onChange={(val) => onSetOverride(flag.id, tenantId, val)}
                label={`Toggle ${flag.name} for ${tenant?.name ?? tenantId}`}
              />
              <button
                type="button"
                onClick={() => onRemoveOverride(flag.id, tenantId)}
                aria-label={`Remove override for ${tenant?.name ?? tenantId}`}
                className="text-text-tertiary hover:text-status-error transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
      {availableTenants.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="flex-1 rounded-rally border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-rally-gold cursor-pointer"
            aria-label="Select tenant to override"
          >
            <option value="">Select tenant…</option>
            {availableTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={!selectedTenantId}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Feature Flag Card ──────────────────────────────────────────────

function FlagCard({
  flag,
  tenants,
  onToggle,
  onSetTenantOverride,
  onRemoveTenantOverride,
  onUpdateRollout,
  onDelete,
}: {
  flag: FeatureFlag;
  tenants: DealerGroup[];
  onToggle: (id: string, enabled: boolean) => void;
  onSetTenantOverride: (flagId: string, tenantId: string, enabled: boolean) => void;
  onRemoveTenantOverride: (flagId: string, tenantId: string) => void;
  onUpdateRollout: (flagId: string, percentage: number) => void;
  onDelete: (flag: FeatureFlag) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const overrideCount = Object.keys(flag.tenantOverrides).length;
  const isPartialRollout = flag.enabled && flag.rolloutPercentage < 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
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
              {overrideCount > 0 && (
                <Badge variant="info" size="sm">
                  <Users className="h-3 w-3 mr-1" />
                  {overrideCount} override{overrideCount === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
            {flag.description && (
              <p className="text-sm text-text-secondary mt-1">
                {flag.description}
              </p>
            )}
            <p className="font-[family-name:var(--font-geist-mono)] text-xs text-text-tertiary mt-2">
              {flag.key}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ToggleSwitch
              checked={flag.enabled}
              onChange={(val) => onToggle(flag.id, val)}
              label={`Toggle ${flag.name}`}
            />
            <button
              type="button"
              onClick={() => onDelete(flag)}
              aria-label={`Delete ${flag.name}`}
              className="text-text-tertiary hover:text-status-error transition-colors cursor-pointer p-1.5 rounded-rally hover:bg-surface-overlay"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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

        {/* Tenant Overrides */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-rally-gold hover:text-rally-goldLight transition-colors cursor-pointer"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Users className="h-3.5 w-3.5" />
            Tenant Overrides ({overrideCount})
          </button>

          {expanded && (
            <div className="mt-3">
              <TenantOverrideEditor
                flag={flag}
                tenants={tenants}
                onSetOverride={onSetTenantOverride}
                onRemoveOverride={onRemoveTenantOverride}
              />
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Clock className="h-3.5 w-3.5" />
          <span>Updated {formatDate(flag.updatedAt)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function FeatureFlagsPage() {
  const { toast } = useToast();
  const { featureFlags: firestoreFlags, loading, error } = useFeatureFlags();
  const { tenants } = useTenants();

  // Optimistic updates: a per-flag overlay. Snapshot listener is the source
  // of truth — whenever Firestore emits, the overlay for that flag is cleared.
  const [optimistic, setOptimistic] = useState<Record<string, Partial<FeatureFlag>>>({});

  // Clear optimistic entry once the Firestore snapshot reflects (or moves on)
  const lastSeenUpdatedAt = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of firestoreFlags) {
      const id = f.id ?? f.key;
      const ts =
        f.updatedAt instanceof Date
          ? f.updatedAt.toISOString()
          : typeof f.updatedAt === 'string'
            ? f.updatedAt
            : '';
      if (id) map[id] = ts;
    }
    return map;
  }, [firestoreFlags]);

  useEffect(() => {
    setOptimistic((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const next: Record<string, Partial<FeatureFlag>> = {};
      for (const id of ids) {
        // If the doc still exists in the snapshot, drop the overlay — server
        // is now authoritative. Items still missing from the snapshot stay
        // (e.g. just-created and not yet streamed back).
        if (!(id in lastSeenUpdatedAt)) next[id] = prev[id]!;
      }
      return next;
    });
  }, [lastSeenUpdatedAt]);

  const flags: FeatureFlag[] = useMemo(() => {
    const base = firestoreFlags.map(mapFirestoreFlag);
    return base.map((f) => {
      const overlay = optimistic[f.id];
      return overlay ? { ...f, ...overlay } : f;
    });
  }, [firestoreFlags, optimistic]);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FeatureFlag | null>(null);

  // ── Mutation helper ──────────────────────────────────────────────

  const putFlag = useCallback(
    async (
      flagId: string,
      body: Record<string, unknown>,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const res = await authFetch(`/api/admin/feature-flags/${flagId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          return { ok: false, error: data.error ?? `HTTP ${res.status}` };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
      }
    },
    [],
  );

  // ── Toggle global enabled ────────────────────────────────────────

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      const flag = flags.find((f) => f.id === id);
      if (!flag) return;

      // Optimistic
      setOptimistic((prev) => ({ ...prev, [id]: { ...prev[id], enabled } }));

      const result = await putFlag(id, { enabled });
      if (!result.ok) {
        // Revert
        setOptimistic((prev) => ({ ...prev, [id]: { ...prev[id], enabled: flag.enabled } }));
        toast({ type: 'error', title: 'Toggle failed', description: result.error });
        return;
      }
      toast({
        type: enabled ? 'success' : 'warning',
        title: `${flag.name} ${enabled ? 'enabled' : 'disabled'}`,
        description: enabled
          ? 'Flag is now active globally.'
          : 'Flag has been disabled for all tenants.',
      });
    },
    [flags, putFlag, toast],
  );

  // ── Set / remove a per-tenant override ───────────────────────────

  const handleSetTenantOverride = useCallback(
    async (flagId: string, tenantId: string, enabled: boolean) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;
      const tenant = tenants.find((t) => t.id === tenantId);
      const merged = { ...flag.tenantOverrides, [tenantId]: enabled };

      setOptimistic((prev) => ({
        ...prev,
        [flagId]: { ...prev[flagId], tenantOverrides: merged },
      }));

      const result = await putFlag(flagId, { tenantOverrides: merged });
      if (!result.ok) {
        setOptimistic((prev) => ({
          ...prev,
          [flagId]: { ...prev[flagId], tenantOverrides: flag.tenantOverrides },
        }));
        toast({ type: 'error', title: 'Override failed', description: result.error });
        return;
      }
      toast({
        type: 'info',
        title: 'Tenant override updated',
        description: `${tenant?.name ?? tenantId} override set to ${enabled ? 'enabled' : 'disabled'}.`,
      });
    },
    [flags, tenants, putFlag, toast],
  );

  const handleRemoveTenantOverride = useCallback(
    async (flagId: string, tenantId: string) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;
      const tenant = tenants.find((t) => t.id === tenantId);
      const merged = { ...flag.tenantOverrides };
      delete merged[tenantId];

      setOptimistic((prev) => ({
        ...prev,
        [flagId]: { ...prev[flagId], tenantOverrides: merged },
      }));

      const result = await putFlag(flagId, { tenantOverrides: merged });
      if (!result.ok) {
        setOptimistic((prev) => ({
          ...prev,
          [flagId]: { ...prev[flagId], tenantOverrides: flag.tenantOverrides },
        }));
        toast({ type: 'error', title: 'Remove override failed', description: result.error });
        return;
      }
      toast({
        type: 'info',
        title: 'Override removed',
        description: `${tenant?.name ?? tenantId} now follows the global rollout.`,
      });
    },
    [flags, tenants, putFlag, toast],
  );

  // ── Update rollout percentage (debounce + optimistic) ────────────

  const handleUpdateRollout = useCallback(
    (flagId: string, percentage: number) => {
      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;

      // Optimistic immediately
      setOptimistic((prev) => ({
        ...prev,
        [flagId]: { ...prev[flagId], rolloutPercentage: percentage },
      }));

      // Fire-and-handle (no per-tick toast — only on failure)
      void (async () => {
        const result = await putFlag(flagId, { rolloutPercentage: percentage });
        if (!result.ok) {
          setOptimistic((prev) => ({
            ...prev,
            [flagId]: { ...prev[flagId], rolloutPercentage: flag.rolloutPercentage },
          }));
          toast({ type: 'error', title: 'Rollout update failed', description: result.error });
        }
      })();
    },
    [flags, putFlag, toast],
  );

  // ── Create ────────────────────────────────────────────────────────

  const handleCreate = useCallback(
    async (input: CreateFlagInput) => {
      try {
        const res = await authFetch('/api/admin/feature-flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: input.key,
            name: input.key,
            enabled: input.enabled,
            description: input.description ?? '',
            // The POST handler currently ignores rolloutPercent on create, so we
            // follow up with a PUT to set it. Cheap and keeps the UX consistent.
          }),
        });
        const data = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        if (input.rolloutPercent !== 0) {
          await putFlag(input.key, { rolloutPercentage: input.rolloutPercent });
        }
        toast({
          type: 'success',
          title: 'Flag created',
          description: `${input.key} has been added.`,
        });
      } catch (e) {
        toast({
          type: 'error',
          title: 'Create failed',
          description: e instanceof Error ? e.message : 'Unknown error',
        });
        throw e; // keep the modal open
      }
    },
    [putFlag, toast],
  );

  // ── Delete ────────────────────────────────────────────────────────

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const flag = pendingDelete;
    try {
      const res = await authFetch(`/api/admin/feature-flags/${flag.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast({
        type: 'success',
        title: 'Flag deleted',
        description: `${flag.key} has been removed.`,
      });
    } catch (e) {
      toast({
        type: 'error',
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
      throw e;
    }
  }, [pendingDelete, toast]);

  // ── Filter by search ─────────────────────────────────────────────

  const filteredFlags = useMemo(() => {
    if (!search.trim()) return flags;
    const q = search.toLowerCase();
    return flags.filter(
      (flag) =>
        flag.name.toLowerCase().includes(q) ||
        flag.key.toLowerCase().includes(q) ||
        flag.description.toLowerCase().includes(q),
    );
  }, [flags, search]);

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
          onClick={() => setCreateOpen(true)}
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
          description={
            search
              ? 'No flags match the current search criteria.'
              : 'Create your first flag to start gating features.'
          }
        />
      ) : !loading ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredFlags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              tenants={tenants}
              onToggle={handleToggle}
              onSetTenantOverride={handleSetTenantOverride}
              onRemoveTenantOverride={handleRemoveTenantOverride}
              onUpdateRollout={handleUpdateRollout}
              onDelete={(f) => setPendingDelete(f)}
            />
          ))}
        </div>
      ) : null}

      {/* Modals */}
      <CreateFlagModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <DeleteConfirmModal
        open={pendingDelete !== null}
        flag={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
