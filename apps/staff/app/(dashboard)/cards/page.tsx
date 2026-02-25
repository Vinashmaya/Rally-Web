'use client';

import { useMemo } from 'react';
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
import { useAuthStore, useTenantStore } from '@rally/services';
import { USER_ROLE_DISPLAY, type UserRole } from '@rally/firebase';

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

interface BusinessCardPreviewProps {
  name: string;
  role: string;
  dealership: string;
  phone: string;
  email: string;
  address: string;
}

function BusinessCardPreview({ name, role, dealership, phone, email, address }: BusinessCardPreviewProps) {
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
            {name}
          </h3>
          <p className="text-sm text-[var(--rally-gold)]">{role}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{dealership}</p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--surface-border)] mb-4" />

        {/* Contact details */}
        <div className="flex flex-col gap-2 mb-4">
          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
              <span className="text-sm text-[var(--text-primary)]">{phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
            <span className="text-sm text-[var(--text-primary)]">{email}</span>
          </div>
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-[var(--rally-gold)]" />
              <span className="text-xs text-[var(--text-secondary)]">{address}</span>
            </div>
          )}
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
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const dealerUser = useAuthStore((s) => s.dealerUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const activeStore = useTenantStore((s) => s.activeStore);

  // Derive profile from real auth/tenant data
  const profile = useMemo(() => {
    const name = dealerUser?.displayName ?? firebaseUser?.displayName ?? 'User';
    const role = (dealerUser?.role ?? 'salesperson') as UserRole;
    const roleDisplay = USER_ROLE_DISPLAY[role] ?? 'Staff';
    const email = dealerUser?.email ?? firebaseUser?.email ?? '';
    const phone = dealerUser?.phone ?? '';
    const dealership = activeStore?.name ?? '';
    const address = activeStore
      ? `${activeStore.address}, ${activeStore.city}, ${activeStore.state} ${activeStore.zipCode}`
      : '';
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const cardUrl = `https://rally.vin/card/${slug}`;

    return { name, roleDisplay, email, phone, dealership, address, cardUrl };
  }, [dealerUser, firebaseUser, activeStore]);

  const handleAddToWallet = async () => {
    try {
      const response = await fetch('/api/wallet/generate-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          role: profile.roleDisplay,
          email: profile.email,
          phone: profile.phone,
          dealership: profile.dealership,
        }),
      });

      if (!response.ok) {
        toast({
          type: 'info',
          title: 'Apple Wallet',
          description: 'Wallet pass generation coming soon.',
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profile.name.replace(/\s+/g, '_')}_rally.pkpass`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ type: 'success', title: 'Pass downloaded', description: 'Open the file to add to Apple Wallet.' });
    } catch {
      toast({ type: 'info', title: 'Apple Wallet', description: 'Wallet pass generation coming soon.' });
    }
  };

  const handleShareNFC = async () => {
    if (!('NDEFReader' in window)) {
      toast({ type: 'info', title: 'NFC not supported', description: 'Web NFC requires Chrome on Android.' });
      return;
    }

    try {
      const NDEFReaderCtor = (window as Record<string, unknown>)['NDEFReader'] as new () => { write: (opts: Record<string, unknown>) => Promise<void> };
      const writer = new NDEFReaderCtor();
      await writer.write({
        records: [
          { recordType: 'url', data: profile.cardUrl },
          { recordType: 'text', data: `${profile.name} - ${profile.dealership}` },
        ],
      });
      toast({ type: 'success', title: 'NFC written', description: 'Business card written to NFC tag.' });
    } catch {
      toast({ type: 'error', title: 'NFC failed', description: 'Could not write to NFC tag.' });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profile.cardUrl).then(
      () => {
        toast({ type: 'success', title: 'Link copied', description: profile.cardUrl });
      },
      () => {
        toast({ type: 'error', title: 'Failed to copy', description: 'Could not access clipboard.' });
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Business Card</h1>
        <CardsSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Business Card</h1>
      </div>

      {/* Card preview — real data from auth + tenant stores */}
      <BusinessCardPreview
        name={profile.name}
        role={profile.roleDisplay}
        dealership={profile.dealership}
        phone={profile.phone}
        email={profile.email}
        address={profile.address}
      />

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

      {/* Info note */}
      <p className="text-xs text-[var(--text-tertiary)] text-center max-w-sm mx-auto">
        Your business card is automatically generated from your profile.
        Contact your manager to update details.
      </p>
    </div>
  );
}
