'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Search, type LucideIcon } from 'lucide-react';
import { cn } from './utils';
import { Badge } from './Badge';

// ── Types ─────────────────────────────────────────────────────────

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  category: string;
  onSelect: () => void;
}

export interface CommandPaletteProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the palette is open */
  open: boolean;
  /** Close callback */
  onClose: () => void;
  /** All available command items */
  items: CommandItem[];
  /** Placeholder text for search input */
  placeholder?: string;
  /** Optional header content */
  header?: ReactNode;
}

/**
 * CommandPalette — Cmd+K power user overlay.
 *
 * Dark overlay with centered modal.
 * Search input at top, results grouped by category.
 * Full keyboard navigation: arrows, Enter, Escape.
 * "No results" empty state.
 */
const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(
  (
    {
      className,
      open,
      onClose,
      items,
      placeholder = 'Search vehicles, customers, actions...',
      header,
      ...props
    },
    ref
  ) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter items by query
    const filtered = items.filter((item) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle?.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
      );
    });

    // Group by category
    const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category]!.push(item);
      return acc;
    }, {});

    // Flat list for keyboard navigation
    const flatList = Object.values(grouped).flat();

    // Reset state when opening
    useEffect(() => {
      if (open) {
        setQuery('');
        setActiveIndex(0);
        // Focus input on next tick
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    }, [open]);

    // Reset active index when results change
    useEffect(() => {
      setActiveIndex(0);
    }, [query]);

    // Scroll active item into view
    useEffect(() => {
      if (!listRef.current) return;
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      activeEl?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    // Global Cmd+K listener
    useEffect(() => {
      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (open) {
            onClose();
          }
        }
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % Math.max(flatList.length, 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + flatList.length) % Math.max(flatList.length, 1));
            break;
          case 'Enter': {
            e.preventDefault();
            const selected = flatList[activeIndex];
            if (selected) {
              selected.onSelect();
              onClose();
            }
            break;
          }
          case 'Escape':
            e.preventDefault();
            onClose();
            break;
        }
      },
      [flatList, activeIndex, onClose]
    );

    if (!open) return null;

    let flatIndex = -1;

    return (
      <div
        ref={ref}
        className={cn(
          'fixed inset-0 z-[100]',
          'flex items-start justify-center pt-[20vh]',
          'animate-rally-fade-in',
          className
        )}
        {...props}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className={cn(
            'relative w-full max-w-lg mx-4',
            'bg-surface-raised border border-surface-border',
            'rounded-rally-xl shadow-rally-lg',
            'overflow-hidden',
            'animate-rally-slide-up'
          )}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-surface-border">
            <Search className="h-5 w-5 text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                'flex-1 h-12 bg-transparent',
                'text-sm text-text-primary',
                'placeholder:text-text-disabled',
                'outline-none border-none'
              )}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="text-[10px] text-text-tertiary font-mono bg-surface-overlay px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>

          {/* Header (optional) */}
          {header && (
            <div className="px-4 py-2 border-b border-surface-border">
              {header}
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {flatList.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-text-tertiary">
                  {query ? 'No results found.' : 'Start typing to search...'}
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      {category}
                    </span>
                  </div>
                  {categoryItems.map((item) => {
                    flatIndex++;
                    const isActive = flatIndex === activeIndex;
                    const Icon = item.icon;
                    const currentIndex = flatIndex;

                    return (
                      <button
                        key={item.id}
                        data-active={isActive}
                        onClick={() => {
                          item.onSelect();
                          onClose();
                        }}
                        onMouseEnter={() => setActiveIndex(currentIndex)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2',
                          'text-sm transition-colors',
                          isActive
                            ? 'bg-surface-overlay text-text-primary'
                            : 'text-text-secondary hover:bg-surface-overlay'
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0 text-text-tertiary" />}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="block truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs text-text-tertiary truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        <Badge size="sm" variant="default">
                          {item.category}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-surface-border text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-surface-overlay px-1 py-0.5 rounded">&#8593;&#8595;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-surface-overlay px-1 py-0.5 rounded">&#8629;</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-surface-overlay px-1 py-0.5 rounded">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    );
  }
);

CommandPalette.displayName = 'CommandPalette';

export { CommandPalette };
