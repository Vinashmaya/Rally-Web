'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  User,
  Phone,
  Mail,
  Calendar,
  Tag,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Input,
  Skeleton,
  EmptyState,
} from '@rally/ui';
import { useToast } from '@rally/ui';
import { useCrmCustomers } from '@rally/firebase';
import { useTenantStore } from '@rally/services';
import type { CrmCustomer, CrmSource } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Date to a human-readable relative time string */
function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return '1 week ago';
  return `${diffWeeks} weeks ago`;
}

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

/** Map CrmSource to badge config. Falls back to 'default' for unknown sources. */
const SOURCE_BADGE_CONFIG: Record<string, { variant: 'gold' | 'info' | 'success' | 'warning' | 'default'; label: string }> = {
  driveentric: { variant: 'gold', label: 'DriveCentric' },
  elead: { variant: 'info', label: 'eLead' },
  manual: { variant: 'success', label: 'Manual' },
} as const;

function getSourceBadge(crmSource: CrmSource, source?: string): { variant: 'gold' | 'info' | 'success' | 'warning' | 'default'; label: string } {
  const config = SOURCE_BADGE_CONFIG[crmSource];
  if (config) return config;
  return { variant: 'default', label: source ?? crmSource };
}

// ---------------------------------------------------------------------------
// Display type — maps CrmCustomer to what the cards need
// ---------------------------------------------------------------------------

interface CustomerDisplay {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastInteraction: string;
  vehicleOfInterest: string | null;
  crmSource: CrmSource;
  source?: string;
}

function mapCrmCustomer(c: CrmCustomer): CustomerDisplay {
  return {
    id: c.id,
    name: c.fullName,
    phone: c.phone ?? '',
    email: c.email ?? '',
    lastInteraction: c.lastInteraction ? relativeTime(c.lastInteraction) : 'Never',
    vehicleOfInterest: c.vehicleOfInterest ?? null,
    crmSource: c.crmSource,
    source: c.source,
  };
}

// ---------------------------------------------------------------------------
// Customer card
// ---------------------------------------------------------------------------

interface CustomerCardProps {
  customer: CustomerDisplay;
  onSelect: (customer: CustomerDisplay) => void;
}

function CustomerCard({ customer, onSelect }: CustomerCardProps) {
  const sourceBadge = getSourceBadge(customer.crmSource, customer.source);

  return (
    <button
      type="button"
      onClick={() => onSelect(customer)}
      className="w-full text-left rounded-[var(--radius-rally-lg)] bg-[var(--surface-overlay)] p-4 transition-all duration-150 hover:bg-[var(--surface-border)] cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Name + Source */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--rally-gold-muted)]">
              <User className="h-4 w-4 text-[var(--rally-gold)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {customer.name}
              </h3>
              <Badge variant={sourceBadge.variant} size="sm">
                {sourceBadge.label}
              </Badge>
            </div>
          </div>

          {/* Contact info */}
          <div className="mt-3 flex flex-col gap-1">
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-[var(--text-tertiary)]" />
                <span className="text-xs text-[var(--text-secondary)]">{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-[var(--text-tertiary)]" />
                <span className="text-xs text-[var(--text-secondary)]">{customer.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">
                Last contact: {customer.lastInteraction}
              </span>
            </div>
          </div>

          {/* Vehicle of interest */}
          {customer.vehicleOfInterest && (
            <div className="mt-2 flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="inline-flex items-center rounded-full bg-[var(--rally-gold-muted)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--rally-gold)]">
                {customer.vehicleOfInterest}
              </span>
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-[var(--text-disabled)] shrink-0 mt-2" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CRMSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <Skeleton variant="card" className="h-12" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-32" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function CRMError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="rounded-full bg-[var(--status-error)]/15 p-4">
        <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load customer data</p>
      <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CRMPage() {
  const { toast } = useToast();
  const dealershipId = useTenantStore((s) => s.activeStore?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');

  // Pass search to the hook for client-side filtering within the hook
  const { customers, loading, error } = useCrmCustomers({
    dealershipId,
    search: searchQuery,
  });

  // Map CrmCustomer[] to display type
  const displayCustomers = useMemo(
    () => customers.map(mapCrmCustomer),
    [customers],
  );

  const handleSelectCustomer = (customer: CustomerDisplay) => {
    // TODO: Navigate to customer detail page when built
    toast({
      type: 'info',
      title: `${customer.name}`,
      description: 'Customer detail view coming soon.',
    });
  };

  const isSearching = searchQuery.trim().length > 0;

  // Loading state
  if (loading) return <CRMSkeleton />;

  // Error state
  if (error) return <CRMError message={error.message} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customer Search</h1>
      </div>

      {/* Search bar */}
      <Input
        placeholder="Search by name, phone, or email"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        startIcon={<Search className="h-4 w-4" />}
      />

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {isSearching ? 'Search Results' : 'Recent Customers'}
        </h2>
        <Badge variant="default" size="sm">
          {displayCustomers.length} {displayCustomers.length === 1 ? 'customer' : 'customers'}
        </Badge>
      </div>

      {/* Customer list */}
      {displayCustomers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {displayCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onSelect={handleSelectCustomer}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title={isSearching ? 'No customers found' : 'No customers yet'}
          description={
            isSearching
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'Customer data will appear here once CRM sync is active.'
          }
        />
      )}

      {/* Info footer */}
      <p className="text-xs text-[var(--text-tertiary)] text-center">
        CRM data syncs from your dealership&apos;s DMS in real-time.
      </p>
    </div>
  );
}
