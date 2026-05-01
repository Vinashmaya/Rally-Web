'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  Clock,
  User,
  Tag,
  Car,
  FileText,
  Hash,
  Building2,
  AlertCircle,
  MessageCircle,
  Inbox,
  Send,
  StickyNote,
} from 'lucide-react';
import { z } from 'zod';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Skeleton,
  useToast,
} from '@rally/ui';
import { authFetch, useDocument } from '@rally/firebase';
import type {
  CrmCustomer,
  CrmContactHistoryItem,
  CrmNote,
} from '@rally/firebase';
import {
  crmContactEntrySchema,
  crmContactHistoryItemSchema,
  crmConversationPreviewSchema,
  crmNoteSchema,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// CRM Detail page — operates on the shared @rally/firebase CrmCustomer type
// (which mirrors iOS Models/CrmCustomer.swift). The Firestore listener may
// return a partial document during enrichment, so all of CrmCustomer's
// optional fields are still optional here. The non-shared concern is the
// loose listener payload, so we widen `id` and the required name fields to
// optional via Partial below.
// ---------------------------------------------------------------------------

type CustomerDoc = Partial<CrmCustomer> & { id: string };

// ---------------------------------------------------------------------------
// Zod schema for the VPS /api/crm-customer-detail proxy response.
// The proxy forwards the upstream JSON body 1:1. We reuse the shared
// sub-schemas from @rally/firebase to keep wire shapes locked to iOS.
// ---------------------------------------------------------------------------

const customerDetailResponseSchema = z.object({
  contactHistory: z.array(crmContactHistoryItemSchema).optional().nullable(),
  notes: z.array(crmNoteSchema).optional().nullable(),
  conversationPreview: crmConversationPreviewSchema.optional().nullable(),
  // Some upstream variants also echo phones/emails/etc. — accept passthrough.
  phones: z.array(crmContactEntrySchema).optional().nullable(),
  emails: z.array(crmContactEntrySchema).optional().nullable(),
});

type CustomerDetailResponse = z.infer<typeof customerDetailResponseSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first?: string, last?: string, full?: string): string {
  const f = first?.trim()?.[0] ?? '';
  const l = last?.trim()?.[0] ?? '';
  const initials = (f + l).trim();
  if (initials) return initials.toUpperCase();
  if (full) {
    const parts = full.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (a + b).toUpperCase();
  }
  return '?';
}

function formatPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === 'Unknown') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function bestPhone(c: CustomerDoc): string | null {
  if (c.phone && c.phone !== 'Unknown' && c.phone.length > 0) return c.phone;
  return c.phones?.[0]?.value ?? null;
}

function bestEmail(c: CustomerDoc): string | null {
  if (c.email && c.email !== 'Unknown' && c.email.length > 0) return c.email;
  return c.emails?.[0]?.value ?? null;
}

function locationString(c: CustomerDoc): string | null {
  const city = c.city?.trim();
  const state = c.state?.trim();
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}

function relativeFromDate(date: Date | undefined): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
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

function formatHistoryDate(raw: string | undefined): string | null {
  if (!raw) return null;
  // Try ISO8601, ISO8601 w/o fractional, or DC local (no TZ).
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return raw;
}

function isOutgoingHistoryItem(item: CrmContactHistoryItem): boolean {
  const t = item.type.toLowerCase();
  const h = (item.header ?? '').toLowerCase();
  if (t.startsWith('outgoing') || t.startsWith('outbound')) return true;
  if (h.includes('outbound') || h.includes('send')) return true;
  return false;
}

function channelLabel(item: CrmContactHistoryItem): string {
  if (item.header && item.header.length > 0) return item.header;
  const t = item.type.toLowerCase();
  if (t.includes('sms') || t.includes('text')) return 'Text';
  if (t.includes('email')) return 'Email';
  if (t.includes('call') || t.includes('phone')) return 'Call';
  if (t.includes('planned')) return 'Scheduled';
  if (t.includes('logged')) return 'Activity';
  return item.channel ?? item.type;
}

