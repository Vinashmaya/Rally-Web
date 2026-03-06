'use client';

import {
  MousePointer2,
  Pencil,
  Move,
  Hand,
  Undo2,
  Redo2,
  Save,
  Loader2,
  Check,
  Tag,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@rally/ui';
import { useLotConfigStore } from '@rally/services';
import type { EditorMode } from '@rally/services';

const MODE_BUTTONS: { mode: EditorMode; label: string; icon: typeof MousePointer2; shortcut: string }[] = [
  { mode: 'select', label: 'Select', icon: MousePointer2, shortcut: 'S' },
  { mode: 'draw', label: 'Draw', icon: Pencil, shortcut: 'D' },
  { mode: 'edit', label: 'Edit', icon: Move, shortcut: 'E' },
  { mode: 'pan', label: 'Pan', icon: Hand, shortcut: 'P' },
] as const;

export default function EditorToolbar() {
  const editorMode = useLotConfigStore((s) => s.editorMode);
  const setEditorMode = useLotConfigStore((s) => s.setEditorMode);
  const undoStack = useLotConfigStore((s) => s.undoStack);
  const redoStack = useLotConfigStore((s) => s.redoStack);
  const undo = useLotConfigStore((s) => s.undo);
  const redo = useLotConfigStore((s) => s.redo);
  const isDirty = useLotConfigStore((s) => s.isDirty);
  const isSaving = useLotConfigStore((s) => s.isSaving);
  const saveConfig = useLotConfigStore((s) => s.saveConfig);
  const config = useLotConfigStore((s) => s.config);
  const showLabels = useLotConfigStore((s) => s.showLabels);
  const setShowLabels = useLotConfigStore((s) => s.setShowLabels);

  const spaceCount = config?.spaces.length ?? 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-surface-overlay border border-surface-border rounded-lg">
      {/* Mode buttons */}
      <div className="flex gap-1 bg-surface-base rounded-lg p-0.5">
        {MODE_BUTTONS.map(({ mode, label, icon: Icon, shortcut }) => (
          <button
            key={mode}
            onClick={() => setEditorMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              editorMode === mode
                ? 'bg-rally-gold text-black'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-borderHover'
            }`}
            title={`${label} (${shortcut})`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-surface-border" />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-borderHover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-borderHover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-surface-border" />

      {/* Toggle labels */}
      <button
        onClick={() => setShowLabels(!showLabels)}
        className={`p-1.5 rounded-md transition-colors ${
          showLabels
            ? 'text-rally-gold bg-rally-gold/10'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-borderHover'
        }`}
        title="Toggle Labels"
      >
        <Tag className="h-4 w-4" />
      </button>

      {/* Space count */}
      <Badge variant="default" size="sm">
        {spaceCount} space{spaceCount !== 1 ? 's' : ''}
      </Badge>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dirty indicator + Save */}
      <button
        onClick={saveConfig}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rally-gold text-black font-bold text-sm hover:bg-rally-goldLight disabled:opacity-70 transition-colors relative"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save
        {isDirty && !isSaving && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-status-error animate-pulse" />
        )}
      </button>
    </div>
  );
}
