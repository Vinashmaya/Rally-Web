'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { Loader2, Grid3X3 } from 'lucide-react';
import { useLotConfigStore, DealerNameGenerator } from '@rally/services';
import type { LotSpace, SpaceType } from '@rally/firebase';
import { authFetch } from '@rally/firebase';
import LotConfigMap from './LotConfigMap';
import EditorToolbar from './EditorToolbar';
import EditorSidebar from './EditorSidebar';

// ---------------------------------------------------------------------------
// Store Selector (fetches groups → stores from admin API)
// ---------------------------------------------------------------------------

interface StoreOption {
  groupId: string;
  groupName: string;
  storeId: string;
  storeName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LotConfigEditor() {
  const config = useLotConfigStore((s) => s.config);
  const isLoading = useLotConfigStore((s) => s.isLoading);
  const editorMode = useLotConfigStore((s) => s.editorMode);
  const selectedSpaceIds = useLotConfigStore((s) => s.selectedSpaceIds);
  const hoveredSpaceId = useLotConfigStore((s) => s.hoveredSpaceId);
  const drawingVertices = useLotConfigStore((s) => s.drawingVertices);
  const showLabels = useLotConfigStore((s) => s.showLabels);
  const loadConfigs = useLotConfigStore((s) => s.loadConfigs);
  const loadConfig = useLotConfigStore((s) => s.loadConfig);
  const createNewConfig = useLotConfigStore((s) => s.createNewConfig);
  const setEditorMode = useLotConfigStore((s) => s.setEditorMode);
  const selectSpace = useLotConfigStore((s) => s.selectSpace);
  const deselectAll = useLotConfigStore((s) => s.deselectAll);
  const selectAll = useLotConfigStore((s) => s.selectAll);
  const addDrawingVertex = useLotConfigStore((s) => s.addDrawingVertex);
  const finishDrawing = useLotConfigStore((s) => s.finishDrawing);
  const cancelDrawing = useLotConfigStore((s) => s.cancelDrawing);
  const deleteSpaces = useLotConfigStore((s) => s.deleteSpaces);
  const undo = useLotConfigStore((s) => s.undo);
  const redo = useLotConfigStore((s) => s.redo);
  const saveConfig = useLotConfigStore((s) => s.saveConfig);
  const isDirty = useLotConfigStore((s) => s.isDirty);
  const setHoveredSpaceId = useLotConfigStore((s) => s.setHoveredSpaceId);
  const availableConfigs = useLotConfigStore((s) => s.availableConfigs);
  const selectedConfigId = useLotConfigStore((s) => s.selectedConfigId);
  const selectedGroupId = useLotConfigStore((s) => s.selectedGroupId);
  const selectedStoreId = useLotConfigStore((s) => s.selectedStoreId);

  // Store selection (local state — not in Zustand because it's fetch-dependent)
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [drawNameCounter, setDrawNameCounter] = useState(0);

  // Load stores on mount
  useEffect(() => {
    async function loadStores() {
      try {
        const res = await authFetch('/api/admin/tenants');
        if (!res.ok) throw new Error('Failed to load tenants');
        const json = await res.json();
        const groups = json.data ?? json.tenants ?? [];

        const storeList: StoreOption[] = [];
        for (const group of groups) {
          try {
            const storesRes = await authFetch(`/api/admin/lot-config/stores?groupId=${group.id}`);
            if (storesRes.ok) {
              const { stores: groupStores } = await storesRes.json();
              for (const store of groupStores ?? []) {
                storeList.push({
                  groupId: group.id,
                  groupName: group.name ?? group.id,
                  storeId: store.id,
                  storeName: store.name ?? store.id,
                });
              }
            }
          } catch {
            storeList.push({
              groupId: group.id,
              groupName: group.name ?? group.id,
              storeId: group.id,
              storeName: group.name ?? group.id,
            });
          }
        }
        setStores(storeList);

        if (storeList.length > 0) {
          const first = storeList[0]!;
          setSelectedStore(first);
          loadConfigs(first.groupId, first.storeId);
        }
      } catch (err) {
        console.error('Failed to load stores:', err);
      } finally {
        setStoresLoading(false);
      }
    }
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle store selection change
  const handleStoreChange = useCallback(
    (value: string) => {
      const store = stores.find((s) => `${s.groupId}::${s.storeId}` === value);
      if (store) {
        setSelectedStore(store);
        loadConfigs(store.groupId, store.storeId);
      }
    },
    [stores, loadConfigs],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      // Mode shortcuts
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) { setEditorMode('select'); return; }
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) { setEditorMode('draw'); return; }
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey) { setEditorMode('edit'); return; }
      if (e.key === 'p' && !e.ctrlKey && !e.metaKey) { setEditorMode('pan'); return; }

      // Escape — cancel drawing or deselect
      if (e.key === 'Escape') {
        if (editorMode === 'draw' && drawingVertices.length > 0) {
          cancelDrawing();
        } else {
          deselectAll();
        }
        return;
      }

      // Delete / Backspace — delete selected spaces
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpaceIds.size > 0) {
        deleteSpaces([...selectedSpaceIds]);
        return;
      }

