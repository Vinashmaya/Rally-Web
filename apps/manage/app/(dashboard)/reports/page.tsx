'use client';

import { useState, useMemo } from 'react';
import {
  Car,
  Activity,
  TrendingUp,
  Users,
  AlertTriangle,
  Shield,
  Calendar,
  Download,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Button,
  Badge,
  Skeleton,
} from '@rally/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

// ---------------------------------------------------------------------------
// Report templates
// ---------------------------------------------------------------------------

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'inventory-summary',
    title: 'Inventory Summary',
    description: 'Vehicle inventory snapshot with status distribution and aging analysis',
    icon: Car,
  },
  {
    id: 'activity-report',
    title: 'Activity Report',
    description: 'Complete activity log including test drives, showings, and movements',
    icon: Activity,
  },
  {
    id: 'sales-performance',
    title: 'Sales Performance',
    description: 'Sales metrics with per-salesperson performance data',
    icon: TrendingUp,
  },
  {
    id: 'staff-report',
    title: 'Staff Report',
    description: 'Staff utilization and engagement metrics',
    icon: Users,
  },
  {
    id: 'aging-alert',
    title: 'Aging Alert',
    description: 'Stale inventory requiring attention or price adjustment',
    icon: AlertTriangle,
  },
  {
    id: 'hold-report',
    title: 'Hold Report',
    description: 'Vehicle hold status, customer deposits, and expiration tracking',
    icon: Shield,
  },
] as const;

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

type DatePreset = 'today' | 'this-week' | 'this-month' | 'last-30';

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  const today = new Date();
  const end = formatDate(today);

  switch (preset) {
    case 'today':
      return { start: end, end };

    case 'this-week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      return { start: formatDate(weekStart), end };
    }

    case 'this-month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(monthStart), end };
    }

    case 'last-30': {
      const thirtyAgo = new Date(today);
      thirtyAgo.setDate(today.getDate() - 30);
      return { start: formatDate(thirtyAgo), end };
    }
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

// ---------------------------------------------------------------------------
// DateRangeSelector
// ---------------------------------------------------------------------------

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onPreset: (preset: DatePreset) => void;
}

const PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this-week' },
  { label: 'This Month', value: 'this-month' },
  { label: 'Last 30 Days', value: 'last-30' },
] as const;

function DateRangeSelector({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onPreset,
}: DateRangeSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Date Range
          </h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Date inputs */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label
                htmlFor="report-start-date"
                className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]"
              >
                Start
              </label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => onStartChange(e.target.value)}
                className="flex h-10 w-full rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] [color-scheme:dark]"
              />
            </div>
            <span className="text-[var(--text-tertiary)] mt-6">to</span>
            <div className="flex flex-col gap-1.5 flex-1">
              <label
                htmlFor="report-end-date"
                className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]"
              >
                End
              </label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => onEndChange(e.target.value)}
                className="flex h-10 w-full rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)] [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant="ghost"
                size="sm"
                onClick={() => onPreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReportCard
// ---------------------------------------------------------------------------

interface ReportCardProps {
  template: ReportTemplate;
  dateRange: string;
}

function ReportCard({ template, dateRange }: ReportCardProps) {
  const Icon = template.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-rally-lg bg-[var(--surface-overlay)] shrink-0">
            <Icon className="h-5 w-5 text-[var(--rally-gold)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {template.title}
            </h3>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {template.description}
        </p>
        <div className="mt-3">
          <Badge variant="default" size="sm">
            {dateRange}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        <Button variant="secondary" size="sm" disabled className="w-full">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReportsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton variant="text" className="h-8 w-32" />
      <Skeleton variant="card" className="h-40" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-48" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const defaultRange = getPresetRange('last-30');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  const handlePreset = (preset: DatePreset) => {
    const range = getPresetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const dateRangeDisplay = useMemo(() => {
    if (!startDate || !endDate) return 'Select a date range';
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
  }, [startDate, endDate]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Generate and export dealership reports
        </p>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onPreset={handlePreset}
      />

      {/* Report Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TEMPLATES.map((template) => (
          <ReportCard
            key={template.id}
            template={template}
            dateRange={dateRangeDisplay}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-[var(--text-tertiary)] text-center pt-2">
        Report exports will be available in a future update.
      </p>
    </div>
  );
}
