'use client';

// @rally/services — Lot Config Editor Zustand Store
// Manages all editor state for the polygon-based lot configurator (v2).
// Replaces ~25 useState calls in the old monolith page.tsx.

import { create } from 'zustand';
import type {
  LotGridConfig,
  LotSpace,
  LotImageOverlay,
  SpaceType,
} from '@rally/firebase';
import { authFetch } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Editor Modes
// ---------------------------------------------------------------------------

export type EditorMode = 'select' | 'draw' | 'edit' | 'pan';

// ---------------------------------------------------------------------------
// Sidebar Panels
// ---------------------------------------------------------------------------

export type SidebarPanel = 'spaces' | 'grids' | 'overlays' | 'import-export' | null;

// ---------------------------------------------------------------------------
// Config Summary — lightweight list item
// ---------------------------------------------------------------------------

export interface ConfigSummary {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// State Interface
// ---------------------------------------------------------------------------

const MAX_UNDO_STEPS = 50;

interface LotConfigState {
  // Config data
  config: LotGridConfig | null;
  savedConfig: LotGridConfig | null; // Last saved snapshot for dirty detection
  selectedStoreId: string | null;
  selectedGroupId: string | null;
  selectedConfigId: string | null;
  availableConfigs: ConfigSummary[];

  // Loading / saving
  isLoading: boolean;
  isSaving: boolean;

  // Editor mode
  editorMode: EditorMode;

  // Selection
  selectedSpaceIds: Set<string>;
  hoveredSpaceId: string | null;

  // Drawing
  drawingVertices: [number, number][];

  // Vertex editing
  editingVertexIndex: number | null;

  // UI
  activeSidebarPanel: SidebarPanel;
  collapsedSections: Set<string>;
  searchQuery: string;
  spaceTypeFilter: SpaceType | 'all';
  showLabels: boolean;
  showOccupancyColors: boolean;

  // Undo/redo
  undoStack: LotGridConfig[];
  redoStack: LotGridConfig[];

  // ── Computed ──
  isDirty: boolean;

  // ── Actions: Config lifecycle ──
  loadConfigs: (groupId: string, storeId: string) => Promise<void>;
  loadConfig: (configId: string) => Promise<void>;
  saveConfig: () => Promise<void>;
  setConfig: (config: LotGridConfig) => void;
  createNewConfig: (name: string) => void;

  // ── Actions: Undo/redo ──
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // ── Actions: Spaces ──
  addSpace: (space: LotSpace) => void;
  addSpaces: (spaces: LotSpace[]) => void;
  updateSpace: (id: string, partial: Partial<LotSpace>) => void;
  deleteSpaces: (ids: string[]) => void;

  // ── Actions: Editor mode ──
  setEditorMode: (mode: EditorMode) => void;

  // ── Actions: Selection ──
  selectSpace: (id: string, additive?: boolean) => void;
  selectSpaces: (ids: string[]) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // ── Actions: Drawing ──
  addDrawingVertex: (lngLat: [number, number]) => void;
  finishDrawing: (name: string, type?: SpaceType) => LotSpace | null;
  cancelDrawing: () => void;

  // ── Actions: Overlays ──
  addOverlay: (overlay: LotImageOverlay) => void;
  updateOverlay: (id: string, partial: Partial<LotImageOverlay>) => void;
  deleteOverlay: (id: string) => void;

  // ── Actions: UI ──
  setActiveSidebarPanel: (panel: SidebarPanel) => void;
  toggleSection: (sectionId: string) => void;
  setSearchQuery: (query: string) => void;
  setSpaceTypeFilter: (filter: SpaceType | 'all') => void;
  setShowLabels: (show: boolean) => void;
  setShowOccupancyColors: (show: boolean) => void;
  setHoveredSpaceId: (id: string | null) => void;

