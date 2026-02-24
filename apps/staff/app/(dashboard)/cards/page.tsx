'use client';

import { useState } from 'react';
import {
  CreditCard,
  Wallet,
  Nfc,
  Link2,
  Share2,
  QrCode,
  Phone,
  Mail,
  MapPin,
  Building2,
  TrendingUp,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Skeleton,
} from '@rally/ui';
import { useToast } from '@rally/ui';

// ---------------------------------------------------------------------------
// Mock profile data
// ---------------------------------------------------------------------------

const MOCK_PROFILE = {
  name: 'Trey Adcox',
  role: 'Sales Consultant',
  dealership: 'Gallatin CDJR',
  phone: '(615) 555-1234',
  email: 'trey@gallatincdjr.com',
  address: '1100 Nashville Pike, Gallatin, TN 37066',
  sharesThisMonth: 23,
  lastShared: '2 hours ago',
} as const;

// ---------------------------------------------------------------------------
// QR Code placeholder
// ---------------------------------------------------------------------------

function QRCodePlaceholder() {
  return (
    <div className="flex items-center justify-center rounded-[var(--radius-rally)] bg-[var(--surface-base)] p-4">
      {/* Mock QR code grid */}
      <div className="relative h-32 w-32">
        {/* Grid pattern */}
        <div
          className="h-full w-full rounded-sm opacity-80"
          style={{
            backgroundImage: `
              linear-gradient(45deg, var(--text-primary) 25%, transparent 25%),
              linear-gradient(-45deg, var(--text-primary) 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, var(--text-primary) 75%),
              linear-gradient(-45deg, transparent 75%, var(--text-primary) 75%)
            `,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
          }}
        />
        {/* Corner squares (QR code positioning markers) */}
        <div className="absolute top-0 left-0 h-8 w-8 rounded-sm border-[3px] border-[var(--text-primary)] bg-[var(--surface-base)]">
          <div className="absolute inset-[4px] rounded-sm bg-[var(--text-primary)]" />
        </div>
        <div className="absolute top-0 right-0 h-8 w-8 rounded-sm border-[3px] border-[var(--text-primary)] bg-[var(--surface-base)]">
          <div className="absolute inset-[4px] rounded-sm bg-[var(--text-primary)]" />
        </div>
        <div className="absolute bottom-0 left-0 h-8 w-8 rounded-sm border-[3px] border-[var(--text-primary)] bg-[var(--surface-base)]">
          <div className="absolute inset-[4px] rounded-sm bg-[var(--text-primary)]" />
        </div>
        {/* Center Rally logo placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-sm bg-[var(--surface-base)] px-1.5 py-0.5">
            <span className="font-mono text-[10px] font-bold text-[var(--rally-gold)]">R</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Business card preview
// ---------------------------------------------------------------------------

function BusinessCardPreview() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative overflow-hidden rounded-[var(--radius-rally-lg)] border-2 border-[var(--rally-gold)]/30 bg-gradient-to-br from-[var(--surface-raised)] to-[var(--surface-overlay)] p-6 shadow-xl">
        {/* Gold accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--rally-gold)] via-[var(--rally-gold-light)] to-[var(--rally-gold)]" />

        {/* Dealer logo area */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <span className="font-mono text-lg font-bold tracking-wider text-[var(--rally-gold)]">
              RALLY
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] tracking-widest uppercase">
              Digital Business Card
            </span>
          </div>
          <div className="rounded-lg bg-[var(--surface-overlay)] p-2">
            <Building2 className="h-5 w-5 text-[var(--text-secondary)]" />
          </div>
        </div>

        {/* Name & role */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-[var(--text-primary)]">
            {MOCK_PROFILE.name}
          </h3>
          <p className="text-sm text-[var(--rally-gold)]">{MOCK_PROFILE.role}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{MOCK_PROFILE.dealership}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--surface-border)] mb-4" />

        {/* Contact details */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
            <span className="text-sm text-[var(--text-primary)]">{MOCK_PROFILE.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
            <span className="text-sm text-[var(--text-primary)]">{MOCK_PROFILE.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
            <span className="text-xs text-[var(--text-secondary)]">{MOCK_PROFILE.address}</span>
          </div>
        </div>

        {/* QR code */}
        <QRCodePlaceholder />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <Skeleton variant="card" className="h-96 max-w-sm mx-auto" />
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-10" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CardsPage() {
  const { toast } = useToast();

  const handleAddToWallet = () => {
    // TODO: Generate Apple Wallet .pkpass via server route and trigger download
    // TODO: Pass Type ID: JHBT9M7Z78.pass.com.vyaxis
    toast({
      type: 'info',
      title: 'Apple Wallet integration',
      description: 'Wallet pass generation coming soon.',
    });
  };

  const handleShareNFC = () => {
    // TODO: Use Web NFC API to write vCard URL to NFC tag
    toast({
      type: 'info',
      title: 'NFC sharing',
      description: 'NFC business card sharing coming soon.',
    });
  };

  const handleCopyLink = () => {
    // TODO: Copy the real card URL to clipboard
    const mockUrl = `https://rally.vin/card/${MOCK_PROFILE.name.toLowerCase().replace(/\s+/g, '-')}`;
    navigator.clipboard.writeText(mockUrl).then(
      () => {
        toast({
          type: 'success',
          title: 'Link copied',
          description: mockUrl,
        });
      },
      () => {
        toast({
          type: 'error',
          title: 'Failed to copy',
          description: 'Could not access clipboard.',
        });
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Business Card</h1>
      </div>

      {/* Card preview */}
      <BusinessCardPreview />

      {/* Action buttons */}
      <div className="flex flex-col gap-3 mx-auto w-full max-w-sm">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleAddToWallet}
        >
          <Wallet className="h-4 w-4" />
          Add to Apple Wallet
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleShareNFC}
        >
          <Nfc className="h-4 w-4" />
          Share via NFC
        </Button>
        <Button
          variant="ghost"
          size="md"
          className="w-full"
          onClick={handleCopyLink}
        >
          <Link2 className="h-4 w-4" />
          Copy Link
        </Button>
      </div>

      {/* Stats */}
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-[var(--rally-gold)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Sharing Stats
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[var(--status-success)]" />
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                  {MOCK_PROFILE.sharesThisMonth}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Shared this month</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {MOCK_PROFILE.lastShared}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Last shared</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <p className="text-xs text-[var(--text-tertiary)] text-center max-w-sm mx-auto">
        Your business card is automatically generated from your profile.
        Contact your manager to update details.
      </p>
    </div>
  );
}
