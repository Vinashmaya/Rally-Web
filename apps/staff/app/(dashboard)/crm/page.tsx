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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CustomerSource = 'Walk-in' | 'Phone' | 'Web Lead' | 'Referral';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  lastInteraction: string;
  interestedVehicles: string[];
  source: CustomerSource;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'John Anderson',
    phone: '(615) 555-0101',
    email: 'john.anderson@email.com',
    lastInteraction: 'Today',
    interestedVehicles: ['R1234'],
    source: 'Walk-in',
  },
  {
    id: 'c2',
    name: 'Sarah Mitchell',
    phone: '(615) 555-0202',
    email: 'sarah.m@email.com',
    lastInteraction: 'Yesterday',
    interestedVehicles: ['R2345', 'R3456'],
    source: 'Web Lead',
  },
  {
    id: 'c3',
    name: 'Mike Torres',
    phone: '(615) 555-0303',
    email: 'mtorres@email.com',
    lastInteraction: '3 days ago',
    interestedVehicles: ['R4567'],
    source: 'Phone',
  },
  {
    id: 'c4',
    name: 'Emily Chen',
    phone: '(615) 555-0404',
    email: 'echen@email.com',
    lastInteraction: '1 week ago',
    interestedVehicles: [],
    source: 'Referral',
  },
  {
    id: 'c5',
    name: 'David Williams',
    phone: '(615) 555-0505',
    email: 'dwilliams@email.com',
    lastInteraction: '2 days ago',
    interestedVehicles: ['R5678'],
    source: 'Walk-in',
  },
] as const;

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

const SOURCE_CONFIG = {
  'Walk-in': { variant: 'gold' as const },
  'Phone': { variant: 'info' as const },
  'Web Lead': { variant: 'success' as const },
  'Referral': { variant: 'warning' as const },
} as const;

// ---------------------------------------------------------------------------
// Customer card
// ---------------------------------------------------------------------------

interface CustomerCardProps {
  customer: Customer;
  onSelect: (customer: Customer) => void;
}

function CustomerCard({ customer, onSelect }: CustomerCardProps) {
  const sourceConfig = SOURCE_CONFIG[customer.source];

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
              <Badge variant={sourceConfig.variant} size="sm">
                {customer.source}
              </Badge>
            </div>
          </div>

          {/* Contact info */}
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-secondary)]">{customer.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-secondary)]">{customer.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">
                Last contact: {customer.lastInteraction}
              </span>
            </div>
          </div>

          {/* Interested vehicles */}
          {customer.interestedVehicles.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-[var(--text-tertiary)]" />
              <div className="flex flex-wrap gap-1">
                {customer.interestedVehicles.map((stk) => (
                  <span
                    key={stk}
                    className="inline-flex items-center rounded-full bg-[var(--rally-gold-muted)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--rally-gold)]"
                  >
                    {stk}
                  </span>
                ))}
              </div>
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
// Page
// ---------------------------------------------------------------------------

export default function CRMPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_CUSTOMERS;
    const q = searchQuery.toLowerCase();
    return MOCK_CUSTOMERS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectCustomer = (customer: Customer) => {
    // TODO: Navigate to customer detail page when built
    toast({
      type: 'info',
      title: `${customer.name}`,
      description: 'Customer detail view coming soon.',
    });
  };

  const isSearching = searchQuery.trim().length > 0;

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
          {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
        </Badge>
      </div>

      {/* Customer list */}
      {filteredCustomers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredCustomers.map((customer) => (
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
          title="No customers found"
          description={`No results for "${searchQuery}". Try a different search term.`}
        />
      )}

      {/* Info footer */}
      <p className="text-xs text-[var(--text-tertiary)] text-center">
        CRM data will sync from your dealership&apos;s DMS in real-time.
      </p>
    </div>
  );
}