function ChannelIcon({
  item,
  className,
}: {
  item: CrmContactHistoryItem;
  className?: string;
}) {
  const t = item.type.toLowerCase();
  const h = (item.header ?? '').toLowerCase();
  const combined = `${t} ${h}`;
  if (combined.includes('sms') || combined.includes('text'))
    return <MessageSquare className={className} />;
  if (combined.includes('email')) return <Mail className={className} />;
  if (combined.includes('call') || combined.includes('phone'))
    return <Phone className={className} />;
  if (combined.includes('note')) return <StickyNote className={className} />;
  if (combined.includes('planned') || combined.includes('schedule') || combined.includes('task'))
    return <Clock className={className} />;
  return isOutgoingHistoryItem(item) ? (
    <Send className={className} />
  ) : (
    <Inbox className={className} />
  );
}

function stableHistoryKey(item: CrmContactHistoryItem, index: number): string {
  return `${item.date ?? 'no-date'}-${item.type}-${(item.text ?? '').slice(0, 24)}-${index}`;
}

function stableNoteKey(note: CrmNote, index: number): string {
  return `${note.date ?? 'no-date'}-${(note.text ?? '').slice(0, 24)}-${index}`;
}

// ---------------------------------------------------------------------------
// UI subcomponents
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
      <span className="w-28 shrink-0 text-xs text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary break-words">{value}</span>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rally-goldMuted">
        <Icon className="h-4 w-4 text-rally-gold" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
          {label}
        </span>
        <span className="truncate text-sm font-medium text-text-primary">{value}</span>
      </div>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block rounded-rally focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

