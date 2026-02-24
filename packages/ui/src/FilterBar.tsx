'use client';

import { forwardRef, type HTMLAttributes, useRef, useCallback } from 'react';
import { cn } from './utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  options: FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}

/**
 * FilterBar — horizontal scrollable filter chips.
 *
 * Selected: gold background muted, gold text, gold border.
 * Unselected: surface-overlay bg, secondary text, surface-border.
 * Horizontal scroll with hidden scrollbar.
 */
const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  ({ className, options, selected, onSelect, ...props }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleSelect = useCallback(
      (value: string) => {
        onSelect(value);
      },
      [onSelect]
    );

    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        <div
          ref={scrollRef}
          className={cn(
            'flex gap-2 overflow-x-auto',
            // Hide scrollbar across browsers
            'scrollbar-none',
            '[&::-webkit-scrollbar]:hidden',
            '[-ms-overflow-style:none]',
            '[scrollbar-width:none]',
            // Scroll padding for edge chips
            'px-0.5 py-0.5'
          )}
          role="tablist"
          aria-label="Filter options"
        >
          {options.map((option) => {
            const isSelected = option.value === selected;

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 shrink-0',
                  'rounded-full px-3 py-1.5',
                  'text-sm font-medium whitespace-nowrap',
                  'transition-all duration-150 cursor-pointer',
                  'border',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
                  isSelected
                    ? 'bg-rally-goldMuted text-rally-gold border-rally-gold/30'
                    : 'bg-surface-overlay text-text-secondary border-surface-border hover:text-text-primary hover:border-surface-borderHover'
                )}
              >
                {option.label}
                {option.count != null && (
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      isSelected ? 'text-rally-gold/70' : 'text-text-tertiary'
                    )}
                  >
                    {option.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

FilterBar.displayName = 'FilterBar';

export { FilterBar };