  // ── Actions: Store/config selection ──
  setSelectedStore: (groupId: string, storeId: string) => void;
}

// ---------------------------------------------------------------------------
// Deep clone helper (structuredClone is available in all modern browsers)
// ---------------------------------------------------------------------------

function cloneConfig(config: LotGridConfig): LotGridConfig {
  return structuredClone(config);
}

function configsAreEqual(a: LotGridConfig | null, b: LotGridConfig | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLotConfigStore = create<LotConfigState>((set, get) => ({
  // Initial state
  config: null,
  savedConfig: null,
  selectedStoreId: null,
  selectedGroupId: null,
  selectedConfigId: null,
  availableConfigs: [],
  isLoading: false,
  isSaving: false,
  editorMode: 'select',
  selectedSpaceIds: new Set<string>(),
  hoveredSpaceId: null,
  drawingVertices: [],
  editingVertexIndex: null,
  activeSidebarPanel: 'spaces',
  collapsedSections: new Set<string>(),
  searchQuery: '',
  spaceTypeFilter: 'all',
  showLabels: true,
  showOccupancyColors: false,
  undoStack: [],
  redoStack: [],
  isDirty: false,

  // ── Config lifecycle ──

  loadConfigs: async (groupId, storeId) => {
    set({ isLoading: true, selectedGroupId: groupId, selectedStoreId: storeId });
    try {
      const res = await authFetch(
        `/api/admin/lot-config?groupId=${groupId}&storeId=${storeId}`,
      );
      const data = await res.json();
      const configs: ConfigSummary[] = (data.configs ?? []).map(
        (c: { id: string; name: string }) => ({ id: c.id, name: c.name }),
      );
      set({ availableConfigs: configs, isLoading: false });

      // Auto-load first config if available
      if (configs.length > 0) {
        get().loadConfig(configs[0]!.id);
      }
    } catch (err) {
      console.error('[lotConfigStore] loadConfigs failed:', err);
      set({ isLoading: false });
    }
  },

  loadConfig: async (configId) => {
    const { selectedGroupId, selectedStoreId, availableConfigs } = get();
    if (!selectedGroupId || !selectedStoreId) return;

    set({ isLoading: true, selectedConfigId: configId });
    try {
      const res = await authFetch(
        `/api/admin/lot-config?groupId=${selectedGroupId}&storeId=${selectedStoreId}`,
      );
      const data = await res.json();
      const fullConfig = (data.configs ?? []).find(
        (c: { id: string }) => c.id === configId,
      );

      if (fullConfig) {
        // Ensure spaces array exists (backward compat with v1 configs)
        if (!fullConfig.spaces) fullConfig.spaces = [];
        const config = fullConfig as LotGridConfig;
        set({
          config,
          savedConfig: cloneConfig(config),
          isLoading: false,
          isDirty: false,
          selectedSpaceIds: new Set(),
          undoStack: [],
          redoStack: [],
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('[lotConfigStore] loadConfig failed:', err);
      set({ isLoading: false });
    }
  },

  saveConfig: async () => {
    const { config, selectedGroupId, selectedStoreId } = get();
    if (!config || !selectedGroupId || !selectedStoreId) return;

    set({ isSaving: true });
    try {
      const payload = {
        ...config,
        groupId: selectedGroupId,
        storeId: selectedStoreId,
      };
      const res = await authFetch('/api/admin/lot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // If it was a new config (no id), set the returned id
      if (data.id && !config.id) {
        set((s) => ({
          config: s.config ? { ...s.config, id: data.id } : null,
          selectedConfigId: data.id,
          availableConfigs: [
            ...s.availableConfigs,
            { id: data.id, name: config.name },
          ],
        }));
      }

      set((s) => ({
        savedConfig: s.config ? cloneConfig(s.config) : null,
        isDirty: false,
        isSaving: false,
      }));
    } catch (err) {
      console.error('[lotConfigStore] saveConfig failed:', err);
      set({ isSaving: false });
    }
  },

  setConfig: (config) => {
    set((s) => ({
      config,
      isDirty: !configsAreEqual(config, s.savedConfig),
    }));
  },

  createNewConfig: (name) => {
    const { selectedGroupId, selectedStoreId } = get();
    const newConfig: LotGridConfig = {
      storeId: selectedStoreId ?? '',
      groupId: selectedGroupId ?? '',
      name,
      center: { latitude: 36.36966, longitude: -86.48707 },
      zoom: 19,
      bearing: -43,
      grids: [],
      spaces: [],
      imageOverlays: [],
    };
    set({
      config: newConfig,
      savedConfig: null,
      selectedConfigId: null,
      isDirty: true,
      selectedSpaceIds: new Set(),
      undoStack: [],
      redoStack: [],
    });
  },

  // ── Undo/redo ──

  pushUndo: () => {
    const { config, undoStack } = get();
    if (!config) return;
    const newStack = [...undoStack, cloneConfig(config)];
    if (newStack.length > MAX_UNDO_STEPS) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { config, undoStack, redoStack, savedConfig } = get();
    if (undoStack.length === 0 || !config) return;
    const prev = undoStack[undoStack.length - 1]!;
    set({
      config: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneConfig(config)],
      isDirty: !configsAreEqual(prev, savedConfig),
    });
  },

  redo: () => {
    const { config, undoStack, redoStack, savedConfig } = get();
    if (redoStack.length === 0 || !config) return;
    const next = redoStack[redoStack.length - 1]!;
    set({
      config: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: config ? [...undoStack, cloneConfig(config)] : undoStack,
      isDirty: !configsAreEqual(next, savedConfig),
    });
  },

  // ── Spaces ──

  addSpace: (space) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = { ...config, spaces: [...config.spaces, space] };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  addSpaces: (spaces) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = { ...config, spaces: [...config.spaces, ...spaces] };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  updateSpace: (id, partial) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = {
      ...config,
      spaces: config.spaces.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  deleteSpaces: (ids) => {
    const { config, savedConfig, selectedSpaceIds } = get();
    if (!config) return;
    get().pushUndo();
    const idSet = new Set(ids);
    const updated = {
      ...config,
      spaces: config.spaces.filter((s) => !idSet.has(s.id)),
    };
    // Also remove deleted spaces from selection
    const newSelection = new Set(selectedSpaceIds);
    ids.forEach((id) => newSelection.delete(id));
    set({
      config: updated,
      selectedSpaceIds: newSelection,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  // ── Editor mode ──

  setEditorMode: (mode) => {
    set({
      editorMode: mode,
      drawingVertices: [],
      editingVertexIndex: null,
    });
  },

  // ── Selection ──

  selectSpace: (id, additive = false) => {
    set((s) => {
      const newSelection = additive ? new Set(s.selectedSpaceIds) : new Set<string>();
      if (newSelection.has(id) && additive) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return { selectedSpaceIds: newSelection };
    });
  },

  selectSpaces: (ids) => {
    set({ selectedSpaceIds: new Set(ids) });
  },

  deselectAll: () => {
    set({ selectedSpaceIds: new Set() });
  },

  selectAll: () => {
    const { config } = get();
    if (!config) return;
    set({ selectedSpaceIds: new Set(config.spaces.map((s) => s.id)) });
  },

  // ── Drawing ──

  addDrawingVertex: (lngLat) => {
    set((s) => ({ drawingVertices: [...s.drawingVertices, lngLat] }));
  },

  finishDrawing: (name, type = 'standard') => {
    const { drawingVertices, config } = get();
    if (drawingVertices.length < 3 || !config) {
      set({ drawingVertices: [] });
      return null;
    }

    // Close the polygon (first vertex === last vertex)
    const closed: [number, number][] = [
      ...drawingVertices,
      drawingVertices[0]!,
    ];

    const space: LotSpace = {
      id: `space-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      type,
      coordinates: closed,
      status: 'available',
    };

    get().addSpace(space);
    set({
      drawingVertices: [],
      selectedSpaceIds: new Set([space.id]),
      editorMode: 'select',
    });
    return space;
  },

  cancelDrawing: () => {
    set({ drawingVertices: [] });
  },

  // ── Overlays ──

  addOverlay: (overlay) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = { ...config, imageOverlays: [...config.imageOverlays, overlay] };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  updateOverlay: (id, partial) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = {
      ...config,
      imageOverlays: config.imageOverlays.map((o) =>
        o.id === id ? { ...o, ...partial } : o,
      ),
    };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  deleteOverlay: (id) => {
    const { config, savedConfig } = get();
    if (!config) return;
    get().pushUndo();
    const updated = {
      ...config,
      imageOverlays: config.imageOverlays.filter((o) => o.id !== id),
    };
    set({
      config: updated,
      isDirty: !configsAreEqual(updated, savedConfig),
    });
  },

  // ── UI ──

  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

  toggleSection: (sectionId) => {
    set((s) => {
      const next = new Set(s.collapsedSections);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return { collapsedSections: next };
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSpaceTypeFilter: (filter) => set({ spaceTypeFilter: filter }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowOccupancyColors: (show) => set({ showOccupancyColors: show }),
  setHoveredSpaceId: (id) => set({ hoveredSpaceId: id }),

  setSelectedStore: (groupId, storeId) => {
    set({
      selectedGroupId: groupId,
      selectedStoreId: storeId,
      config: null,
      savedConfig: null,
      selectedConfigId: null,
      availableConfigs: [],
      selectedSpaceIds: new Set(),
      undoStack: [],
      redoStack: [],
      isDirty: false,
    });
  },
}));
