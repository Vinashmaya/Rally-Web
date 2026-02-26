'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  Badge,
} from '@rally/ui';
import {
  Grid3X3,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  MapPin,
  Image as ImageIcon,
  RotateCw,
  Move,
  Maximize2,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  LotGridConfig,
  LotGrid,
  LotImageOverlay,
  GeoPoint,
  GridType,
} from '@rally/firebase';
import LotConfigMap from './LotConfigMap';

// ---------------------------------------------------------------------------
// Default Config (Gallatin CDJR — same defaults as Swift GridNavApp)
// ---------------------------------------------------------------------------

const GALLATIN_CENTER: GeoPoint = { latitude: 36.36966, longitude: -86.48707 };

function createDefaultConfig(): LotGridConfig {
  return {
    storeId: '',
    groupId: '',
    name: 'New Lot Config',
    center: { ...GALLATIN_CENTER },
    zoom: 19,
    bearing: -43,
    grids: [],
    imageOverlays: [],
  };
}

function createDefaultGrid(index: number): LotGrid {
  return {
    id: `grid-${Date.now()}-${index}`,
    label: index === 0 ? 'Main Lot' : `Grid ${index + 1}`,
    type: index === 0 ? 'base' : 'sub',
    origin: { ...GALLATIN_CENTER },
    rotationDeg: 43,
    rows: 10,
    cols: 10,
    cellWidthFt: 9,
    cellHeightFt: 18,
    color: index === 0 ? '#3b82f6' : '#10b981',
    opacity: 0.6,
    visible: true,
  };
}

function createDefaultOverlay(): LotImageOverlay {
  return {
    id: `overlay-${Date.now()}`,
    label: 'Lot Image',
    imageUrl: '',
    bounds: [
      { latitude: GALLATIN_CENTER.latitude - 0.001, longitude: GALLATIN_CENTER.longitude - 0.001 },
      { latitude: GALLATIN_CENTER.latitude + 0.001, longitude: GALLATIN_CENTER.longitude + 0.001 },
    ],
    opacity: 0.8,
    rotationDeg: 0,
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    flipHorizontal: false,
    flipVertical: false,
  };
}

// ---------------------------------------------------------------------------
// Overlay Tool Tabs
// ---------------------------------------------------------------------------

type OverlayTool = 'opacity' | 'scale' | 'rotation' | 'position' | 'flip';

const OVERLAY_TOOLS: { id: OverlayTool; label: string; icon: typeof RotateCw }[] = [
  { id: 'opacity', label: 'Opacity', icon: Eye },
  { id: 'scale', label: 'Scale', icon: Maximize2 },
  { id: 'rotation', label: 'Rotation', icon: RotateCw },
  { id: 'position', label: 'Position', icon: Move },
  { id: 'flip', label: 'Flip', icon: FlipHorizontal },
];

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
// Page Component
// ---------------------------------------------------------------------------