      // Ctrl+Z / Cmd+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+S / Cmd+S — save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveConfig();
        return;
      }

      // Ctrl+A / Cmd+A — select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editorMode, drawingVertices.length, selectedSpaceIds, setEditorMode, cancelDrawing, deselectAll, deleteSpaces, undo, redo, saveConfig, selectAll]);

  // Unsaved changes guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Auto-save draft to localStorage every 30s when dirty
  useEffect(() => {
    if (!config || !isDirty) return;
    const timer = setTimeout(() => {
      try {
        const key = `lot-config-draft-${config.storeId}-${config.id ?? 'new'}`;
        localStorage.setItem(key, JSON.stringify({ config, savedAt: Date.now() }));
      } catch { /* localStorage full — ignore */ }
    }, 30000);
    return () => clearTimeout(timer);
  }, [config, isDirty]);

  // Map event handlers
  const handleSpaceClick = useCallback(
    (spaceId: string, additive: boolean) => {
      selectSpace(spaceId, additive);
    },
    [selectSpace],
  );

  const handleEmptyClick = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  const handleDrawVertex = useCallback(
    (lngLat: [number, number]) => {
      addDrawingVertex(lngLat);
    },
    [addDrawingVertex],
  );

  const handleDrawFinish = useCallback(() => {
    const name = DealerNameGenerator.generate(drawNameCounter, Math.floor(drawNameCounter / 10));
    setDrawNameCounter((c) => c + 1);
    finishDrawing(name);
  }, [drawNameCounter, finishDrawing]);

  const handleVertexDrag = useCallback(
    (spaceId: string, vertexIndex: number, lngLat: [number, number]) => {
      const store = useLotConfigStore.getState();
      const space = store.config?.spaces.find((s) => s.id === spaceId);
      if (!space) return;

      const newCoords = [...space.coordinates] as [number, number][];
      newCoords[vertexIndex] = lngLat;
      // Update closing vertex if dragging first vertex
      if (vertexIndex === 0 && newCoords.length > 1) {
        newCoords[newCoords.length - 1] = lngLat;
      }
      // Update first vertex if dragging closing vertex
      if (vertexIndex === newCoords.length - 1) {
        newCoords[0] = lngLat;
      }
      store.updateSpace(spaceId, { coordinates: newCoords });
    },
    [],
  );

  const handleMidpointClick = useCallback(
    (spaceId: string, vertexIndex: number, lngLat: [number, number]) => {
      const store = useLotConfigStore.getState();
      const space = store.config?.spaces.find((s) => s.id === spaceId);
      if (!space) return;

      const newCoords = [...space.coordinates] as [number, number][];
      // Insert after the vertex index (before the closing vertex)
      newCoords.splice(vertexIndex + 1, 0, lngLat);
      store.updateSpace(spaceId, { coordinates: newCoords });
    },
    [],
  );

  const handleSpaceHover = useCallback(
    (spaceId: string | null) => {
      setHoveredSpaceId(spaceId);
    },
    [setHoveredSpaceId],
  );

  // Loading state
  if (storesLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-rally-gold" />
          <span className="text-sm text-text-secondary">Loading stores...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Grid3X3 className="h-6 w-6 text-rally-gold" />
        <h1 className="text-2xl font-bold text-text-primary">Lot Configuration</h1>
        <div className="flex-1" />

        {/* Store selector */}
        <select
          value={selectedStore ? `${selectedStore.groupId}::${selectedStore.storeId}` : ''}
          onChange={(e) => handleStoreChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none min-w-[200px]"
        >
          <option value="">Select a store...</option>
          {stores.map((s) => (
            <option key={`${s.groupId}::${s.storeId}`} value={`${s.groupId}::${s.storeId}`}>
              {s.groupName} — {s.storeName}
            </option>
          ))}
        </select>

        {/* Config selector */}
        {availableConfigs.length > 0 && (
          <select
            value={selectedConfigId ?? ''}
            onChange={(e) => {
              if (e.target.value) loadConfig(e.target.value);
            }}
            className="px-3 py-1.5 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none min-w-[160px]"
          >
            <option value="">Select config...</option>
            {availableConfigs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* New config button */}
        <button
          onClick={() => createNewConfig('New Lot Config')}
          className="px-3 py-1.5 rounded-lg border border-dashed border-surface-border text-text-secondary text-sm hover:border-rally-gold hover:text-rally-gold transition-colors"
        >
          + New Config
        </button>
      </div>

      {/* Toolbar */}
      <EditorToolbar />

      {/* Main: Map + Sidebar */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Map — takes remaining space */}
        <div className="flex-1 relative min-w-0">
          {config ? (
            <LotConfigMap
              config={config}
              editorMode={editorMode}
              selectedSpaceIds={selectedSpaceIds}
              hoveredSpaceId={hoveredSpaceId}
              drawingVertices={drawingVertices}
              showLabels={showLabels}
              onSpaceClick={handleSpaceClick}
              onEmptyClick={handleEmptyClick}
              onDrawVertex={handleDrawVertex}
              onDrawFinish={handleDrawFinish}
              onVertexDrag={handleVertexDrag}
              onMidpointClick={handleMidpointClick}
              onSpaceHover={handleSpaceHover}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-surface-base border border-surface-border rounded-lg">
              <p className="text-text-tertiary text-sm">
                {isLoading ? 'Loading...' : 'Select a store and config, or create a new one'}
              </p>
            </div>
          )}

          {/* Mode indicator overlay */}
          {editorMode === 'draw' && (
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-black/80 border border-rally-gold/30 text-rally-gold text-xs font-medium">
              Click to add vertices · Double-click to finish · Escape to cancel
              {drawingVertices.length > 0 && (
                <span className="ml-2 text-text-secondary">({drawingVertices.length} vertices)</span>
              )}
            </div>
          )}

          {/* Space count overlay */}
          {config && config.spaces.length > 0 && (
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/80 border border-surface-border text-xs font-mono text-text-secondary">
              {config.spaces.length} spaces · {selectedSpaceIds.size} selected
            </div>
          )}
        </div>

        {/* Sidebar */}
        {config && <EditorSidebar />}
      </div>
    </div>
  );
}
