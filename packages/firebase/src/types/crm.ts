// CRM types — matches iOS CrmCustomer.swift EXACTLY
// Firestore collection: crmCustomers/{id}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// CrmSource — matches iOS CrmCustomer.crmSource enum
// ---------------------------------------------------------------------------

export type CrmSource = 'driveentric' | 'elead' | 'manual';

export const CRM_SOURCE_VALUES = ['driveentric', 'elead', 'manual'] as const;

/** Display names for CrmSource */
export const CRM_SOURCE_DISPLAY: Record<CrmSource, string> = {
  driveentric: 'DriveCentric',
  elead: 'eLead',
  manual: 'Manual Entry',
} as const;

// ---------------------------------------------------------------------------
// CrmCustomer — matches iOS CrmCustomer struct (Firestore document)
// ---------------------------------------------------------------------------

export interface CrmCustomer {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  email?: string;
  source?: string;
  dealStage?: string;
  assignedTo?: string;
  assignedToName?: string;
  vehicleOfInterest?: string;
  lastInteraction?: Date;
  notes?: string;
  dealershipId: string;
  crmSource: CrmSource;
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
  source: z.string().optional(),
  dealStage: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  vehicleOfInterest: z.string().optional(),
  lastInteraction: z.coerce.date().optional(),
  notes: z.string().optional(),
  dealershipId: z.string().min(1),
  crmSource: z.enum(CRM_SOURCE_VALUES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CrmCustomerSchema = z.infer<typeof crmCustomerSchema>;
