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
  ChevronDown,
  ChevronRight,
  Check,
  Settings2,
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

/** Strip Firestore timestamps and metadata before POSTing back */
function stripFirestoreMetadata(config: LotGridConfig): LotGridConfig {
  const { createdAt, updatedAt, createdBy, ...rest } = config;
  return rest;
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
// Collapsible Section
// ---------------------------------------------------------------------------

function Section({ title, icon: Icon, defaultOpen = true, children }: {
  title: string;
  icon: typeof Grid3X3;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-surface-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-overlay hover:bg-surface-borderHover transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-rally-gold" />
        <span className="text-sm font-medium text-text-primary flex-1">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-tertiary" />
        )}
      </button>
      {open && <div className="p-3 space-y-3 border-t border-surface-border">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none transition-colors';
const monoInputCls = `${inputCls} font-mono`;
const selectCls = inputCls;

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
        const json = await res.json();
        const groups = json.data ?? json.tenants ?? [];

        const storeList: StoreOption[] = [];
        for (const group of groups) {
          try {
            const storesRes = await fetch(`/api/admin/lot-config/stores?groupId=${group.id}`);
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

        // Auto-select first store
        if (storeList.length > 0) {
          setSelectedStore(storeList[0] ?? null);
        }
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

        // Auto-load first config if there is one
        if (configs.length > 0) {
          setConfig(configs[0]);
        }
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
  // Save — strips Firestore metadata before POSTing
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
        ...stripFirestoreMetadata(config),
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
        throw new Error(err.details ? JSON.stringify(err.details) : err.error ?? 'Failed to save');
      }

      const result = await res.json();
      if (result.id && !config.id) {
        setConfig((prev) => ({ ...prev, id: result.id }));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[lot-config] Save error:', err);
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
    (gridId: string, _row: number, _col: number, _dealerName: string) => {
      setSelectedGridId(gridId);
      setPanel('grids');
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Grid3X3 className="h-6 w-6 text-rally-gold" />
          <h1 className="text-2xl font-bold text-text-primary">Lot Configuration</h1>
        </div>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-sm text-status-error flex items-center gap-1.5 max-w-xs truncate">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {saveError}
            </span>
          )}
          {saveSuccess && (
            <span className="text-sm text-[#22C55E] flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-rally-gold text-black font-bold text-sm hover:bg-rally-goldLight disabled:opacity-70 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Config
          </button>
        </div>
      </div>

      {/* Main: Map + Control Panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: 9:16 Map */}
        <div className="relative h-full flex-shrink-0" style={{ aspectRatio: '9 / 16' }}>
          <LotConfigMap
            config={config}
            onCellClick={handleCellClick}
            onMapClick={handleMapClick}
          />
          {/* Floating coordinate display */}
          {lastClickCoords && (
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/80 border border-surface-border text-xs font-mono text-text-secondary">
              {lastClickCoords.lat.toFixed(6)}, {lastClickCoords.lng.toFixed(6)}
            </div>
          )}
        </div>

        {/* Right: Control Panel (scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-w-[320px]">

          {/* Store & Config Selection */}
          <Section title="Store & Config" icon={MapPin} defaultOpen={true}>
            <LabeledInput label="Store">
              <select
                value={selectedStore ? `${selectedStore.groupId}::${selectedStore.storeId}` : ''}
                onChange={(e) => {
                  const store = stores.find(
                    (s) => `${s.groupId}::${s.storeId}` === e.target.value,
                  );
                  setSelectedStore(store ?? null);
                }}
                className={selectCls}
              >
                <option value="">Select a store...</option>
                {stores.map((s) => (
                  <option key={`${s.groupId}::${s.storeId}`} value={`${s.groupId}::${s.storeId}`}>
                    {s.groupName} — {s.storeName}
                  </option>
                ))}
              </select>
            </LabeledInput>

            <LabeledInput label="Config Name">
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                className={inputCls}
                placeholder="Main Lot"
              />
            </LabeledInput>

            {existingConfigs.length > 0 && (
              <LabeledInput label={`Load Existing (${existingConfigs.length})`}>
                <select
                  value={config.id ?? ''}
                  onChange={(e) => {
                    const cfg = existingConfigs.find((c) => c.id === e.target.value);
                    if (cfg) loadConfig(cfg);
                  }}
                  className={selectCls}
                >
                  <option value="">Select config...</option>
                  {existingConfigs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </LabeledInput>
            )}
          </Section>

          {/* Map Settings */}
          <Section title="Map Settings" icon={Settings2} defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="Center Lat">
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
                  className={monoInputCls}
                />
              </LabeledInput>
              <LabeledInput label="Center Lng">
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
                  className={monoInputCls}
                />
              </LabeledInput>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="Zoom">
                <input
                  type="number"
                  min={1}
                  max={22}
                  value={config.zoom}
                  onChange={(e) => setConfig((prev) => ({ ...prev, zoom: parseInt(e.target.value) || 19 }))}
                  className={monoInputCls}
                />
              </LabeledInput>
              <LabeledInput label="Bearing">
                <input
                  type="number"
                  min={-360}
                  max={360}
                  value={config.bearing}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bearing: parseInt(e.target.value) || 0 }))}
                  className={monoInputCls}
                />
              </LabeledInput>
            </div>
            {lastClickCoords && (
              <button
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    center: { latitude: lastClickCoords.lat, longitude: lastClickCoords.lng },
                  }));
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-overlay border border-rally-gold/30 text-rally-gold text-sm hover:bg-rally-gold/10 transition-colors w-full justify-center"
              >
                <MapPin className="h-4 w-4" />
                Set Center to Clicked Point
              </button>
            )}
          </Section>

          {/* Grids & Overlays Tabs */}
          <div className="border border-surface-border rounded-lg overflow-hidden">
            <div className="flex bg-surface-overlay">
              <button
                onClick={() => setPanel('grids')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  panel === 'grids'
                    ? 'border-rally-gold text-rally-gold bg-rally-gold/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Grid3X3 className="h-4 w-4" />
                Grids ({config.grids.length})
              </button>
              <button
                onClick={() => setPanel('overlays')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  panel === 'overlays'
                    ? 'border-rally-gold text-rally-gold bg-rally-gold/5'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Overlays ({config.imageOverlays.length})
              </button>
            </div>

            <div className="p-3 space-y-3">
              {/* Grids Panel */}
              {panel === 'grids' && (
                <>
                  {config.grids.length === 0 && (
                    <p className="text-sm text-text-tertiary text-center py-4">
                      No grids yet. Click the map to set an origin, then add a grid.
                    </p>
                  )}

                  {config.grids.map((grid) => (
                    <div
                      key={grid.id}
                      onClick={() => setSelectedGridId(grid.id === selectedGridId ? null : grid.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        grid.id === selectedGridId
                          ? 'bg-rally-gold/10 border border-rally-gold/30'
                          : 'bg-surface-base border border-surface-border hover:border-text-tertiary'
                      }`}
                    >
                      <div
                        className="h-3 w-3 rounded-sm flex-shrink-0 border border-white/20"
                        style={{ backgroundColor: grid.color }}
                      />
                      <span className="text-sm text-text-primary flex-1 truncate">
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
                        className="p-1 rounded hover:bg-surface-borderHover"
                      >
                        {grid.visible ? (
                          <Eye className="h-4 w-4 text-text-secondary" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-text-disabled" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeGrid(grid.id);
                        }}
                        className="p-1 rounded hover:bg-status-error/10"
                      >
                        <Trash2 className="h-4 w-4 text-status-error" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addGrid}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-surface-border text-text-secondary text-sm hover:border-rally-gold hover:text-rally-gold transition-colors w-full justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    Add Grid
                  </button>

                  {/* Selected Grid Editor */}
                  {selectedGrid && (
                    <Card>
                      <CardContent className="p-3 space-y-3">
                        <h3 className="text-xs font-semibold text-rally-gold uppercase tracking-wider">
                          Edit: {selectedGrid.label}
                        </h3>

                        <LabeledInput label="Label">
                          <input
                            type="text"
                            value={selectedGrid.label}
                            onChange={(e) => updateGrid(selectedGrid.id, { label: e.target.value })}
                            className={inputCls}
                          />
                        </LabeledInput>

                        <div className="grid grid-cols-2 gap-2">
                          <LabeledInput label="Type">
                            <select
                              value={selectedGrid.type}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { type: e.target.value as GridType })
                              }
                              className={selectCls}
                            >
                              <option value="base">Base</option>
                              <option value="sub">Sub</option>
                            </select>
                          </LabeledInput>
                          <LabeledInput label="Color">
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={selectedGrid.color}
                                onChange={(e) => updateGrid(selectedGrid.id, { color: e.target.value })}
                                className="h-9 w-9 rounded-lg border border-surface-border cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={selectedGrid.color}
                                onChange={(e) => updateGrid(selectedGrid.id, { color: e.target.value })}
                                className={`flex-1 ${monoInputCls} text-xs`}
                              />
                            </div>
                          </LabeledInput>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <LabeledInput label="Rows">
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={selectedGrid.rows}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { rows: parseInt(e.target.value) || 1 })
                              }
                              className={monoInputCls}
                            />
                          </LabeledInput>
                          <LabeledInput label="Cols">
                            <input
                              type="number"
                              min={1}
                              max={200}
                              value={selectedGrid.cols}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { cols: parseInt(e.target.value) || 1 })
                              }
                              className={monoInputCls}
                            />
                          </LabeledInput>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <LabeledInput label="Cell Width (ft)">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              step={0.5}
                              value={selectedGrid.cellWidthFt}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { cellWidthFt: parseFloat(e.target.value) || 9 })
                              }
                              className={monoInputCls}
                            />
                          </LabeledInput>
                          <LabeledInput label="Cell Height (ft)">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              step={0.5}
                              value={selectedGrid.cellHeightFt}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { cellHeightFt: parseFloat(e.target.value) || 18 })
                              }
                              className={monoInputCls}
                            />
                          </LabeledInput>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <LabeledInput label="Rotation (deg)">
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
                              className={monoInputCls}
                            />
                          </LabeledInput>
                          <LabeledInput label="Opacity">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={selectedGrid.opacity}
                              onChange={(e) =>
                                updateGrid(selectedGrid.id, { opacity: parseFloat(e.target.value) })
                              }
                              className="w-full accent-rally-gold mt-2"
                            />
                          </LabeledInput>
                        </div>

                        {/* Origin */}
                        <LabeledInput label="Origin">
                          <div className="flex gap-2">
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
                              className={`flex-1 ${monoInputCls} text-xs`}
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
                              className={`flex-1 ${monoInputCls} text-xs`}
                              placeholder="Lng"
                            />
                          </div>
                        </LabeledInput>

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
                            className="text-xs text-rally-gold hover:underline"
                          >
                            Use clicked point as origin
                          </button>
                        )}

                        <div className="text-xs text-text-tertiary text-center pt-2 border-t border-surface-border">
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
                  {config.imageOverlays.length === 0 && (
                    <p className="text-sm text-text-tertiary text-center py-4">
                      No overlays yet. Add an aerial photo overlay.
                    </p>
                  )}

                  {config.imageOverlays.map((overlay) => (
                    <div
                      key={overlay.id}
                      onClick={() =>
                        setSelectedOverlayId(
                          overlay.id === selectedOverlayId ? null : overlay.id,
                        )
                      }
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        overlay.id === selectedOverlayId
                          ? 'bg-rally-gold/10 border border-rally-gold/30'
                          : 'bg-surface-base border border-surface-border hover:border-text-tertiary'
                      }`}
                    >
                      <ImageIcon className="h-4 w-4 text-text-secondary" />
                      <span className="text-sm text-text-primary flex-1 truncate">
                        {overlay.label}
                      </span>
                      <span className="text-xs text-text-tertiary font-mono">
                        {(overlay.opacity * 100).toFixed(0)}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeOverlay(overlay.id);
                        }}
                        className="p-1 rounded hover:bg-status-error/10"
                      >
                        <Trash2 className="h-4 w-4 text-status-error" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addOverlay}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-surface-border text-text-secondary text-sm hover:border-rally-gold hover:text-rally-gold transition-colors w-full justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    Add Image Overlay
                  </button>

                  {/* Selected Overlay Editor */}
                  {selectedOverlay && (
                    <Card>
                      <CardContent className="p-3 space-y-3">
                        <h3 className="text-xs font-semibold text-rally-gold uppercase tracking-wider">
                          Edit: {selectedOverlay.label}
                        </h3>

                        <LabeledInput label="Label">
                          <input
                            type="text"
                            value={selectedOverlay.label}
                            onChange={(e) =>
                              updateOverlay(selectedOverlay.id, { label: e.target.value })
                            }
                            className={inputCls}
                          />
                        </LabeledInput>

                        <LabeledInput label="Image URL">
                          <input
                            type="url"
                            value={selectedOverlay.imageUrl}
                            onChange={(e) =>
                              updateOverlay(selectedOverlay.id, { imageUrl: e.target.value })
                            }
                            className={monoInputCls}
                            placeholder="https://... or /lot-overlay.jpg"
                          />
                        </LabeledInput>

                        {/* Tool Tabs */}
                        <div className="flex gap-1 bg-surface-base rounded-lg p-1">
                          {OVERLAY_TOOLS.map((tool) => (
                            <button
                              key={tool.id}
                              onClick={() => setActiveTool(tool.id)}
                              className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-md text-xs transition-colors ${
                                activeTool === tool.id
                                  ? 'bg-rally-gold text-black font-medium'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-borderHover'
                              }`}
                              title={tool.label}
                            >
                              <tool.icon className="h-4 w-4" />
                              <span className="text-[10px]">{tool.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Tool Controls */}
                        {activeTool === 'opacity' && (
                          <div>
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                              <span>Opacity</span>
                              <span className="font-mono text-text-primary">{(selectedOverlay.opacity * 100).toFixed(0)}%</span>
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
                              className="w-full accent-rally-gold"
                            />
                          </div>
                        )}

                        {activeTool === 'scale' && (
                          <div>
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                              <span>Scale</span>
                              <span className="font-mono text-text-primary">{selectedOverlay.scale.toFixed(2)}×</span>
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
                              className="w-full accent-rally-gold"
                            />
                          </div>
                        )}

                        {activeTool === 'rotation' && (
                          <div>
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                              <span>Rotation</span>
                              <span className="font-mono text-text-primary">{selectedOverlay.rotationDeg.toFixed(1)}°</span>
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
                              className="w-full accent-rally-gold"
                            />
                          </div>
                        )}

                        {activeTool === 'position' && (
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-xs text-text-secondary mb-1">
                                <span>Offset X (meters)</span>
                                <span className="font-mono text-text-primary">{selectedOverlay.offsetX.toFixed(1)}m</span>
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
                                className="w-full accent-rally-gold"
                              />
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-text-secondary mb-1">
                                <span>Offset Y (meters)</span>
                                <span className="font-mono text-text-primary">{selectedOverlay.offsetY.toFixed(1)}m</span>
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
                                className="w-full accent-rally-gold"
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
                              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                                selectedOverlay.flipHorizontal
                                  ? 'bg-rally-gold/10 border-rally-gold/30 text-rally-gold'
                                  : 'bg-surface-base border-surface-border text-text-secondary'
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
                              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                                selectedOverlay.flipVertical
                                  ? 'bg-rally-gold/10 border-rally-gold/30 text-rally-gold'
                                  : 'bg-surface-base border-surface-border text-text-secondary'
                              }`}
                            >
                              <FlipVertical className="h-4 w-4" />
                              V-Flip
                            </button>
                          </div>
                        )}

                        {/* Bounds */}
                        <LabeledInput label="Bounds (SW → NE)">
                          <div className="grid grid-cols-2 gap-2">
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
                              className={`${monoInputCls} text-xs`}
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
                              className={`${monoInputCls} text-xs`}
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
                              className={`${monoInputCls} text-xs`}
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
                              className={`${monoInputCls} text-xs`}
                              placeholder="NE Lng"
                            />
                          </div>
                        </LabeledInput>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
