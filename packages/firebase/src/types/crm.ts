// CRM types — matches iOS CrmCustomer.swift EXACTLY
// Firestore collection: crmCustomers/{id}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// CrmSource — matches iOS CrmCustomer.crmSource enum
// ---------------------------------------------------------------------------

export type CrmSource = 'drivecentric' | 'elead' | 'manual';

export const CRM_SOURCE_VALUES = ['drivecentric', 'elead', 'manual'] as const;

/** Display names for CrmSource */
export const CRM_SOURCE_DISPLAY: Record<CrmSource, string> = {
  drivecentric: 'DriveCentric',
  elead: 'eLead',
  manual: 'Manual Entry',
} as const;

// ---------------------------------------------------------------------------
// CrmPerson — assigned salesperson / BDC (matches iOS CrmPerson)
// ---------------------------------------------------------------------------

export interface CrmPerson {
  firstName: string;
  lastName: string;
}

export const crmPersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
});

// ---------------------------------------------------------------------------
// CrmContactEntry — phone or email entry (matches iOS CrmContactEntry)
// ---------------------------------------------------------------------------

export interface CrmContactEntry {
  value: string;
  type?: string;
}

export const crmContactEntrySchema = z.object({
  value: z.string(),
  type: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CrmConversationPreview — last conversation summary
// ---------------------------------------------------------------------------

export interface CrmConversationPreview {
  lastMessage?: string;
  lastMessageDate?: string;
  lastChannel?: string;
  assignedUser?: string;
}

export const crmConversationPreviewSchema = z.object({
  lastMessage: z.string().optional(),
  lastMessageDate: z.string().optional(),
  lastChannel: z.string().optional(),
  assignedUser: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CrmContactHistoryItem — single timeline entry
// type values: "OutgoingSms", "IncomingSms", "SystemPlanned",
// "ManualLogged", "OutboundCall", etc.
// ---------------------------------------------------------------------------

export interface CrmContactHistoryItem {
  type: string;
  text?: string;
  date?: string;
  channel?: string;
  header?: string;
}

export const crmContactHistoryItemSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
  date: z.string().optional(),
  channel: z.string().optional(),
  header: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CrmNote — free-text note attached to the customer
// ---------------------------------------------------------------------------

export interface CrmNote {
  text?: string;
  date?: string;
  author?: string;
}

export const crmNoteSchema = z.object({
  text: z.string().optional(),
  date: z.string().optional(),
  author: z.string().optional(),
});

// ---------------------------------------------------------------------------
// CrmCustomer — matches iOS CrmCustomer struct (Firestore document)
//
// All fields below mirror Models/CrmCustomer.swift. Keep these two files in
// sync whenever a new field is introduced on either platform.
// ---------------------------------------------------------------------------

export interface CrmCustomer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;

  // Primary contact (single value)
  phone?: string;
  email?: string;

  // Multi-channel contact arrays (DriveCentric returns several phones/emails)
  phones?: CrmContactEntry[];
  emails?: CrmContactEntry[];

  // Deal / vehicle of interest
  dealStage?: string;
  vehicle?: string;
  vehicleVin?: string;
  vehicleStock?: string;
  vehicleMileage?: number;
  /** Legacy single-string field used when the structured deal isn't present. */
  vehicleOfInterest?: string;

  // Source attribution
  source?: string;
  sourceType?: string;
  sourceDescription?: string;

  // Team — salespeople and BDC assigned to the customer
  salesperson1?: CrmPerson;
  salesperson2?: CrmPerson;
  bdc?: CrmPerson;

  // Legacy assignment fields (single owner)
  assignedTo?: string;
  assignedToName?: string;

  // External CRM identifiers
  dcCustomerId?: string;
  dcDealId?: string;

  // Location
  storeName?: string;
  city?: string;
  state?: string;

  // Conversation / activity enrichment
  conversationPreview?: CrmConversationPreview;
  contactHistory?: CrmContactHistoryItem[];
  notes?: CrmNote[];

  // Tenant + system
  dealershipId: string;
  crmSource: CrmSource;
  lastInteraction?: Date;
  viewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Zod Schema — runtime validation
// ---------------------------------------------------------------------------

export const crmCustomerSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  fullName: z.string().min(1),

  phone: z.string().optional(),
  email: z.string().email().optional(),

  phones: z.array(crmContactEntrySchema).optional(),
  emails: z.array(crmContactEntrySchema).optional(),

  dealStage: z.string().optional(),
  vehicle: z.string().optional(),
  vehicleVin: z.string().optional(),
  vehicleStock: z.string().optional(),
  vehicleMileage: z.number().int().nonnegative().optional(),
  vehicleOfInterest: z.string().optional(),

  source: z.string().optional(),
  sourceType: z.string().optional(),
  sourceDescription: z.string().optional(),

  salesperson1: crmPersonSchema.optional(),
  salesperson2: crmPersonSchema.optional(),
  bdc: crmPersonSchema.optional(),

  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),

  dcCustomerId: z.string().optional(),
  dcDealId: z.string().optional(),

  storeName: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  conversationPreview: crmConversationPreviewSchema.optional(),
  contactHistory: z.array(crmContactHistoryItemSchema).optional(),
  notes: z.array(crmNoteSchema).optional(),

  dealershipId: z.string().min(1),
  crmSource: z.enum(CRM_SOURCE_VALUES),
  lastInteraction: z.coerce.date().optional(),
  viewedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CrmCustomerSchema = z.infer<typeof crmCustomerSchema>;
