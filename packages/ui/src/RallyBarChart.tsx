'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RallyBarChartBar {
  /** Key in the data record for this bar's values */
  dataKey: string;
  /** Bar fill color */
  color: string;
  /** Display label for the legend */
  label: string;
}

export interface RallyBarChartProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Data array — each record should have the xAxisKey and all bar dataKeys */
  data: Record<string, unknown>[];
  /** Bar definitions */
  bars: RallyBarChartBar[];
  /** Key in each data record to use for the X axis */
  xAxisKey: string;
  /** Chart height in pixels — defaults to 300 */
  height?: number;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface BarChartTooltipPayload {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface BarChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: BarChartTooltipPayload[];
}

function RallyBarChartTooltip({ active, label, payload }: BarChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-rally bg-surface-overlay border border-surface-border px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-rally-gold mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey ?? entry.name}
          className="flex items-center gap-2 text-xs text-text-secondary"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}</span>
          <span className="ml-auto font-mono text-text-primary">
            {entry.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RallyBarChart Component
// ---------------------------------------------------------------------------

/**
 * RallyBarChart — styled Recharts bar chart for analytics pages.
 *
 * Dark themed with custom bar colors, gold-accented tooltip,
 * responsive container, and bottom legend.
 */
const RallyBarChart = forwardRef<HTMLDivElement, RallyBarChartProps>(
  ({ className, data, bars, xAxisKey, height = 300, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('w-full', className)}
        style={{ height }}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--surface-border)"
              vertical={false}
            />
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--surface-border)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<RallyBarChartTooltip />} cursor={{ fill: 'var(--surface-overlay)', opacity: 0.5 }} />
            <Legend
              verticalAlign="bottom"
              height={32}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span className="text-xs text-text-secondary">{value}</span>
              )}
            />
            {bars.map((bar) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.label}
                fill={bar.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

RallyBarChart.displayName = 'RallyBarChart';

export { RallyBarChart };
