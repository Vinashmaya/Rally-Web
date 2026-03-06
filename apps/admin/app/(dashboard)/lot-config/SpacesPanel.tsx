'use client';

import { Search, Trash2, Filter } from 'lucide-react';
import { Badge } from '@rally/ui';
import { useLotConfigStore } from '@rally/services';
import {
  SPACE_TYPE_COLORS,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_VALUES,
  type SpaceType,
} from '@rally/firebase';

export default function SpacesPanel() {
  const config = useLotConfigStore((s) => s.config);
  const selectedSpaceIds = useLotConfigStore((s) => s.selectedSpaceIds);
  const searchQuery = useLotConfigStore((s) => s.searchQuery);
  const spaceTypeFilter = useLotConfigStore((s) => s.spaceTypeFilter);
  const setSearchQuery = useLotConfigStore((s) => s.setSearchQuery);
  const setSpaceTypeFilter = useLotConfigStore((s) => s.setSpaceTypeFilter);
  const selectSpace = useLotConfigStore((s) => s.selectSpace);
  const deleteSpaces = useLotConfigStore((s) => s.deleteSpaces);

  const spaces = config?.spaces ?? [];

  // Filter spaces by search query and type filter
  const filteredSpaces = spaces.filter((space) => {
    const matchesSearch =
      !searchQuery || space.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      spaceTypeFilter === 'all' || space.type === spaceTypeFilter;
    return matchesSearch && matchesType;
  });

  const selectionCount = selectedSpaceIds.size;

  function handleBulkDelete() {
    const ids = Array.from(selectedSpaceIds);
    if (ids.length === 0) return;
    deleteSpaces(ids);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search spaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none"
        />
      </div>

      {/* Type filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <select
          value={spaceTypeFilter}
          onChange={(e) => setSpaceTypeFilter(e.target.value as SpaceType | 'all')}
          className="w-full pl-9 px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none appearance-none cursor-pointer"
        >
          <option value="all">All Types</option>
          {SPACE_TYPE_VALUES.map((type) => (
            <option key={type} value={type}>
              {SPACE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Selection actions */}
      {selectionCount > 1 && (
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-surface-overlay border border-surface-border">
          <span className="text-xs text-text-secondary">
            {selectionCount} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-status-error/15 text-status-error text-xs font-medium hover:bg-status-error/25 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}

      {/* Space list */}
      <div className="overflow-y-auto max-h-[calc(100vh-24rem)] -mx-1 px-1">
        {filteredSpaces.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-text-tertiary">
              {spaces.length === 0
                ? 'No spaces yet. Use the Draw tool or Grid Generator to create spaces.'
                : 'No spaces match your filters.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredSpaces.map((space) => {
              const isSelected = selectedSpaceIds.has(space.id);
              const typeColor = SPACE_TYPE_COLORS[space.type];

              return (
                <button
                  key={space.id}
                  onClick={(e) => selectSpace(space.id, e.shiftKey)}
                  className={`
                    flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors
                    ${
                      isSelected
                        ? 'bg-rally-gold/10 border border-rally-gold'
                        : 'bg-surface-overlay border border-transparent hover:border-surface-border'
                    }
                  `}
                >
                  {/* Type color dot */}
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: typeColor }}
                  />

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-text-primary truncate">
                      {space.name}
                    </span>
                  </div>

                  <Badge size="sm" variant="default">
                    {SPACE_TYPE_LABELS[space.type]}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
