'use client';

import { useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Eye, RotateCw, Move, Maximize2, FlipHorizontal, FlipVertical } from 'lucide-react';
import { Card, CardContent } from '@rally/ui';
import { useLotConfigStore } from '@rally/services';
import type { LotImageOverlay, GeoPoint } from '@rally/firebase';

type ActiveTool = 'opacity' | 'scale' | 'rotation' | 'position' | 'flip';

export default function OverlayPanel() {
  const config = useLotConfigStore((s) => s.config);
  const addOverlay = useLotConfigStore((s) => s.addOverlay);
  const updateOverlay = useLotConfigStore((s) => s.updateOverlay);
  const deleteOverlay = useLotConfigStore((s) => s.deleteOverlay);

  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('opacity');

  const overlays = config?.imageOverlays ?? [];
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) ?? null;

  function handleAddOverlay() {
    const overlay: LotImageOverlay = {
      id: `overlay-${Date.now()}`,
      label: 'Lot Image',
      imageUrl: '',
      bounds: [
        { latitude: 36.36866, longitude: -86.48807 },
        { latitude: 36.37066, longitude: -86.48607 },
      ],
      opacity: 0.8,
      rotationDeg: 0,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      flipHorizontal: false,
      flipVertical: false,
    };
    addOverlay(overlay);
    setSelectedOverlayId(overlay.id);
  }

  function handleSelect(id: string) {
    setSelectedOverlayId((prev) => (prev === id ? null : id));
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteOverlay(id);
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  }

  function handleUpdate(partial: Partial<LotImageOverlay>) {
    if (!selectedOverlayId) return;
    updateOverlay(selectedOverlayId, partial);
  }

  function handleBoundsChange(
    cornerIndex: 0 | 1,
    field: 'latitude' | 'longitude',
    value: number,
  ) {
    if (!selectedOverlay) return;
    const newBounds: [GeoPoint, GeoPoint] = [
      { ...selectedOverlay.bounds[0] },
      { ...selectedOverlay.bounds[1] },
    ];
    newBounds[cornerIndex][field] = value;
    handleUpdate({ bounds: newBounds });
  }

  const toolTabs: { key: ActiveTool; icon: React.ReactNode; label: string }[] = [
    { key: 'opacity', icon: <Eye className="h-3.5 w-3.5" />, label: 'Opacity' },
    { key: 'scale', icon: <Maximize2 className="h-3.5 w-3.5" />, label: 'Scale' },
    { key: 'rotation', icon: <RotateCw className="h-3.5 w-3.5" />, label: 'Rotation' },
    { key: 'position', icon: <Move className="h-3.5 w-3.5" />, label: 'Position' },
    { key: 'flip', icon: <FlipHorizontal className="h-3.5 w-3.5" />, label: 'Flip' },
  ];

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Overlay list */}
      <div className="flex flex-col gap-1">
        {overlays.map((overlay) => {
          const isSelected = overlay.id === selectedOverlayId;
          return (
            <button
              key={overlay.id}
              onClick={() => handleSelect(overlay.id)}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors
                ${
                  isSelected
                    ? 'bg-rally-gold/10 border border-rally-gold'
                    : 'bg-surface-overlay border border-transparent hover:border-surface-border'
                }
              `}
            >
              <ImageIcon className="h-4 w-4 text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-text-primary truncate">
                  {overlay.label}
                </span>
                <span className="block text-xs text-text-tertiary">
                  {Math.round(overlay.opacity * 100)}% opacity
                </span>
              </div>
              <button
                onClick={(e) => handleDelete(e, overlay.id)}
                className="p-1 rounded-md text-text-tertiary hover:text-status-error hover:bg-status-error/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
          );
        })}
      </div>

      {/* Add overlay button */}
      <button
        onClick={handleAddOverlay}
        className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-lg border-2 border-dashed border-surface-border text-text-secondary hover:text-rally-gold hover:border-rally-gold transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm font-medium">Add Image Overlay</span>
      </button>

      {/* Editor panel (visible when an overlay is selected) */}
      {selectedOverlay && (
        <Card className="bg-surface-overlay border-surface-border">
          <CardContent className="flex flex-col gap-4 p-4">
            {/* Label input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Label</label>
              <input
                type="text"
                value={selectedOverlay.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none"
              />
            </div>

            {/* Image URL input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Image URL</label>
              <input
                type="text"
                value={selectedOverlay.imageUrl}
                onChange={(e) => handleUpdate({ imageUrl: e.target.value })}
                placeholder="https://... or gs://..."
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm placeholder:text-text-tertiary focus:border-rally-gold focus:outline-none"
              />
            </div>

            {/* Tool tabs */}
            <div className="flex gap-1 bg-surface-base rounded-lg p-1">
              {toolTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTool(tab.key)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors
                    ${
                      activeTool === tab.key
                        ? 'bg-rally-gold text-black font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-borderHover'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="hidden xl:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tool controls */}
            <div className="flex flex-col gap-3">
              {activeTool === 'opacity' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Opacity</span>
                    <span className="text-xs font-mono text-text-tertiary">
                      {Math.round(selectedOverlay.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedOverlay.opacity}
                    onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
                    className="w-full accent-rally-gold"
                  />
                </div>
              )}

              {activeTool === 'scale' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Scale</span>
                    <span className="text-xs font-mono text-text-tertiary">
                      {selectedOverlay.scale.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.01}
                    value={selectedOverlay.scale}
                    onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) })}
                    className="w-full accent-rally-gold"
                  />
                </div>
              )}

              {activeTool === 'rotation' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Rotation</span>
                    <span className="text-xs font-mono text-text-tertiary">
                      {selectedOverlay.rotationDeg}deg
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={selectedOverlay.rotationDeg}
                    onChange={(e) => handleUpdate({ rotationDeg: parseInt(e.target.value, 10) })}
                    className="w-full accent-rally-gold"
                  />
                </div>
              )}

              {activeTool === 'position' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Offset X</span>
                      <span className="text-xs font-mono text-text-tertiary">
                        {selectedOverlay.offsetX}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-200}
                      max={200}
                      step={1}
                      value={selectedOverlay.offsetX}
                      onChange={(e) => handleUpdate({ offsetX: parseInt(e.target.value, 10) })}
                      className="w-full accent-rally-gold"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Offset Y</span>
                      <span className="text-xs font-mono text-text-tertiary">
                        {selectedOverlay.offsetY}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-200}
                      max={200}
                      step={1}
                      value={selectedOverlay.offsetY}
                      onChange={(e) => handleUpdate({ offsetY: parseInt(e.target.value, 10) })}
                      className="w-full accent-rally-gold"
                    />
                  </div>
                </div>
              )}

              {activeTool === 'flip' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate({ flipHorizontal: !selectedOverlay.flipHorizontal })}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
                      ${
                        selectedOverlay.flipHorizontal
                          ? 'bg-rally-gold/15 border-rally-gold text-rally-gold'
                          : 'bg-surface-base border-surface-border text-text-secondary hover:text-text-primary hover:border-surface-borderHover'
                      }
                    `}
                  >
                    <FlipHorizontal className="h-4 w-4" />
                    H-Flip
                  </button>
                  <button
                    onClick={() => handleUpdate({ flipVertical: !selectedOverlay.flipVertical })}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
                      ${
                        selectedOverlay.flipVertical
                          ? 'bg-rally-gold/15 border-rally-gold text-rally-gold'
                          : 'bg-surface-base border-surface-border text-text-secondary hover:text-text-primary hover:border-surface-borderHover'
                      }
                    `}
                  >
                    <FlipVertical className="h-4 w-4" />
                    V-Flip
                  </button>
                </div>
              )}
            </div>

            {/* Bounds inputs */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-text-secondary">Bounds</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-tertiary">SW Lat</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={selectedOverlay.bounds[0].latitude}
                    onChange={(e) => handleBoundsChange(0, 'latitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-md bg-surface-base border border-surface-border text-text-primary text-xs font-mono focus:border-rally-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-tertiary">SW Lng</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={selectedOverlay.bounds[0].longitude}
                    onChange={(e) => handleBoundsChange(0, 'longitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-md bg-surface-base border border-surface-border text-text-primary text-xs font-mono focus:border-rally-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-tertiary">NE Lat</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={selectedOverlay.bounds[1].latitude}
                    onChange={(e) => handleBoundsChange(1, 'latitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-md bg-surface-base border border-surface-border text-text-primary text-xs font-mono focus:border-rally-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-tertiary">NE Lng</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={selectedOverlay.bounds[1].longitude}
                    onChange={(e) => handleBoundsChange(1, 'longitude', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-md bg-surface-base border border-surface-border text-text-primary text-xs font-mono focus:border-rally-gold focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
