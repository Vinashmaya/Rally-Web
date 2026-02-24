'use client';

import {
  forwardRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './utils';
import { Skeleton } from './Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataTableProps<T> extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Column definitions from @tanstack/react-table */
  columns: ColumnDef<T, unknown>[];
  /** Row data */
  data: T[];
  /** Global filter string for search */
  globalFilter?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Whether data is loading — shows skeleton rows */
  loading?: boolean;
  /** Number of skeleton rows to show while loading */
  skeletonRowCount?: number;
  /** Empty state icon */
  emptyIcon?: LucideIcon;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state action slot */
  emptyAction?: ReactNode;
  /** Page sizes available in the selector */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
}

// ---------------------------------------------------------------------------
// Page Size Selector
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS_DEFAULT = [10, 25, 50, 100] as const;

// ---------------------------------------------------------------------------
// DataTable Component
// ---------------------------------------------------------------------------

function DataTableInner<T>(
  {
    className,
    columns,
    data,
    globalFilter,
    onRowClick,
    loading = false,
    skeletonRowCount = 5,
    emptyIcon: EmptyIcon,
    emptyMessage = 'No data found',
    emptyDescription,
    emptyAction,
    pageSizeOptions = [...PAGE_SIZE_OPTIONS_DEFAULT],
    defaultPageSize = 10,
    ...props
  }: DataTableProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable<T>({
    data,
    columns,
    state: {
      sorting,
      globalFilter: globalFilter ?? '',
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const startRow = pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // ── Loading State ────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-rally-lg bg-surface-raised border border-surface-border overflow-hidden',
          className,
        )}
        {...props}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-rally-gold"
                  >
                    <Skeleton variant="text" className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-surface-border last:border-b-0"
                >
                  {columns.map((_, colIdx) => (
                    <td key={colIdx} className="px-4 py-3">
                      <Skeleton variant="text" className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Empty State ──────────────────────────────────────────────────
  if (rows.length === 0 && !loading) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-rally-lg bg-surface-raised border border-surface-border overflow-hidden',
          className,
        )}
        {...props}
      >
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {EmptyIcon && (
            <div className="mb-4 rounded-full bg-surface-overlay p-4">
              <EmptyIcon className="h-8 w-8 text-text-tertiary" strokeWidth={1.5} />
            </div>
          )}
          <h3 className="text-lg font-semibold text-text-primary mb-1">
            {emptyMessage}
          </h3>
          {emptyDescription && (
            <p className="text-sm text-text-secondary max-w-sm mb-6">
              {emptyDescription}
            </p>
          )}
          {emptyAction && <div>{emptyAction}</div>}
        </div>
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-rally-lg bg-surface-raised border border-surface-border overflow-hidden',
        className,
      )}
      {...props}
    >
      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-surface-border"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-rally-gold',
                        canSort && 'cursor-pointer select-none hover:text-rally-goldLight transition-colors',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {canSort && (
                          <span className="inline-flex flex-col">
                            {sorted === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5 text-rally-gold" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="h-3.5 w-3.5 text-rally-gold" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 text-text-tertiary" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-surface-border last:border-b-0',
                  'transition-colors duration-150',
                  'hover:bg-surface-overlay',
                  onRowClick && 'cursor-pointer',
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm text-text-secondary"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surface-border px-4 py-3">
          {/* Left: row count */}
          <p className="text-xs text-text-tertiary">
            Showing {startRow}&ndash;{endRow} of {totalRows}
          </p>

          {/* Center: page size selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="data-table-page-size"
              className="text-xs text-text-tertiary"
            >
              Rows
            </label>
            <select
              id="data-table-page-size"
              className={cn(
                'h-8 rounded-rally bg-surface-overlay border border-surface-border',
                'px-2 text-xs text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold',
              )}
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Right: prev/next */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-rally',
                'text-text-secondary transition-colors',
                'hover:bg-surface-overlay hover:text-text-primary',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs text-text-secondary px-2">
              {pageIndex + 1} / {pageCount || 1}
            </span>

            <button
              type="button"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-rally',
                'text-text-secondary transition-colors',
                'hover:bg-surface-overlay hover:text-text-primary',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForwardRef wrapper — preserves generic type parameter
// ---------------------------------------------------------------------------

/**
 * DataTable — typed TanStack Table wrapper for the Rally design system.
 *
 * Dark themed with gold headers, sortable columns, pagination,
 * loading skeletons, and empty state.
 */
const DataTable = forwardRef(DataTableInner) as <T>(
  props: DataTableProps<T> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement | null;

(DataTable as { displayName?: string }).displayName = 'DataTable';

export { DataTable };
