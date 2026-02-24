// ── Design Tokens ─────────────────────────────────────────────────
export { colors, spacing, radii, typography } from './tokens';
export type { RallyColor, RallySpacing, RallyRadii, RallyTypography } from './tokens';

// ── Utilities ─────────────────────────────────────────────────────
export { cn } from './utils';

// ── Primitives ────────────────────────────────────────────────────
export { Button, buttonVariants } from './Button';
export type { ButtonProps } from './Button';

export { Card, CardHeader, CardContent, CardFooter, cardVariants } from './Card';
export type { CardProps, CardHeaderProps, CardContentProps, CardFooterProps } from './Card';

export { Badge, badgeVariants } from './Badge';
export type { BadgeProps } from './Badge';

export { Input } from './Input';
export type { InputProps } from './Input';

export { StockHero } from './StockHero';
export type { StockHeroProps } from './StockHero';

export { Skeleton, skeletonVariants } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Avatar, avatarVariants } from './Avatar';
export type { AvatarProps } from './Avatar';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// ── Status & Activity ─────────────────────────────────────────────
export { StatusBadge, VEHICLE_STATUS_MAP } from './StatusBadge';
export type { StatusBadgeProps, VehicleStatus } from './StatusBadge';

export { ActivityBadge, ACTIVITY_MAP } from './ActivityBadge';
export type { ActivityBadgeProps, VehicleActivity } from './ActivityBadge';

// ── Toast System ──────────────────────────────────────────────────
export { ToastProvider, useToast } from './Toast';
export type { ToastType, ToastItem } from './Toast';

// ── Layout ────────────────────────────────────────────────────────
export { AppShell } from './AppShell';
export type { AppShellProps, TabItem } from './AppShell';

export { Sidebar } from './Sidebar';
export type { SidebarProps, NavItem, StoreInfo, UserInfo } from './Sidebar';

export { CommandPalette } from './CommandPalette';
export type { CommandPaletteProps, CommandItem } from './CommandPalette';

// ── Banners ───────────────────────────────────────────────────────
export { OfflineBanner } from './OfflineBanner';

// ── Sprint 2: Inventory & Activity ──────────────────────────────
export { VehicleCard } from './VehicleCard';
export type { VehicleCardProps } from './VehicleCard';

export { ActivityFeedItem } from './ActivityFeedItem';
export type { ActivityFeedItemProps } from './ActivityFeedItem';

export { ScanSheet } from './ScanSheet';
export type { ScanSheetProps, ScanMode } from './ScanSheet';

export { ListCard } from './ListCard';
export type { ListCardProps } from './ListCard';

export { FilterBar } from './FilterBar';
export type { FilterBarProps, FilterOption } from './FilterBar';

export { RelativeTime } from './RelativeTime';
export type { RelativeTimeProps } from './RelativeTime';

// ── Sprint 3: Management Console ────────────────────────────────
export { DataTable } from './DataTable';
export type { DataTableProps } from './DataTable';

// Re-export ColumnDef so apps don't need @tanstack/react-table directly
export type { ColumnDef } from '@tanstack/react-table';

export { StatChart } from './StatChart';
export type { StatChartProps, StatChartDataPoint } from './StatChart';

export { RallyBarChart } from './RallyBarChart';
export type { RallyBarChartProps, RallyBarChartBar } from './RallyBarChart';

export { DateRangePicker } from './DateRangePicker';
export type { DateRangePickerProps } from './DateRangePicker';
