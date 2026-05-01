'use client';

// Manage NFC — GM-tier NFC tag inventory
// Table of programmed tags with KPIs and CSV export (TODO: wired by reports agent).

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Nfc,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
  Input,
  Button,
  EmptyState,
  DataTable,
  DateRangePicker,
  type ColumnDef,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import {
  useNfcTags,
  NFC_TAG_STATUS_DISPLAY,
  type NFCTag,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}

function isoDateToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((p) => Number.parseInt(p, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDate(date: Date | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function daysSince(date: Date | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  hint?: string;
  tone?: 'gold' | 'success' | 'warning' | 'error';
}

function KpiCard({ label, value, hint, tone = 'gold' }: KpiCardProps) {
  const valueClass = {
    gold: 'text-[var(--text-primary)]',
    success: 'text-[var(--status-success)]',
    warning: 'text-[var(--status-warning)]',
    error: 'text-[var(--status-error)]',
  }[tone];
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </p>
        <p className={`text-3xl font-bold tabular-nums mt-1 ${valueClass}`}>{value}</p>
        {hint && <p className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NfcSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-96" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface NfcRow extends NFCTag {
  // computed display fields
  stockNumberDisplay: string;
  vinDisplay: string;
  programmedAtDisplay: string;
  lastTappedAtDisplay: string;
  daysSinceTap: number | null;
}

const UNTAPPED_DEFAULT_DAYS = 7;

export default function ManageNfcPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const { tags, loading, error } = useNfcTags({ dealershipId });

  const [search, setSearch] = useState('');
  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toISODate(d);
  });
  const [endDate, setEndDate] = useState(() => toISODate(today));
  const [showUntappedOnly, setShowUntappedOnly] = useState(false);
  const [untappedDays, setUntappedDays] = useState(UNTAPPED_DEFAULT_DAYS);

  // Filter
  const filtered = useMemo(() => {
    const startMs = isoDateToDate(startDate).getTime();
    const endMs = endOfDay(isoDateToDate(endDate)).getTime();
    const untappedThreshold = Date.now() - untappedDays * 24 * 60 * 60 * 1000;

    return tags.filter((tag) => {
      // Programmed-at range filter (only if programmedAt exists)
      if (tag.programmedAt) {
        const ts = tag.programmedAt.getTime();
        if (ts < startMs || ts > endMs) return false;
      }
      if (showUntappedOnly) {
        if (tag.lastScannedAt && tag.lastScannedAt.getTime() > untappedThreshold) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${tag.payload?.stockNumber ?? ''} ${tag.payload?.vin ?? ''} ${tag.id ?? ''} ${tag.tagSerialNumber ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tags, startDate, endDate, showUntappedOnly, untappedDays, search]);

  // KPIs (over all tags, not filtered)
  const kpis = useMemo(() => {
    const total = tags.length;
    const monthStart = startOfMonth(today).getTime();
    const programmedThisMonth = tags.filter(
      (t) => t.programmedAt && t.programmedAt.getTime() >= monthStart,
    ).length;
    const untappedThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const untapped7d = tags.filter(
      (t) => !t.lastScannedAt || t.lastScannedAt.getTime() < untappedThreshold,
    ).length;
    return { total, programmedThisMonth, untapped7d };
  }, [tags, today]);

  // Build display rows
  const rows: NfcRow[] = useMemo(() => {
    return filtered.map((t) => ({
      ...t,
      stockNumberDisplay: t.payload?.stockNumber ?? t.vehicleId ?? '—',
      vinDisplay: t.payload?.vin ?? '—',
      programmedAtDisplay: formatDate(t.programmedAt),
      lastTappedAtDisplay: formatDate(t.lastScannedAt),
      daysSinceTap: daysSince(t.lastScannedAt),
    }));
  }, [filtered]);

  // Columns
  const columns: ColumnDef<NfcRow>[] = useMemo(
    () => [
      {
        accessorKey: 'stockNumberDisplay',
        header: 'Stock #',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-[var(--rally-gold)]">
            {row.original.stockNumberDisplay}
          </span>
        ),
      },
      {
        accessorKey: 'vinDisplay',
        header: 'VIN',
        cell: ({ row }) => {
          const vin = row.original.vinDisplay;
          if (vin === '—') return <span className="text-[var(--text-tertiary)]">—</span>;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/inventory/${vin}`);
              }}
              className="font-mono text-xs text-[var(--text-primary)] hover:text-[var(--rally-gold)] cursor-pointer transition-colors"
            >
              {vin}
            </button>
          );
        },
      },
      {
        accessorFn: (row) => row.tagSerialNumber ?? row.id ?? '',
        id: 'tagId',
        header: 'Tag ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            {row.original.tagSerialNumber ?? row.original.id ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'programmedAtDisplay',
        header: 'Programmed',
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {row.original.programmedAtDisplay}
          </span>
        ),
      },
      {
        accessorKey: 'programmedBy',
        header: 'By',
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {row.original.programmedBy ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'lastTappedAtDisplay',
        header: 'Last Tapped',
        cell: ({ row }) => {
          const days = row.original.daysSinceTap;
          if (days === null) {
            return (
              <span className="text-[var(--status-warning)] text-xs">Never</span>
            );
          }
          const tone =
            days > 30
              ? 'text-[var(--status-error)]'
              : days > 7
                ? 'text-[var(--status-warning)]'
                : 'text-[var(--text-secondary)]';
          return (
            <span className={tone}>
              {row.original.lastTappedAtDisplay} ({days}d ago)
            </span>
          );
        },
      },
      {
        accessorKey: 'scanCount',
        header: 'Taps',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-[var(--text-primary)]">
            {row.original.scanCount}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status;
          const variant: 'success' | 'warning' | 'error' | 'default' =
            s === 'active'
              ? 'success'
              : s === 'damaged' || s === 'lost'
                ? 'error'
                : s === 'deactivated'
                  ? 'warning'
                  : 'default';
          return (
            <Badge variant={variant} size="sm">
              {NFC_TAG_STATUS_DISPLAY[s]}
            </Badge>
          );
        },
      },
    ],
    [router],
  );

  const handleExport = () => {
    // TODO export wired in reports agent
    console.info('[NFC] CSV export queued', filtered.length);
  };

  if (!activeStore) {
    return <NfcSkeleton />;
  }

  if (loading) {
    return <NfcSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="rounded-full bg-[var(--status-error)]/15 p-4">
          <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Failed to load NFC tags
        </p>
        <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">NFC Tags</h1>
          <Badge variant="default" size="sm">
            {filtered.length} of {kpis.total}
          </Badge>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Total Tags" value={kpis.total} hint="All status types" tone="gold" />
        <KpiCard
          label="Programmed This Month"
          value={kpis.programmedThisMonth}
          hint={`Since ${formatDate(startOfMonth(today))}`}
          tone="success"
        />
        <KpiCard
          label="Untapped > 7 days"
          value={kpis.untapped7d}
          hint="Includes never-tapped tags"
          tone={kpis.untapped7d > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Filters
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="Search stock #, VIN, or tag ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startIcon={<Search className="h-4 w-4" />}
              />
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => {
                  setStartDate(s);
                  setEndDate(e);
                }}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUntappedOnly}
                  onChange={(e) => setShowUntappedOnly(e.target.checked)}
                  className="accent-[var(--rally-gold)]"
                />
                <span className="text-xs text-[var(--text-primary)]">
                  Untapped only
                </span>
              </label>
              {showUntappedOnly && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">
                    No taps in
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={untappedDays}
                    onChange={(e) =>
                      setUntappedDays(
                        Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                      )
                    }
                    className="w-16 h-8 rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-2 text-xs text-[var(--text-primary)] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)]"
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">days</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 ml-auto text-xs text-[var(--text-tertiary)]">
                <Calendar className="h-3.5 w-3.5" />
                <span>Programmed-at filter applies to dated rows only</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table or empty */}
      {tags.length === 0 ? (
        <EmptyState
          icon={Nfc}
          title="No NFC tags yet"
          description="Tags appear here once your team programs them via the iOS app."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyIcon={Nfc}
          emptyMessage="No tags match these filters"
          emptyDescription="Try widening the date range or clearing the untapped filter."
          defaultPageSize={25}
        />
      )}

      {/* Healthy banner */}
      {tags.length > 0 && kpis.untapped7d === 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--status-success)]">
          <CheckCircle2 className="h-4 w-4" />
          All tags have been tapped within the last week.
        </div>
      )}
    </div>
  );
}
