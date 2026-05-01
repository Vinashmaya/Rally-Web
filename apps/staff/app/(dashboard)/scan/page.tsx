'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { ScanLine, Nfc, QrCode, Keyboard, Clock, Trash2, ChevronRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  type ScanMode,
} from '@rally/ui';

// ---------------------------------------------------------------------------
// Recent scans — localStorage backed
// ---------------------------------------------------------------------------

interface RecentScan {
  value: string; // VIN or stock number
  scannedAt: number; // timestamp ms
  method: ScanMode;
}

const RECENT_SCANS_KEY = 'rally_recent_scans';
const MAX_RECENT_SCANS = 5;

function loadRecentScans(): RecentScan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentScan[];
  } catch {
    return [];
  }
}

function saveRecentScans(scans: RecentScan[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
  } catch {
    // localStorage full or unavailable
  }
}

function addRecentScan(value: string, method: ScanMode): RecentScan[] {
  const existing = loadRecentScans().filter((s) => s.value !== value);
  const next: RecentScan[] = [
    { value, scannedAt: Date.now(), method },
    ...existing,
  ].slice(0, MAX_RECENT_SCANS);
  saveRecentScans(next);
  return next;
}

function clearRecentScans(): RecentScan[] {
  saveRecentScans([]);
  return [];
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatScanTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// NFC support check
// ---------------------------------------------------------------------------

function isNfcSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'NDEFReader' in window;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>('manual');
  const [manualValue, setManualValue] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const nfcReaderRef = useRef<NDEFReader | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // QR camera scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const qrControlsRef = useRef<IScannerControls | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Load recent scans on mount
  useEffect(() => {
    setRecentScans(loadRecentScans());
    setNfcSupported(isNfcSupported());
  }, []);

  // Focus manual input when switching to manual mode
  useEffect(() => {
    if (mode === 'manual') {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  // Handle a successful scan/lookup
  const handleScan = useCallback(
    (value: string) => {
      const trimmed = value.trim().toUpperCase();
      if (!trimmed) return;

      const updated = addRecentScan(trimmed, mode);
      setRecentScans(updated);
      router.push(`/inventory/${encodeURIComponent(trimmed)}`);
    },
    [mode, router]
  );

  // Manual submit
  const handleManualSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = manualValue.trim().toUpperCase();
      if (!trimmed) return;
      handleScan(trimmed);
      setManualValue('');
    },
    [manualValue, handleScan]
  );

  // Start NFC scanning
  const startNfcScan = useCallback(async () => {
    if (!isNfcSupported()) {
      setNfcError('Web NFC requires Chrome on Android.');
      return;
    }

    try {
      setNfcScanning(true);
      setNfcError(null);

      const reader = new NDEFReader();
      nfcReaderRef.current = reader;

      reader.addEventListener('reading', (event: NDEFReadingEvent) => {
        const message = event.message;
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding ?? 'utf-8');
            const text = decoder.decode(record.data);
            if (text) {
              handleScan(text);
              setNfcScanning(false);
              return;
            }
          }
          if (record.recordType === 'url') {
            const decoder = new TextDecoder();
            const url = decoder.decode(record.data);
            // Extract VIN from Rally NFC URL (e.g., rally.vin/v/VIN)
            const vinMatch = url.match(/\/v\/([A-HJ-NPR-Z0-9]{17})/i);
            if (vinMatch?.[1]) {
              handleScan(vinMatch[1]);
              setNfcScanning(false);
              return;
            }
          }
        }
        setNfcError('Tag did not contain a valid VIN.');
        setNfcScanning(false);
      });

      reader.addEventListener('readingerror', () => {
        setNfcError('Failed to read NFC tag. Try again.');
        setNfcScanning(false);
      });

      await reader.scan();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'NFC scan failed.';
      setNfcError(message);
      setNfcScanning(false);
    }
  }, [handleScan]);

  // Stop QR camera scanning + release stream
  const stopQrScan = useCallback(() => {
    if (qrControlsRef.current) {
      try {
        qrControlsRef.current.stop();
      } catch {
        // ignore — controls may already be stopped
      }
      qrControlsRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setQrScanning(false);
  }, []);

  // Start QR camera scanning
  const startQrScan = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setQrError('Camera not supported on this device.');
      return;
    }

    setQrError(null);
    setQrScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      qrStreamRef.current = stream;

      const videoEl = videoRef.current;
      if (!videoEl) {
        stream.getTracks().forEach((t) => t.stop());
        qrStreamRef.current = null;
        setQrScanning(false);
        return;
      }

      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {
        /* play() may reject if user navigates away — handled by cleanup */
      });

      const reader = new BrowserMultiFormatReader();
      qrReaderRef.current = reader;

      const controls = await reader.decodeFromVideoElement(videoEl, (result) => {
        if (!result) return;
        const text = result.getText().trim();
        if (!text) return;

        // Rally NFC/QR URL → extract VIN; otherwise use text as-is (VIN or stock)
        const vinFromUrl = text.match(/\/v\/([A-HJ-NPR-Z0-9]{17})/i);
        const value = vinFromUrl?.[1] ?? text;

        // Stop the reader + release stream before navigating
        if (qrControlsRef.current) {
          try {
            qrControlsRef.current.stop();
          } catch {
            // ignore
          }
          qrControlsRef.current = null;
        }
        if (qrStreamRef.current) {
          qrStreamRef.current.getTracks().forEach((t) => t.stop());
          qrStreamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setQrScanning(false);
        handleScan(value);
      });

      qrControlsRef.current = controls;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access denied.';
      setQrError(message);
      setQrScanning(false);
      if (qrStreamRef.current) {
        qrStreamRef.current.getTracks().forEach((t) => t.stop());
        qrStreamRef.current = null;
      }
    }
  }, [handleScan]);

  // Auto-start QR when entering QR mode; stop when leaving
  useEffect(() => {
    if (mode === 'qr') {
      void startQrScan();
    } else {
      stopQrScan();
    }
    return () => {
      stopQrScan();
    };
  }, [mode, startQrScan, stopQrScan]);

  // Cleanup on unmount — stop any active stream and clear refs
  useEffect(() => {
    return () => {
      stopQrScan();
      nfcReaderRef.current = null;
    };
  }, [stopQrScan]);

  // Clear recent scans
  const handleClearRecent = useCallback(() => {
    setRecentScans(clearRecentScans());
  }, []);

  const methodIcon = (method: ScanMode) => {
    switch (method) {
      case 'nfc':
        return <Nfc className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />;
      case 'qr':
        return <QrCode className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />;
      case 'manual':
        return <Keyboard className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Scan</h1>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)]">
        {[
          { value: 'nfc' as const, label: 'NFC', icon: Nfc },
          { value: 'qr' as const, label: 'QR', icon: QrCode },
          { value: 'manual' as const, label: 'Manual', icon: Keyboard },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-rally)] text-sm font-medium transition-all duration-150 cursor-pointer ${
              mode === value
                ? 'bg-[var(--rally-gold-muted)] text-[var(--rally-gold)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-base)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Scan content area */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center min-h-[280px] py-8">
          {/* NFC Mode */}
          {mode === 'nfc' && (
            <div className="flex flex-col items-center gap-6 text-center">
              {nfcSupported ? (
                <>
                  <div className="relative">
                    <div className="rounded-full bg-[var(--rally-gold-muted)] p-8">
                      <Nfc
                        className="h-12 w-12 text-[var(--rally-gold)]"
                        strokeWidth={1.5}
                      />
                    </div>
                    {nfcScanning && (
                      <div className="absolute inset-0 rounded-full border-2 border-[var(--rally-gold)]/30 animate-ping" />
                    )}
                  </div>

                  {nfcScanning ? (
                    <>
                      <p className="text-sm text-[var(--text-primary)] font-medium">
                        Listening for NFC tags...
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Tap your phone on a Rally NFC tag
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Tap your phone on a Rally NFC tag
                      </p>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={startNfcScan}
                      >
                        Start Scanning
                      </Button>
                    </>
                  )}

                  {nfcError && (
                    <p className="text-xs text-[var(--status-error)]">
                      {nfcError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-full bg-[var(--surface-overlay)] p-8">
                    <Nfc
                      className="h-12 w-12 text-[var(--text-disabled)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Web NFC requires Chrome on Android
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                    Your browser doesn&apos;t support Web NFC. Use QR or manual
                    entry instead.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMode('manual')}
                  >
                    Switch to Manual Entry
                  </Button>
                </>
              )}
            </div>
          )}

          {/* QR Mode */}
          {mode === 'qr' && (
            <div className="flex flex-col items-center gap-4 text-center w-full">
              {/* Camera viewfinder — live video */}
              <div className="relative w-full aspect-square max-w-[280px] overflow-hidden rounded-[var(--radius-rally-lg)] border border-[var(--surface-border)] bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                {!qrScanning && !qrError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-overlay)]">
                    <QrCode
                      className="h-12 w-12 text-[var(--text-disabled)]"
                      strokeWidth={1}
                    />
                  </div>
                )}
                {/* Corner markers */}
                <div className="pointer-events-none absolute top-3 left-3 h-7 w-7 border-t-2 border-l-2 border-[var(--rally-gold)] rounded-tl-sm" />
                <div className="pointer-events-none absolute top-3 right-3 h-7 w-7 border-t-2 border-r-2 border-[var(--rally-gold)] rounded-tr-sm" />
                <div className="pointer-events-none absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-[var(--rally-gold)] rounded-bl-sm" />
                <div className="pointer-events-none absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-[var(--rally-gold)] rounded-br-sm" />
                {/* Sweep line */}
                {qrScanning && (
                  <div
                    className="pointer-events-none absolute left-3 right-3 h-px bg-gradient-to-r from-transparent via-[var(--rally-gold)] to-transparent"
                    style={{ animation: 'rally-sweep 2s ease-in-out infinite' }}
                  />
                )}
                <style jsx>{`
                  @keyframes rally-sweep {
                    0% { top: 12px; }
                    50% { top: calc(100% - 12px); }
                    100% { top: 12px; }
                  }
                `}</style>
              </div>

              {qrScanning && !qrError && (
                <p className="text-sm text-[var(--text-secondary)]">
                  Point camera at a VIN barcode or QR
                </p>
              )}

              {qrError && (
                <>
                  <p className="text-sm text-[var(--status-error)]">{qrError}</p>
                  <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                    Camera access is required for QR scanning. Use manual entry instead.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setMode('manual')}
                  >
                    Switch to Manual Entry
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Manual Mode */}
          {mode === 'manual' && (
            <div className="flex flex-col gap-4 w-full max-w-md">
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                <Input
                  ref={inputRef}
                  label="VIN or Stock Number"
                  placeholder="Enter VIN or stock #"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-wider"
                  startIcon={<ScanLine className="h-4 w-4" />}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!manualValue.trim()}
                  className="w-full"
                >
                  Look Up Vehicle
                </Button>
              </form>
              <p className="text-xs text-[var(--text-tertiary)] text-center">
                Enter a 17-character VIN or your dealership stock number
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Recent Scans
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClearRecent}
                className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-[var(--surface-border)]">
              {recentScans.map((scan) => (
                <button
                  key={`${scan.value}-${scan.scannedAt}`}
                  type="button"
                  onClick={() => handleScan(scan.value)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-overlay)] transition-colors cursor-pointer text-left"
                >
                  {methodIcon(scan.method)}
                  <span className="flex-1 font-mono text-sm font-medium text-[var(--rally-gold)]">
                    {scan.value}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                    {formatScanTime(scan.scannedAt)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-disabled)]" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Web NFC type declarations (not in standard lib)
// ---------------------------------------------------------------------------

declare class NDEFReader {
  addEventListener(type: 'reading', listener: (event: NDEFReadingEvent) => void): void;
  addEventListener(type: 'readingerror', listener: () => void): void;
  scan(): Promise<void>;
}

interface NDEFReadingEvent extends Event {
  message: NDEFMessage;
  serialNumber: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  data: DataView;
  encoding?: string;
  lang?: string;
}
