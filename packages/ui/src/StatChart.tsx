'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import { cn } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatChartDataPoint {
  value: number;
  label?: string;
}

export interface StatChartProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Data points for the sparkline */
  data: StatChartDataPoint[];
  /** Chart accent color — defaults to rally gold #D4A017 */
  color?: string;
  /** Chart height in pixels — defaults to 48 */
  height?: number;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface StatChartTooltipPayload {
  value?: number;
  payload?: StatChartDataPoint;
}

interface StatChartTooltipProps {
  active?: boolean;
  payload?: StatChartTooltipPayload[];
  color: string;
}

function StatChartTooltip({ active, payload, color }: StatChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  if (!point) return null;

  return (
    <div className="rounded-rally bg-surface-overlay border border-surface-border px-2.5 py-1.5 shadow-lg">
      {point.payload?.label && (
        <p className="text-[10px] text-text-tertiary mb-0.5">{point.payload.label}</p>
      )}
      <p className="text-xs font-medium" style={{ color }}>
        {point.value?.toLocaleString()}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatChart Component
// ---------------------------------------------------------------------------

/**
 * StatChart — sparkline-style mini area chart for dashboard KPI cards.
 *
 * Uses Recharts AreaChart with a gold gradient fill.
 * Transparent background, no axis labels. Designed for stat cards.
 */
const StatChart = forwardRef<HTMLDivElement, StatChartProps>(
  ({ className, data, color = '#D4A017', height = 48, ...props }, ref) => {
    // Unique gradient ID so multiple charts on the same page don't collide
    const gradientId = `stat-chart-gradient-${color.replace('#', '')}`;

    return (
      <div
        ref={ref}
        className={cn('w-full', className)}
        style={{ height }}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              content={<StatChartTooltip color={color} />}
              cursor={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 3,
                fill: color,
                stroke: 'var(--surface-raised)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

StatChart.displayName = 'StatChart';

export { StatChart };
