'use client';

import { forwardRef, useCallback, type HTMLAttributes } from 'react';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangePickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** ISO date string (YYYY-MM-DD) for the start of the range */
  startDate: string;
  /** ISO date string (YYYY-MM-DD) for the end of the range */
  endDate: string;
  /** Called when either date changes */
  onChange: (startDate: string, endDate: string) => void;
}

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------

interface DatePreset {
  label: string;
  getRange: () => [start: string, end: string];
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

const PRESETS: DatePreset[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = toISODate(new Date());
      return [today, today];
    },
  },
  {
    label: 'Last 7 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return [toISODate(start), toISODate(end)];
    },
  },
  {
    label: 'Last 30 Days',
    getRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      return [toISODate(start), toISODate(end)];
    },
  },
  {
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [toISODate(start), toISODate(now)];
    },
  },
  {
    label: 'Last Month',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return [toISODate(start), toISODate(end)];
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Shared Input Style
// ---------------------------------------------------------------------------

const INPUT_CLASSES = cn(
  'flex h-10 w-full rounded-rally',
  'bg-surface-overlay border border-surface-border',
  'px-3 py-2 text-sm text-text-primary',
  'transition-colors duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
  // Ensure the date picker icon is visible on dark backgrounds
  '[color-scheme:dark]',
);

// ---------------------------------------------------------------------------
// DateRangePicker Component
// ---------------------------------------------------------------------------

/**
 * DateRangePicker — simple date range selector for reports filtering.
 *
 * Two native date inputs with preset quick-select buttons.
 * Dark themed to match the Rally Input component style.
 */
const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ className, startDate, endDate, onChange, ...props }, ref) => {
    const handlePreset = useCallback(
      (preset: DatePreset) => {
        const [start, end] = preset.getRange();
        onChange(start, end);
      },
      [onChange],
    );

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-3', className)}
        {...props}
      >
        {/* Date Inputs */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Start Date */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="date-range-start"
              className="text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Start Date
            </label>
            <input
              id="date-range-start"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => onChange(e.target.value, endDate)}
              className={INPUT_CLASSES}
            />
          </div>

          {/* Separator */}
          <span className="hidden sm:flex h-10 items-center text-text-tertiary">
            &mdash;
          </span>

          {/* End Date */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="date-range-end"
              className="text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              End Date
            </label>
            <input
              id="date-range-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => onChange(startDate, e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset)}
              className={cn(
                'inline-flex items-center justify-center',
                'h-8 px-3 text-xs font-medium',
                'rounded-rally',
                'bg-transparent text-text-secondary',
                'border border-surface-border',
                'hover:text-text-primary hover:bg-surface-overlay hover:border-surface-borderHover',
                'active:bg-surface-border',
                'transition-colors duration-150',
                'select-none cursor-pointer',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
);

DateRangePicker.displayName = 'DateRangePicker';

export { DateRangePicker };
