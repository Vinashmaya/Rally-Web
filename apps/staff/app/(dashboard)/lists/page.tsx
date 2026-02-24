'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Plus, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  Skeleton,
  EmptyState,
  ListCard,
  FilterBar,
  Badge,
  type FilterOption,
} from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import { useVehicleLists, AVAILABLE_COLORS, type VehicleList } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#22C55E',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  teal: '#14B8A6',
  indigo: '#6366F1',
} as const;

// ---------------------------------------------------------------------------
// Lucide icon names to use (web equivalent of SF Symbols)
// ---------------------------------------------------------------------------

const ICON_OPTIONS = [
  { value: 'list.bullet', label: 'List' },
  { value: 'flame.fill', label: 'Flame' },
  { value: 'star.fill', label: 'Star' },
  { value: 'heart.fill', label: 'Heart' },
  { value: 'tag.fill', label: 'Tag' },
  { value: 'clock.fill', label: 'Clock' },
  { value: 'bolt.fill', label: 'Bolt' },
  { value: 'flag.fill', label: 'Flag' },
] as const;

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const LIST_FILTER_OPTIONS: FilterOption[] = [
  { value: 'mine', label: 'My Lists' },
  { value: 'shared', label: 'Shared With Me' },
] as const;

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ListsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-20" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create list form
// ---------------------------------------------------------------------------

interface CreateListFormProps {
  onClose: () => void;
}

function CreateListForm({ onClose }: CreateListFormProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    // TODO: Wire up Firestore write via @rally/firebase service
    // For now, close the form
    onClose();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">New List</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-rally)] p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="List Name"
            placeholder="e.g., Hot Leads, Weekend Specials"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          {/* Color picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Color
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 w-8 rounded-full transition-all duration-150 cursor-pointer ${
                    selectedColor === color
                      ? 'ring-2 ring-[var(--rally-gold)] ring-offset-2 ring-offset-[var(--surface-base)] scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: COLOR_MAP[color] ?? 'var(--rally-gold)' }}
                  aria-label={color}
                  aria-pressed={selectedColor === color}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!name.trim()}
            >
              Create List
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ListsPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const [filter, setFilter] = useState('mine');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

  const dealershipId = activeStore?.id ?? '';
  const userId = firebaseUser?.uid ?? '';

  const { lists, loading, error } = useVehicleLists({
    dealershipId,
    userId,
  });

  // Split lists by ownership
  const myLists = useMemo(
    () => lists.filter((l) => l.ownerId === userId),
    [lists, userId]
  );

  const sharedLists = useMemo(
    () => lists.filter((l) => l.ownerId !== userId),
    [lists, userId]
  );

  const displayedLists = filter === 'mine' ? myLists : sharedLists;

  const filterOptionsWithCounts = useMemo((): FilterOption[] => {
    return [
      { value: 'mine', label: 'My Lists', count: myLists.length },
      { value: 'shared', label: 'Shared With Me', count: sharedLists.length },
    ];
  }, [myLists.length, sharedLists.length]);

  const handleListClick = useCallback(
    (listId: string | undefined) => {
      if (!listId) return;
      setExpandedListId((prev) => (prev === listId ? null : listId));
    },
    []
  );

  // Waiting for tenant context
  if (!activeStore || !firebaseUser) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" className="h-8 w-48" />
        <ListsSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lists</h1>
          {!loading && (
            <Badge variant="default" size="sm">
              {lists.length} {lists.length === 1 ? 'list' : 'lists'}
            </Badge>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="h-4 w-4" />
          Create List
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateListForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Filter tabs */}
      <FilterBar
        options={filterOptionsWithCounts}
        selected={filter}
        onSelect={setFilter}
      />

      {/* List grid */}
      {loading ? (
        <ListsSkeleton />
      ) : error ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--status-error)]">
                Failed to load lists
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : displayedLists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={filter === 'mine' ? 'No lists yet' : 'No shared lists'}
          description={
            filter === 'mine'
              ? 'Create your first list to organize vehicles.'
              : 'Lists shared with you by teammates will appear here.'
          }
          action={
            filter === 'mine' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
                Create List
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedLists.map((list) => (
            <div key={list.id ?? list.name} className="flex flex-col gap-0">
              <ListCard
                name={list.name}
                vehicleCount={list.vehicleCount}
                color={COLOR_MAP[list.color] ?? 'var(--rally-gold)'}
                isShared={list.isShared}
                ownerName={list.ownerId !== userId ? list.ownerName : undefined}
                onPress={() => handleListClick(list.id)}
                onEdit={
                  list.ownerId === userId
                    ? () => {
                        // TODO: Open edit modal
                      }
                    : undefined
                }
              />

              {/* Expanded vehicle list */}
              {expandedListId === list.id && (
                <Card className="mt-1 border-t-0 rounded-t-none">
                  <CardContent>
                    {list.vehicleCount === 0 ? (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
                        No vehicles in this list yet.
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-4">
                        {list.vehicleCount} {list.vehicleCount === 1 ? 'vehicle' : 'vehicles'} &mdash; tap to view in inventory
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
