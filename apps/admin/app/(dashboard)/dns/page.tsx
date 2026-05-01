'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { authFetch } from '@rally/firebase';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Input,
  DataTable,
  Skeleton,
  useToast,
  Modal,
  ModalHeader,
  ModalBody,
} from '@rally/ui';
import type { ColumnDef } from '@rally/ui';
import {
  Globe,
  Plus,
  Cloud,
  CloudOff,
  Pencil,
  Trash2,
  Search,
  Server,
  Link2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

type DnsFilter = 'all' | 'a' | 'cname' | 'other';

const FILTER_OPTIONS: { label: string; value: DnsFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'A Records', value: 'a' },
  { label: 'CNAME', value: 'cname' },
  { label: 'Other', value: 'other' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────

function formatTtl(ttl: number): string {
  if (ttl === 1) return 'Auto';
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
  return `${Math.floor(ttl / 3600)}h`;
}

function getTypeBadgeVariant(type: string): 'gold' | 'info' | 'warning' | 'default' {
  switch (type) {
    case 'A':
      return 'gold';
    case 'CNAME':
      return 'info';
    case 'MX':
      return 'warning';
    default:
      return 'default';
  }
}

// ── Component ──────────────────────────────────────────────────────

export default function DnsPage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<DnsFilter>('all');

  // Edit/Delete modal state
  const [editTarget, setEditTarget] = useState<DnsRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DnsRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form state — initialized when modal opens
  const [editContent, setEditContent] = useState('');
  const [editProxied, setEditProxied] = useState(false);
  const [editTtl, setEditTtl] = useState<number>(1);

  // ── Fetch DNS records from API ──────────────────────────────────

  const fetchRecords = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/dns')
      .then((res) => res.json())
      .then((data: { success?: boolean; data?: DnsRecord[] }) => {
        if (data.data) setRecords(data.data);
      })
      .catch(() => {
        toast({ type: 'error', title: 'Failed to load DNS records', description: 'Could not reach the Cloudflare API.' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── Filtered data ────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      // Apply type filter
      if (activeFilter === 'a' && record.type !== 'A') return false;
      if (activeFilter === 'cname' && record.type !== 'CNAME') return false;
      if (activeFilter === 'other' && (record.type === 'A' || record.type === 'CNAME')) return false;
      return true;
    });
  }, [records, activeFilter]);

  // ── Stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = records.length;
    const aRecords = records.filter((r) => r.type === 'A').length;
    const cnameRecords = records.filter((r) => r.type === 'CNAME').length;
    const proxied = records.filter((r) => r.proxied).length;
    return { total, aRecords, cnameRecords, proxied };
  }, [records]);

  // ── Open Edit modal ──────────────────────────────────────────────

  const openEditModal = useCallback((record: DnsRecord) => {
    setEditTarget(record);
    setEditContent(record.content);
    setEditProxied(record.proxied);
    setEditTtl(record.ttl);
  }, []);

  // ── Submit Edit ──────────────────────────────────────────────────

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;

    setSubmitting(true);
    try {
      const res = await authFetch(`/api/admin/dns/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent.trim(),
          proxied: editProxied,
          ttl: editTtl,
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: DnsRecord; error?: string };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Failed to update DNS record');
      }

      const updated = json.data;
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast({
        type: 'success',
        title: 'DNS record updated',
        description: `${updated.type} record for ${updated.name} has been saved.`,
      });
      setEditTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error while updating DNS record';
      toast({ type: 'error', title: 'Update failed', description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit Delete ────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/admin/dns/${deleteTarget.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to delete DNS record');
      }

      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast({
        type: 'success',
        title: 'DNS record deleted',
        description: `${deleteTarget.type} record for ${deleteTarget.name} has been removed.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error while deleting DNS record';
      toast({ type: 'error', title: 'Delete failed', description: message });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Add Record handler ──────────────────────────────────────────

  function handleAddRecord() {
    const name = window.prompt('Subdomain name (e.g. new-dealer.rally.vin):');
    if (!name) return;
    const content = window.prompt('IP address (e.g. 74.208.123.209):', '74.208.123.209');
    if (!content) return;

    authFetch('/api/admin/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    })
      .then((res) => res.json())
      .then((data: { success?: boolean; data?: DnsRecord; error?: string }) => {
        if (data.success && data.data) {
          setRecords((prev) => [...prev, data.data as DnsRecord]);
          toast({
            type: 'success',
            title: 'DNS record created',
            description: `A record for ${name} has been created.`,
          });
        } else {
          toast({
            type: 'error',
            title: 'Create failed',
            description: data.error ?? 'Could not create the DNS record.',
          });
        }
      })
      .catch(() => {
        toast({
          type: 'error',
          title: 'Create failed',
          description: 'Network error while creating DNS record.',
        });
      });
  }

  // ── Columns ──────────────────────────────────────────────────────

  const columns: ColumnDef<DnsRecord, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="font-medium text-text-primary font-[family-name:var(--font-geist-mono)] text-xs">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={getTypeBadgeVariant(row.original.type)} size="sm">
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'content',
        header: 'Content',
        cell: ({ row }) => (
          <span className="text-text-secondary font-[family-name:var(--font-geist-mono)] text-xs truncate max-w-[240px] block">
            {row.original.content}
          </span>
        ),
      },
      {
        accessorKey: 'proxied',
        header: 'Proxied',
        cell: ({ row }) =>
          row.original.proxied ? (
            <div className="flex items-center gap-1.5">
              <Cloud className="h-4 w-4 text-orange-400" />
              <Badge variant="gold" size="sm">
                Proxied
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CloudOff className="h-4 w-4 text-text-tertiary" />
              <Badge variant="default" size="sm">
                DNS Only
              </Badge>
            </div>
          ),
      },
      {
        accessorKey: 'ttl',
        header: 'TTL',
        cell: ({ row }) => (
          <span className="text-text-tertiary text-xs">
            {formatTtl(row.original.ttl)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(row.original);
              }}
              aria-label={`Edit ${row.original.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [openEditModal],
  );

  // ── Stat cards data ──────────────────────────────────────────────

  const STAT_CARDS = [
    { label: 'Total Records', value: stats.total, icon: Globe },
    { label: 'A Records', value: stats.aRecords, icon: Server },
    { label: 'CNAME', value: stats.cnameRecords, icon: Link2 },
    { label: 'Proxied', value: stats.proxied, icon: ShieldCheck },
  ] as const;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">DNS Records</h1>
          <p className="text-sm text-text-secondary mt-1">
            Cloudflare DNS records for the rally.vin zone
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleAddRecord}
        >
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    {stat.label}
                  </p>
                  <StatIcon className="h-4 w-4 text-text-tertiary" />
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

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={activeFilter === option.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-12" />
          ))}
        </div>
      ) : (
      <DataTable<DnsRecord>
        columns={columns}
        data={filteredRecords}
        globalFilter={search}
        emptyIcon={Globe}
        emptyMessage="No DNS records found"
        emptyDescription="No records match the current search and filter criteria."
        defaultPageSize={25}
      />
      )}

      {/* ── Edit Modal ──────────────────────────────────────────── */}
      <Modal
        open={editTarget !== null}
        onClose={() => (submitting ? undefined : setEditTarget(null))}
        labelledBy="dns-edit-modal-title"
      >
        <ModalHeader
          title="Edit DNS Record"
          titleId="dns-edit-modal-title"
          description={editTarget ? `${editTarget.type} • ${editTarget.name}` : undefined}
          onClose={() => setEditTarget(null)}
          closeDisabled={submitting}
        />
        <ModalBody>
        {editTarget && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-secondary">
                Content
              </label>
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="74.208.123.209"
                required
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-text-tertiary">
                For A records, this is the target IPv4 address.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-secondary">
                TTL
              </label>
              <select
                value={editTtl}
                onChange={(e) => setEditTtl(Number(e.target.value))}
                disabled={submitting}
                className="w-full rounded-rally border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-rally-gold focus:outline-none focus:ring-2 focus:ring-rally-gold/20"
              >
                <option value={1}>Auto</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={86400}>1 day</option>
              </select>
            </div>

            <div className="flex items-start gap-3 rounded-rally border border-surface-border bg-surface-overlay p-3">
              <input
                id="edit-proxied"
                type="checkbox"
                checked={editProxied}
                onChange={(e) => setEditProxied(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 rounded border-surface-border bg-surface-base accent-rally-gold"
              />
              <label htmlFor="edit-proxied" className="cursor-pointer">
                <span className="block text-sm font-medium text-text-primary">
                  Proxy through Cloudflare
                </span>
                <span className="block text-xs text-text-tertiary">
                  Enable orange-cloud CDN + WAF. Disable for raw DNS only.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setEditTarget(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting || editContent.trim().length === 0}
              >
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
        </ModalBody>
      </Modal>

      {/* ── Delete Confirmation Modal ──────────────────────────── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => (submitting ? undefined : setDeleteTarget(null))}
        labelledBy="dns-delete-modal-title"
      >
        <ModalHeader
          title="Delete DNS Record"
          titleId="dns-delete-modal-title"
          description="This action cannot be undone."
          onClose={() => setDeleteTarget(null)}
          closeDisabled={submitting}
        />
        <ModalBody>
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-rally border border-status-error/30 bg-status-error/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-error" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Remove {deleteTarget.type} record for {deleteTarget.name}?
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Any tenant subdomain or service relying on this record will stop resolving
                  immediately. DNS deletes propagate within ~60 seconds via Cloudflare.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-rally border border-surface-border bg-surface-overlay p-3 text-xs">
              <div>
                <dt className="text-text-tertiary uppercase tracking-wider">Name</dt>
                <dd className="font-[family-name:var(--font-geist-mono)] text-text-primary">
                  {deleteTarget.name}
                </dd>
              </div>
              <div>
                <dt className="text-text-tertiary uppercase tracking-wider">Content</dt>
                <dd className="font-[family-name:var(--font-geist-mono)] text-text-primary truncate">
                  {deleteTarget.content}
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={handleDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? 'Deleting…' : 'Delete record'}
              </Button>
            </div>
          </div>
        )}
        </ModalBody>
      </Modal>
    </div>
  );
}