function QuickAction({
  icon: Icon,
  label,
  href,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  variant: 'success' | 'info' | 'gold';
}) {
  const styles =
    variant === 'success'
      ? 'bg-status-success/15 text-status-success hover:bg-status-success/25'
      : variant === 'info'
        ? 'bg-status-info/15 text-status-info hover:bg-status-info/25'
        : 'bg-rally-goldMuted text-rally-gold hover:bg-rally-goldMuted/80';

  return (
    <a
      href={href}
      className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-rally-lg px-3 py-4 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold ${styles}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-col items-center gap-3 py-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-16 flex-1" />
        <Skeleton className="h-16 flex-1" />
        <Skeleton className="h-16 flex-1" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CrmCustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const customerId = params.customerId;

  // Real-time Firestore listener — picks up async enrichment writes from
  // the VPS without a manual refresh (Rule 7).
  const { data: customer, loading, error } = useDocument<CustomerDoc>(
    customerId ? `crmCustomers/${customerId}` : '',
  );

  // Enriched detail (contactHistory, notes, conversation preview) from the
  // VPS via an internal proxy route. Fetched once when we have a stable id.
  const [enrichment, setEnrichment] = useState<CustomerDetailResponse | null>(
    null,
  );
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);

  // Surface Firestore errors via Toast (Rule 11)
  useEffect(() => {
    if (error) {
      toast({
        type: 'error',
        title: 'Failed to load customer',
        description: error.message,
      });
    }
  }, [error, toast]);

  // Fetch enrichment once we know the dcCustomerId.
  // Prefer dcCustomerId (DriveCentric) for the upstream lookup; fall back to
  // the Firestore doc ID if the upstream accepts that.
  useEffect(() => {
    if (!customer) return;

    const lookupId = customer.dcCustomerId ?? customer.id;
    if (!lookupId) return;

    // If the Firestore doc already has the enrichment fields, no need to
    // refetch — the listener will keep them fresh.
    const alreadyEnriched =
      (customer.contactHistory && customer.contactHistory.length > 0) ||
      (customer.notes && customer.notes.length > 0) ||
      customer.conversationPreview != null;
    if (alreadyEnriched) {
      setEnrichment(null);
      setEnrichmentError(null);
      return;
    }

    let cancelled = false;
    setEnrichmentLoading(true);
    setEnrichmentError(null);

    (async () => {
      try {
        const res = await authFetch(
          `/api/crm/${encodeURIComponent(lookupId)}`,
          { method: 'GET' },
        );
        if (cancelled) return;

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            body?.error ?? `Failed to load detail (HTTP ${res.status})`,
          );
        }

        const json = (await res.json()) as unknown;
        const parsed = customerDetailResponseSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error('Unexpected detail response shape');
        }
        if (cancelled) return;
        setEnrichment(parsed.data);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load detail';
        setEnrichmentError(message);
        toast({
          type: 'warning',
          title: 'Detail unavailable',
          description: message,
        });
      } finally {
        if (!cancelled) setEnrichmentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, toast]);

  // Merge: Firestore doc fields take precedence over enrichment fetch
  // (the listener is the source of truth once enrichment lands in Firestore).
  const merged: CustomerDoc | null = useMemo(() => {
    if (!customer) return null;
    return {
      ...customer,
      conversationPreview:
        customer.conversationPreview ?? enrichment?.conversationPreview ?? undefined,
      contactHistory:
        customer.contactHistory && customer.contactHistory.length > 0
          ? customer.contactHistory
          : enrichment?.contactHistory ?? undefined,
      notes:
        customer.notes && customer.notes.length > 0
          ? customer.notes
          : enrichment?.notes ?? undefined,
      phones:
        customer.phones && customer.phones.length > 0
          ? customer.phones
          : enrichment?.phones ?? undefined,
      emails:
        customer.emails && customer.emails.length > 0
          ? customer.emails
          : enrichment?.emails ?? undefined,
    };
  }, [customer, enrichment]);

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/crm');
    }
  }, [router]);

  // -------------------------------------------------------------------------
  // Render — four states (Rule 16)
  // -------------------------------------------------------------------------

  // Loading
  if (loading) {
    return <DetailSkeleton />;
  }

  // Error (Firestore-level, doc unavailable)
  if (error && !customer) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Customers
        </Button>
        <EmptyState
          icon={AlertCircle}
          title="Failed to load customer"
          description={error.message}
          action={
            <Button variant="secondary" size="sm" onClick={goBack}>
              Back to Customers
            </Button>
          }
        />
      </div>
    );
  }

  // Empty / not found
  if (!merged) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Customers
        </Button>
        <EmptyState
          icon={User}
          title="Customer not found"
          description={
            customerId
              ? `No customer record exists for ID ${customerId}. It may have been removed or you may not have access.`
              : 'No customer ID was provided.'
          }
          action={
            <Button variant="secondary" size="sm" onClick={goBack}>
              Back to Customers
            </Button>
          }
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const composedName = [merged.firstName, merged.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const fullName =
    merged.fullName && merged.fullName.length > 0
      ? merged.fullName
      : composedName.length > 0
        ? composedName
        : 'Unknown Customer';
  const phoneRaw = bestPhone(merged);
  const phoneFormatted = formatPhone(phoneRaw ?? undefined);
  const emailValue = bestEmail(merged);
  const loc = locationString(merged);
  const lastInteractionAgo = relativeFromDate(merged.lastInteraction);
  const initials = getInitials(merged.firstName, merged.lastName, merged.fullName);

  const additionalPhones =
    merged.phones && merged.phones.length > 1
      ? merged.phones.slice(1)
      : [];
  const additionalEmails =
    merged.emails && merged.emails.length > 1
      ? merged.emails.slice(1)
      : [];

  const hasDeal =
    !!(merged.dealStage && merged.dealStage.length > 0 && merged.dealStage !== 'None') ||
    !!(merged.vehicle && merged.vehicle.length > 0);

  const hasTeam = !!(merged.salesperson1 || merged.salesperson2 || merged.bdc);

  return (
    <div className="flex flex-col gap-6">
      {/* Back navigation */}
      <div>
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to Customers
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar size="lg" name={fullName} className="h-20 w-20 text-2xl" />
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
          {fullName}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          {loc && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {loc}
            </span>
          )}
          {lastInteractionAgo && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {lastInteractionAgo}
            </span>
          )}
          {merged.assignedToName && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden />
              {merged.assignedToName}
            </span>
          )}
        </div>
        {/* Hide initials display element from screen readers — Avatar already labels it */}
        <span className="sr-only">{initials}</span>
      </div>

      {/* Quick Actions */}
      {(phoneRaw || emailValue) && (
        <div className="flex gap-3">
          {phoneRaw && (
            <QuickAction
              icon={Phone}
              label="Call"
              variant="success"
              href={`tel:${digitsOnly(phoneRaw)}`}
            />
          )}
          {phoneRaw && (
            <QuickAction
              icon={MessageSquare}
              label="Text"
              variant="info"
              href={`sms:${digitsOnly(phoneRaw)}`}
            />
          )}
          {emailValue && (
            <QuickAction
              icon={Mail}
              label="Email"
              variant="gold"
              href={`mailto:${emailValue}`}
            />
          )}
        </div>
      )}

      {/* Deal */}
      {hasDeal && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">Deal</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-surface-border">
              {merged.dealStage && merged.dealStage !== 'None' && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs text-text-secondary">Stage</span>
                  <Badge variant="gold" size="sm">
                    {merged.dealStage}
                  </Badge>
                </div>
              )}
              {merged.vehicle && (
                <DetailRow icon={Car} label="Vehicle" value={merged.vehicle} />
              )}
              {merged.vehicleVin && (
                <DetailRow icon={Hash} label="VIN" value={merged.vehicleVin} />
              )}
              {merged.vehicleStock && (
                <DetailRow
                  icon={Tag}
                  label="Stock #"
                  value={merged.vehicleStock}
                />
              )}
              {merged.vehicleMileage != null && (
                <DetailRow
                  icon={Car}
                  label="Mileage"
                  value={`${merged.vehicleMileage.toLocaleString()} mi`}
                />
              )}
              {merged.sourceType && merged.sourceType !== 'None' && (
                <DetailRow
                  icon={Tag}
                  label="Source"
                  value={merged.sourceType}
                />
              )}
              {merged.sourceDescription && (
                <DetailRow
                  icon={Tag}
                  label="Source Detail"
                  value={merged.sourceDescription}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Contact Info
          </h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
            {phoneFormatted && (
              <ContactRow
                icon={Phone}
                label="Phone"
                value={phoneFormatted}
                href={`tel:${digitsOnly(phoneRaw ?? '')}`}
              />
            )}
            {additionalPhones.map((entry, i) => (
              <ContactRow
                key={`phone-${i}-${entry.value}`}
                icon={Phone}
                label={entry.type ?? 'Phone'}
                value={formatPhone(entry.value) ?? entry.value}
                href={`tel:${digitsOnly(entry.value)}`}
              />
            ))}
            {emailValue && (
              <ContactRow
                icon={Mail}
                label="Email"
                value={emailValue}
                href={`mailto:${emailValue}`}
              />
            )}
            {additionalEmails.map((entry, i) => (
              <ContactRow
                key={`email-${i}-${entry.value}`}
                icon={Mail}
                label={entry.type ?? 'Email'}
                value={entry.value}
                href={`mailto:${entry.value}`}
              />
            ))}
            {!phoneFormatted && !emailValue && (
              <p className="py-3 text-sm text-text-tertiary">
                No contact info on file.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Conversation */}
      {merged.conversationPreview && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">
              Last Conversation
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {merged.conversationPreview.lastMessage && (
                <p className="text-sm text-text-primary line-clamp-3">
                  {merged.conversationPreview.lastMessage}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                {merged.conversationPreview.lastChannel && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" aria-hidden />
                    {merged.conversationPreview.lastChannel}
                  </span>
                )}
                {merged.conversationPreview.lastMessageDate && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {formatHistoryDate(
                      merged.conversationPreview.lastMessageDate,
                    )}
                  </span>
                )}
                {merged.conversationPreview.assignedUser && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" aria-hidden />
                    {merged.conversationPreview.assignedUser}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team */}
      {hasTeam && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">Team</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-surface-border">
              {merged.salesperson1 && (
                <ContactRow
                  icon={User}
                  label="Salesperson"
                  value={`${merged.salesperson1.firstName} ${merged.salesperson1.lastName}`}
                />
              )}
              {merged.salesperson2 && (
                <ContactRow
                  icon={User}
                  label="Salesperson 2"
                  value={`${merged.salesperson2.firstName} ${merged.salesperson2.lastName}`}
                />
              )}
              {merged.bdc && (
                <ContactRow
                  icon={User}
                  label="BDC"
                  value={`${merged.bdc.firstName} ${merged.bdc.lastName}`}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact History (Timeline) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Contact History
            </h2>
            {enrichmentLoading && (
              <span className="text-xs text-text-tertiary">Loading…</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {merged.contactHistory && merged.contactHistory.length > 0 ? (
            <ol className="flex flex-col">
              {merged.contactHistory.map((item, i) => {
                const isOutgoing = isOutgoingHistoryItem(item);
                return (
                  <li
                    key={stableHistoryKey(item, i)}
                    className="flex items-start gap-3 border-b border-surface-border py-3 last:border-b-0"
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isOutgoing
                          ? 'bg-rally-goldMuted text-rally-gold'
                          : 'bg-surface-overlay text-text-secondary'
                      }`}
                    >
                      <ChannelIcon item={item} className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-xs font-medium text-text-primary">
                          {item.header
                            ? channelLabel(item)
                            : `${isOutgoing ? 'Outgoing' : 'Incoming'} ${channelLabel(item)}`}
                        </span>
                        {formatHistoryDate(item.date) && (
                          <span className="text-[11px] text-text-tertiary">
                            {formatHistoryDate(item.date)}
                          </span>
                        )}
                      </div>
                      {item.text && item.text.length > 0 && (
                        <p className="text-sm text-text-secondary line-clamp-3">
                          {item.text}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : enrichmentError ? (
            <p className="py-3 text-sm text-status-error">{enrichmentError}</p>
          ) : enrichmentLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <p className="py-3 text-sm text-text-tertiary">
              No contact history yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Notes</h2>
        </CardHeader>
        <CardContent>
          {merged.notes && merged.notes.length > 0 ? (
            <ul className="flex flex-col">
              {merged.notes.map((note, i) => (
                <li
                  key={stableNoteKey(note, i)}
                  className="flex flex-col gap-1.5 border-b border-surface-border py-3 last:border-b-0"
                >
                  {note.text && (
                    <p className="text-sm text-text-primary">{note.text}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
                    {note.author && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden />
                        {note.author}
                      </span>
                    )}
                    {note.date && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatHistoryDate(note.date)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-text-tertiary">No notes yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Vehicle of Interest (legacy single-string field, when no full deal exists) */}
      {!hasDeal && merged.vehicleOfInterest && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">
              Vehicle of Interest
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 py-2">
              <Car className="h-4 w-4 text-text-tertiary" aria-hidden />
              <span className="font-mono text-sm text-rally-gold">
                {merged.vehicleOfInterest}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">Details</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-surface-border">
            {merged.storeName && (
              <DetailRow
                icon={Building2}
                label="Store"
                value={merged.storeName}
              />
            )}
            {merged.dcCustomerId && (
              <DetailRow
                icon={Hash}
                label="CRM ID"
                value={merged.dcCustomerId}
              />
            )}
            {merged.dcDealId && (
              <DetailRow
                icon={FileText}
                label="Deal ID"
                value={merged.dcDealId}
              />
            )}
            <DetailRow icon={Hash} label="Doc ID" value={merged.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