export default function LotConfigPage() {
  // State
  const [config, setConfig] = useState<LotGridConfig>(createDefaultConfig);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<OverlayTool>('opacity');
  const [panel, setPanel] = useState<'grids' | 'overlays'>('grids');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastClickCoords, setLastClickCoords] = useState<{ lng: number; lat: number } | null>(null);

  // Store selection
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);

  // Existing configs for selected store
  const [existingConfigs, setExistingConfigs] = useState<LotGridConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);

  // Selected grid/overlay objects
  const selectedGrid = useMemo(
    () => config.grids.find((g) => g.id === selectedGridId) ?? null,
    [config.grids, selectedGridId],
  );
  const selectedOverlay = useMemo(
    () => config.imageOverlays.find((o) => o.id === selectedOverlayId) ?? null,
    [config.imageOverlays, selectedOverlayId],
  );

  // Load stores on mount
  useEffect(() => {
    async function loadStores() {
      try {
        const res = await fetch('/api/admin/tenants');
        if (!res.ok) throw new Error('Failed to load tenants');
        const { tenants } = await res.json();

        const storeList: StoreOption[] = [];
        for (const tenant of tenants) {
          // Each tenant may have sub-stores; use tenant as both group and store for simplicity
          storeList.push({
            groupId: tenant.id,
            groupName: tenant.name ?? tenant.id,
            storeId: tenant.id,
            storeName: tenant.name ?? tenant.id,
          });
        }
        setStores(storeList);
      } catch (err) {
        console.error('Failed to load stores:', err);
      } finally {
        setStoresLoading(false);
      }
    }
    loadStores();
  }, []);

  // Load existing configs when store is selected
  useEffect(() => {
    if (!selectedStore) {
      setExistingConfigs([]);
      return;
    }

    async function loadConfigs() {
      if (!selectedStore) return;
      setConfigsLoading(true);
      try {
        const params = new URLSearchParams({
          groupId: selectedStore.groupId,
          storeId: selectedStore.storeId,
        });
        const res = await fetch(`/api/admin/lot-config?${params}`);
        if (!res.ok) throw new Error('Failed to load configs');
        const { configs } = await res.json();
        setExistingConfigs(configs);
      } catch (err) {
        console.error('Failed to load lot configs:', err);
      } finally {
        setConfigsLoading(false);
      }
    }
    loadConfigs();
  }, [selectedStore]);

  // ---------------------------------------------------------------------------
  // Grid CRUD
  // ---------------------------------------------------------------------------

  const addGrid = useCallback(() => {
    const newGrid = createDefaultGrid(config.grids.length);
    // If we have a map click location, use it as origin
    if (lastClickCoords) {
      newGrid.origin = { latitude: lastClickCoords.lat, longitude: lastClickCoords.lng };
    }
    setConfig((prev) => ({
      ...prev,
      grids: [...prev.grids, newGrid],
    }));
    setSelectedGridId(newGrid.id);
    setPanel('grids');
  }, [config.grids.length, lastClickCoords]);

  const removeGrid = useCallback((gridId: string) => {
    setConfig((prev) => ({
      ...prev,
      grids: prev.grids.filter((g) => g.id !== gridId),
    }));
    setSelectedGridId(null);
  }, []);

  const updateGrid = useCallback((gridId: string, updates: Partial<LotGrid>) => {
    setConfig((prev) => ({
      ...prev,
      grids: prev.grids.map((g) => (g.id === gridId ? { ...g, ...updates } : g)),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Overlay CRUD
  // ---------------------------------------------------------------------------

  const addOverlay = useCallback(() => {
    const newOverlay = createDefaultOverlay();
    setConfig((prev) => ({
      ...prev,
      imageOverlays: [...prev.imageOverlays, newOverlay],
    }));
    setSelectedOverlayId(newOverlay.id);
    setPanel('overlays');
  }, []);

  const removeOverlay = useCallback((overlayId: string) => {
    setConfig((prev) => ({
      ...prev,
      imageOverlays: prev.imageOverlays.filter((o) => o.id !== overlayId),
    }));
    setSelectedOverlayId(null);
  }, []);

  const updateOverlay = useCallback((overlayId: string, updates: Partial<LotImageOverlay>) => {
    setConfig((prev) => ({
      ...prev,
      imageOverlays: prev.imageOverlays.map((o) =>
        o.id === overlayId ? { ...o, ...updates } : o,
      ),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!selectedStore) {
      setSaveError('Select a store first');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        ...config,
        groupId: selectedStore.groupId,
        storeId: selectedStore.storeId,
      };

      const res = await fetch('/api/admin/lot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to save');
      }

      const result = await res.json();
      if (result.id && !config.id) {
        setConfig((prev) => ({ ...prev, id: result.id }));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [config, selectedStore]);

  // ---------------------------------------------------------------------------
  // Load existing config
  // ---------------------------------------------------------------------------

  const loadConfig = useCallback((existing: LotGridConfig) => {
    setConfig(existing);
    setSelectedGridId(null);
    setSelectedOverlayId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Map handlers
  // ---------------------------------------------------------------------------

  const handleMapClick = useCallback((coords: { lng: number; lat: number }) => {
    setLastClickCoords(coords);
  }, []);

  const handleCellClick = useCallback(
    (gridId: string, row: number, col: number, dealerName: string) => {
      setSelectedGridId(gridId);
      setPanel('grids');
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid3X3 className="h-6 w-6 text-[var(--rally-gold)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lot Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          {saveError && (
            <span className="text-xs text-[var(--status-error)] flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {saveError}
            </span>
          )}
          {saveSuccess && (
            <span className="text-xs text-[#22C55E]">Saved!</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStore}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--rally-gold)] text-black font-medium text-sm hover:bg-[var(--rally-gold-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Config
          </button>
        </div>
      </div>

      {/* Store Selector + Config Name */}
      <div className="flex gap-3">
        {/* Store Picker */}
        <div className="flex-1">
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Store</label>
          <select
            value={selectedStore ? `${selectedStore.groupId}::${selectedStore.storeId}` : ''}
            onChange={(e) => {
              const store = stores.find(
                (s) => `${s.groupId}::${s.storeId}` === e.target.value,
              );
              setSelectedStore(store ?? null);
            }}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
          >
            <option value="">Select a store...</option>
            {stores.map((s) => (
              <option key={`${s.groupId}::${s.storeId}`} value={`${s.groupId}::${s.storeId}`}>
                {s.groupName} — {s.storeName}
              </option>
            ))}
          </select>
        </div>

        {/* Config Name */}
        <div className="flex-1">
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Config Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
            placeholder="Main Lot"
          />
        </div>

        {/* Existing Configs */}
        {existingConfigs.length > 0 && (
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-tertiary)] mb-1">
              Load Existing ({existingConfigs.length})
            </label>
            <select
              onChange={(e) => {
                const cfg = existingConfigs.find((c) => c.id === e.target.value);
                if (cfg) loadConfig(cfg);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
            >
              <option value="">Select config...</option>
              {existingConfigs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Map Center Controls */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-tertiary)] mb-1">Center Lat</label>
            <input
              type="number"
              step="0.00001"
              value={config.center.latitude}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  center: { ...prev.center, latitude: parseFloat(e.target.value) || 0 },
                }))
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-[var(--text-tertiary)] mb-1">Center Lng</label>
            <input
              type="number"
              step="0.00001"
              value={config.center.longitude}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  center: { ...prev.center, longitude: parseFloat(e.target.value) || 0 },
                }))
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
            />
          </div>
        </div>
        <div className="w-20">
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Zoom</label>
          <input
            type="number"
            min={1}
            max={22}
            value={config.zoom}
            onChange={(e) => setConfig((prev) => ({ ...prev, zoom: parseInt(e.target.value) || 19 }))}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-[var(--text-tertiary)] mb-1">Bearing</label>
          <input
            type="number"
            min={-360}
            max={360}
            value={config.bearing}
            onChange={(e) => setConfig((prev) => ({ ...prev, bearing: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
          />
        </div>
        {lastClickCoords && (
          <button
            onClick={() => {
              setConfig((prev) => ({
                ...prev,
                center: { latitude: lastClickCoords.lat, longitude: lastClickCoords.lng },
              }));
            }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--rally-gold)] text-xs hover:bg-[var(--surface-hover)] transition-colors"
            title="Use last clicked coordinates as center"
          >
            <MapPin className="h-3 w-3" />
            Use Clicked
          </button>
        )}
      </div>

      {/* Main Layout: Map + Side Panel */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 350px)', minHeight: '500px' }}>
        {/* Map */}
        <div className="flex-1 relative">
          <LotConfigMap
            config={config}
            onCellClick={handleCellClick}
            onMapClick={handleMapClick}
          />
          {/* Coordinate display */}
          {lastClickCoords && (
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/80 border border-[var(--surface-border)] text-xs font-mono text-[var(--text-secondary)]">
              {lastClickCoords.lat.toFixed(6)}, {lastClickCoords.lng.toFixed(6)}
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="w-80 flex flex-col gap-3 overflow-y-auto">
          {/* Panel Tabs */}
          <div className="flex rounded-lg bg-[var(--surface-overlay)] border border-[var(--surface-border)] p-1">
            <button
              onClick={() => setPanel('grids')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'grids'
                  ? 'bg-[var(--rally-gold)] text-black'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              Grids ({config.grids.length})
            </button>
            <button
              onClick={() => setPanel('overlays')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'overlays'
                  ? 'bg-[var(--rally-gold)] text-black'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Overlays ({config.imageOverlays.length})
            </button>
          </div>

          {/* Grids Panel */}
          {panel === 'grids' && (
            <>
              {/* Grid List */}
              <div className="space-y-1">
                {config.grids.map((grid) => (
                  <div
                    key={grid.id}
                    onClick={() => setSelectedGridId(grid.id === selectedGridId ? null : grid.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      grid.id === selectedGridId
                        ? 'bg-[var(--rally-gold)]/10 border border-[var(--rally-gold)]/30'
                        : 'bg-[var(--surface-overlay)] border border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                    }`}
                  >
                    <div
                      className="h-3 w-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: grid.color }}
                    />
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">
                      {grid.label}
                    </span>
                    <Badge variant="default" size="sm">
                      {grid.rows}×{grid.cols}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateGrid(grid.id, { visible: !grid.visible });
                      }}
                      className="p-1 rounded hover:bg-[var(--surface-hover)]"
                    >
                      {grid.visible ? (
                        <Eye className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-[var(--text-disabled)]" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeGrid(grid.id);
                      }}
                      className="p-1 rounded hover:bg-[var(--status-error)]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--status-error)]" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Grid */}
              <button
                onClick={addGrid}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--surface-border)] text-[var(--text-secondary)] text-sm hover:border-[var(--rally-gold)] hover:text-[var(--rally-gold)] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Grid
              </button>

              {/* Selected Grid Editor */}
              {selectedGrid && (
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      Edit Grid
                    </h3>

                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedGrid.label}
                        onChange={(e) => updateGrid(selectedGrid.id, { label: e.target.value })}
                        className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Type</label>
                        <select
                          value={selectedGrid.type}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { type: e.target.value as GridType })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
                        >
                          <option value="base">Base</option>
                          <option value="sub">Sub</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Color</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={selectedGrid.color}
                            onChange={(e) => updateGrid(selectedGrid.id, { color: e.target.value })}
                            className="h-8 w-8 rounded border border-[var(--surface-border)] cursor-pointer"
                          />
                          <input
                            type="text"
                            value={selectedGrid.color}
                            onChange={(e) => updateGrid(selectedGrid.id, { color: e.target.value })}
                            className="flex-1 px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Rows</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={selectedGrid.rows}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { rows: parseInt(e.target.value) || 1 })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Cols</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={selectedGrid.cols}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { cols: parseInt(e.target.value) || 1 })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Cell W (ft)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={0.5}
                          value={selectedGrid.cellWidthFt}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { cellWidthFt: parseFloat(e.target.value) || 9 })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Cell H (ft)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={0.5}
                          value={selectedGrid.cellHeightFt}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { cellHeightFt: parseFloat(e.target.value) || 18 })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Rotation°</label>
                        <input
                          type="number"
                          min={-360}
                          max={360}
                          step={1}
                          value={selectedGrid.rotationDeg}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, {
                              rotationDeg: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-tertiary)] mb-1">Opacity</label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={selectedGrid.opacity}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, { opacity: parseFloat(e.target.value) })
                          }
                          className="w-full accent-[var(--rally-gold)]"
                        />
                      </div>
                    </div>

                    {/* Origin */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-[var(--text-tertiary)]">Origin</label>
                        {lastClickCoords && (
                          <button
                            onClick={() =>
                              updateGrid(selectedGrid.id, {
                                origin: {
                                  latitude: lastClickCoords.lat,
                                  longitude: lastClickCoords.lng,
                                },
                              })
                            }
                            className="text-[10px] text-[var(--rally-gold)] hover:underline"
                          >
                            Use clicked point
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedGrid.origin.latitude}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, {
                              origin: {
                                ...selectedGrid.origin,
                                latitude: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="flex-1 px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs font-mono"
                          placeholder="Lat"
                        />
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedGrid.origin.longitude}
                          onChange={(e) =>
                            updateGrid(selectedGrid.id, {
                              origin: {
                                ...selectedGrid.origin,
                                longitude: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="flex-1 px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-xs font-mono"
                          placeholder="Lng"
                        />
                      </div>
                    </div>

                    {/* Cell count */}
                    <div className="text-xs text-[var(--text-tertiary)] text-center pt-1 border-t border-[var(--surface-border)]">
                      {selectedGrid.rows * selectedGrid.cols} cells ·{' '}
                      {(selectedGrid.rows * selectedGrid.cellHeightFt).toFixed(0)}ft ×{' '}
                      {(selectedGrid.cols * selectedGrid.cellWidthFt).toFixed(0)}ft
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Overlays Panel */}
          {panel === 'overlays' && (
            <>
              {/* Overlay List */}
              <div className="space-y-1">
                {config.imageOverlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    onClick={() =>
                      setSelectedOverlayId(
                        overlay.id === selectedOverlayId ? null : overlay.id,
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      overlay.id === selectedOverlayId
                        ? 'bg-[var(--rally-gold)]/10 border border-[var(--rally-gold)]/30'
                        : 'bg-[var(--surface-overlay)] border border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                    }`}
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">
                      {overlay.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOverlay(overlay.id);
                      }}
                      className="p-1 rounded hover:bg-[var(--status-error)]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[var(--status-error)]" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Overlay */}
              <button
                onClick={addOverlay}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--surface-border)] text-[var(--text-secondary)] text-sm hover:border-[var(--rally-gold)] hover:text-[var(--rally-gold)] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Image Overlay
              </button>

              {/* Selected Overlay Editor */}
              {selectedOverlay && (
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      Edit Overlay
                    </h3>

                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedOverlay.label}
                        onChange={(e) =>
                          updateOverlay(selectedOverlay.id, { label: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--text-tertiary)] mb-1">Image URL</label>
                      <input
                        type="url"
                        value={selectedOverlay.imageUrl}
                        onChange={(e) =>
                          updateOverlay(selectedOverlay.id, { imageUrl: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm font-mono"
                        placeholder="https://..."
                      />
                    </div>

                    {/* Tool Tabs */}
                    <div className="flex gap-1">
                      {OVERLAY_TOOLS.map((tool) => (
                        <button
                          key={tool.id}
                          onClick={() => setActiveTool(tool.id)}
                          className={`flex-1 flex items-center justify-center p-1.5 rounded text-xs transition-colors ${
                            activeTool === tool.id
                              ? 'bg-[var(--rally-gold)] text-black'
                              : 'bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                          title={tool.label}
                        >
                          <tool.icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>

                    {/* Tool Controls */}
                    {activeTool === 'opacity' && (
                      <div>
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                          <span>Opacity</span>
                          <span className="font-mono">{(selectedOverlay.opacity * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={selectedOverlay.opacity}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, {
                              opacity: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--rally-gold)]"
                        />
                      </div>
                    )}

                    {activeTool === 'scale' && (
                      <div>
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                          <span>Scale</span>
                          <span className="font-mono">{selectedOverlay.scale.toFixed(2)}×</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={3}
                          step={0.01}
                          value={selectedOverlay.scale}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, {
                              scale: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--rally-gold)]"
                        />
                      </div>
                    )}

                    {activeTool === 'rotation' && (
                      <div>
                        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                          <span>Rotation</span>
                          <span className="font-mono">{selectedOverlay.rotationDeg.toFixed(1)}°</span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={0.5}
                          value={selectedOverlay.rotationDeg}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, {
                              rotationDeg: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--rally-gold)]"
                        />
                      </div>
                    )}

                    {activeTool === 'position' && (
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                            <span>Offset X (m)</span>
                            <span className="font-mono">{selectedOverlay.offsetX.toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={0.5}
                            value={selectedOverlay.offsetX}
                            onChange={(e) =>
                              updateOverlay(selectedOverlay.id, {
                                offsetX: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-[var(--rally-gold)]"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1">
                            <span>Offset Y (m)</span>
                            <span className="font-mono">{selectedOverlay.offsetY.toFixed(1)}</span>
                          </div>
                          <input
                            type="range"
                            min={-200}
                            max={200}
                            step={0.5}
                            value={selectedOverlay.offsetY}
                            onChange={(e) =>
                              updateOverlay(selectedOverlay.id, {
                                offsetY: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-[var(--rally-gold)]"
                          />
                        </div>
                      </div>
                    )}

                    {activeTool === 'flip' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateOverlay(selectedOverlay.id, {
                              flipHorizontal: !selectedOverlay.flipHorizontal,
                            })
                          }
                          className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-colors ${
                            selectedOverlay.flipHorizontal
                              ? 'bg-[var(--rally-gold)]/10 border-[var(--rally-gold)]/30 text-[var(--rally-gold)]'
                              : 'bg-[var(--surface-overlay)] border-[var(--surface-border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <FlipHorizontal className="h-4 w-4" />
                          H-Flip
                        </button>
                        <button
                          onClick={() =>
                            updateOverlay(selectedOverlay.id, {
                              flipVertical: !selectedOverlay.flipVertical,
                            })
                          }
                          className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-colors ${
                            selectedOverlay.flipVertical
                              ? 'bg-[var(--rally-gold)]/10 border-[var(--rally-gold)]/30 text-[var(--rally-gold)]'
                              : 'bg-[var(--surface-overlay)] border-[var(--surface-border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <FlipVertical className="h-4 w-4" />
                          V-Flip
                        </button>
                      </div>
                    )}

                    {/* Bounds */}
                    <div>
                      <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                        Bounds (SW → NE)
                      </label>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedOverlay.bounds[0].latitude}
                          onChange={(e) => {
                            const newBounds = [...selectedOverlay.bounds] as [GeoPoint, GeoPoint];
                            newBounds[0] = {
                              ...newBounds[0],
                              latitude: parseFloat(e.target.value) || 0,
                            };
                            updateOverlay(selectedOverlay.id, { bounds: newBounds });
                          }}
                          className="px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono"
                          placeholder="SW Lat"
                        />
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedOverlay.bounds[0].longitude}
                          onChange={(e) => {
                            const newBounds = [...selectedOverlay.bounds] as [GeoPoint, GeoPoint];
                            newBounds[0] = {
                              ...newBounds[0],
                              longitude: parseFloat(e.target.value) || 0,
                            };
                            updateOverlay(selectedOverlay.id, { bounds: newBounds });
                          }}
                          className="px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono"
                          placeholder="SW Lng"
                        />
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedOverlay.bounds[1].latitude}
                          onChange={(e) => {
                            const newBounds = [...selectedOverlay.bounds] as [GeoPoint, GeoPoint];
                            newBounds[1] = {
                              ...newBounds[1],
                              latitude: parseFloat(e.target.value) || 0,
                            };
                            updateOverlay(selectedOverlay.id, { bounds: newBounds });
                          }}
                          className="px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono"
                          placeholder="NE Lat"
                        />
                        <input
                          type="number"
                          step="0.00001"
                          value={selectedOverlay.bounds[1].longitude}
                          onChange={(e) => {
                            const newBounds = [...selectedOverlay.bounds] as [GeoPoint, GeoPoint];
                            newBounds[1] = {
                              ...newBounds[1],
                              longitude: parseFloat(e.target.value) || 0,
                            };
                            updateOverlay(selectedOverlay.id, { bounds: newBounds });
                          }}
                          className="px-2 py-1 rounded bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono"
                          placeholder="NE Lng"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
