'use client';

import {
  forwardRef,
  type HTMLAttributes,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { X, Nfc, QrCode, Keyboard, Check, AlertCircle } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';
import { Input } from './Input';

type ScanMode = 'nfc' | 'qr' | 'manual';

export interface ScanSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  open: boolean;
  onClose: () => void;
  onScan: (vin: string) => void;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
}

const MODE_TABS = [
  { value: 'nfc' as const, label: 'NFC', icon: Nfc },
  { value: 'qr' as const, label: 'QR', icon: QrCode },
  { value: 'manual' as const, label: 'Manual', icon: Keyboard },
] as const;

/**
 * ScanSheet — bottom sheet for NFC, QR, and manual VIN entry.
 *
 * Slides up on mobile, centered modal on desktop.
 * Three modes: NFC tag scan, QR camera viewfinder, manual stock/VIN input.
 */
const ScanSheet = forwardRef<HTMLDivElement, ScanSheetProps>(
  ({ className, open, onClose, onScan, mode, onModeChange, ...props }, ref) => {
    const [manualValue, setManualValue] = useState('');
    const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const backdropRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening
    useEffect(() => {
      if (open) {
        setManualValue('');
        setStatus('idle');
        setStatusMessage('');
      }
    }, [open]);

    // Focus input when switching to manual mode
    useEffect(() => {
      if (open && mode === 'manual') {
        // Small delay to let animation complete
        const timer = setTimeout(() => inputRef.current?.focus(), 150);
        return () => clearTimeout(timer);
      }
    }, [open, mode]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = '';
        };
      }
    }, [open]);

    const handleBackdropClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onClose();
      },
      [onClose]
    );

    const handleManualSubmit = useCallback(() => {
      const trimmed = manualValue.trim().toUpperCase();
      if (!trimmed) return;

      onScan(trimmed);
      setStatus('success');
      setStatusMessage(`Scanned: ${trimmed}`);
      setManualValue('');
    }, [manualValue, onScan]);

    if (!open) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          ref={backdropRef}
          onClick={handleBackdropClick}
          className={cn(
            'fixed inset-0 z-50',
            'bg-black/60 backdrop-blur-sm',
            'animate-rally-fade-in'
          )}
          aria-hidden="true"
        />

        {/* Sheet */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Scan vehicle"
          className={cn(
            'fixed z-50',
            // Mobile: bottom sheet
            'inset-x-0 bottom-0',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:w-full sm:max-w-md',
            // Styling
            'rounded-t-rally-xl sm:rounded-rally-xl',
            'bg-surface-raised border border-surface-border',
            'shadow-rally-lg',
            'animate-rally-slide-up sm:animate-rally-fade-in',
            className
          )}
          {...props}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            {/* Drag handle (mobile) */}
            <div className="absolute left-1/2 top-2 -translate-x-1/2 sm:hidden">
              <div className="h-1 w-8 rounded-full bg-surface-border" />
            </div>

            <h2 className="text-lg font-semibold text-text-primary">Scan Vehicle</h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'rounded-rally p-1.5',
                'text-text-tertiary hover:text-text-primary',
                'hover:bg-surface-overlay transition-colors',
                'cursor-pointer'
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 mx-4 p-1 rounded-rally bg-surface-overlay">
            {MODE_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-rally',
                  'text-sm font-medium transition-all duration-150 cursor-pointer',
                  mode === value
                    ? 'bg-rally-goldMuted text-rally-gold shadow-rally-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-base'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="px-4 py-6 min-h-[200px] flex flex-col items-center justify-center">
            {/* NFC mode */}
            {mode === 'nfc' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="rounded-full bg-rally-goldMuted p-6">
                    <Nfc className="h-10 w-10 text-rally-gold" strokeWidth={1.5} />
                  </div>
                  {/* Animated scanning ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-rally-gold/30 animate-ping" />
                </div>
                <p className="text-sm text-text-secondary">
                  Hold your phone near the tag
                </p>
                <p className="text-xs text-text-tertiary">
                  NFC tag must be on the vehicle windshield or key tag
                </p>
              </div>
            )}

            {/* QR mode */}
            {mode === 'qr' && (
              <div className="flex flex-col items-center gap-4 text-center w-full">
                {/* Camera viewfinder placeholder */}
                <div
                  className={cn(
                    'relative w-full aspect-square max-w-[240px]',
                    'rounded-rally-lg border-2 border-dashed border-surface-borderHover',
                    'bg-surface-overlay',
                    'flex items-center justify-center'
                  )}
                >
                  <QrCode className="h-12 w-12 text-text-disabled" strokeWidth={1} />
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-rally-gold rounded-tl-sm" />
                  <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-rally-gold rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-rally-gold rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-rally-gold rounded-br-sm" />
                </div>
                <p className="text-sm text-text-secondary">
                  Point camera at the VIN barcode
                </p>
              </div>
            )}

            {/* Manual mode */}
            {mode === 'manual' && (
              <div className="flex flex-col gap-4 w-full">
                <Input
                  ref={inputRef}
                  label="VIN or Stock Number"
                  placeholder="Enter VIN or stock #"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSubmit();
                  }}
                  className="font-mono uppercase tracking-wider"
                />
                <Button
                  variant="primary"
                  onClick={handleManualSubmit}
                  disabled={!manualValue.trim()}
                  className="w-full"
                >
                  Look Up Vehicle
                </Button>
              </div>
            )}
          </div>

          {/* Status area */}
          {status !== 'idle' && (
            <div
              className={cn(
                'mx-4 mb-4 flex items-center gap-2 rounded-rally px-3 py-2 text-sm',
                status === 'scanning' && 'bg-status-info/10 text-status-info',
                status === 'success' && 'bg-status-success/10 text-status-success',
                status === 'error' && 'bg-status-error/10 text-status-error'
              )}
            >
              {status === 'success' && <Check className="h-4 w-4 shrink-0" />}
              {status === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
              <span className="truncate">{statusMessage}</span>
            </div>
          )}

          {/* Bottom safe area padding for mobile */}
          <div className="h-6 sm:h-4" />
        </div>
      </>
    );
  }
);

ScanSheet.displayName = 'ScanSheet';

export { ScanSheet };
export type { ScanMode };
