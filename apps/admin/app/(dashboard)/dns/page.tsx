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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // ── Delete handler ───────────────────────────────────────────────

  function handleDelete(record: DnsRecord) {
    if (deletingId === record.id) {
      // Confirmed — call API to delete
      setDeletingId(null);
      fetch(`/api/admin/dns/${record.id}`, { method: 'DELETE' })
        .then((res) => res.json())
        .then((data: { success?: boolean; error?: string }) => {
          if (data.success) {
            setRecords((prev) => prev.filter((r) => r.id !== record.id));
            toast({
              type: 'success',
              title: 'DNS record deleted',
              description: `${record.type} record for ${record.name} has been removed.`,
            });
          } else {
            toast({
              type: 'error',
              title: 'Delete failed',
              description: data.error ?? 'Could not delete the DNS record.',
            });
          }
        })
        .catch(() => {
          toast({
            type: 'error',
            title: 'Delete failed',
            description: 'Network error while deleting DNS record.',
          });
        });
    } else {
      // First click — confirm
      setDeletingId(record.id);
      toast({
        type: 'warning',
        title: 'Confirm deletion',
        description: `Click delete again to remove ${record.name}. This cannot be undone.`,
        duration: 4000,
      });
      // Auto-clear confirmation after 4 seconds
      setTimeout(() => {
        setDeletingId((current) => (current === record.id ? null : current));
      }, 4000);
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
                toast({
                  type: 'info',
                  title: 'Edit coming soon',
                  description: `Editing ${row.original.name} will be available when the Cloudflare API route is connected.`,
                });
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={deletingId === row.original.id ? 'danger' : 'ghost'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [deletingId, toast],
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
    </div>
  );
}
