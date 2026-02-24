// Firestore data converters — handles serialization between Firestore and typed objects
// Converts Timestamps <-> Dates and provides typed FirestoreDataConverter instances

import {
  Timestamp,
} from 'firebase/firestore';
import type {
  DocumentData,
  QueryDocumentSnapshot,
  SnapshotOptions,
  FirestoreDataConverter,
  WithFieldValue,
} from 'firebase/firestore';
import type { Vehicle } from './types/vehicle';
import type { VehicleActivity } from './types/activity';
import type { DealerUser } from './types/user';

// ---------------------------------------------------------------------------
// Timestamp <-> Date conversion utilities
// ---------------------------------------------------------------------------

/**
 * Convert a Firestore Timestamp to a JS Date.
 * Returns undefined if input is nullish.
 */
export function timestampToDate(val: Timestamp | Date | null | undefined): Date | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return undefined;
}

/**
 * Convert a JS Date to a Firestore Timestamp.
 * Returns undefined if input is nullish.
 */
export function dateToTimestamp(val: Date | Timestamp | null | undefined): Timestamp | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Timestamp) return val;
  if (val instanceof Date) return Timestamp.fromDate(val);
  return undefined;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Recursively converts all Timestamp fields in a Firestore document to JS Dates.
 */
function convertAllTimestamps(data: DocumentData): DocumentData {
  const result: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = convertAllTimestamps(value as DocumentData);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item instanceof Timestamp ? item.toDate() : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Recursively converts all Date fields to Firestore Timestamps for writing.
 */
function convertAllDates(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      result[key] = convertAllDates(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item instanceof Date ? Timestamp.fromDate(item) : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Vehicle converter
// ---------------------------------------------------------------------------

export const vehicleConverter: FirestoreDataConverter<Vehicle> = {
  toFirestore(vehicle: WithFieldValue<Vehicle>): DocumentData {
    // Remove the id field (it's the document ID, not a field)
    const { id, ...rest } = vehicle as Vehicle & { id?: string };
    return convertAllDates(rest as unknown as Record<string, unknown>);
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): Vehicle {
    const raw = snapshot.data(options);
    const data = convertAllTimestamps(raw);
    return {
      id: snapshot.id,
      ...data,
    } as Vehicle;
  },
};

// ---------------------------------------------------------------------------
// VehicleActivity converter
// ---------------------------------------------------------------------------

export const activityConverter: FirestoreDataConverter<VehicleActivity> = {
  toFirestore(activity: WithFieldValue<VehicleActivity>): DocumentData {
    const { id, ...rest } = activity as VehicleActivity & { id?: string };
    return convertAllDates(rest as unknown as Record<string, unknown>);
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): VehicleActivity {
    const raw = snapshot.data(options);
    const data = convertAllTimestamps(raw);
    return {
      id: snapshot.id,
      ...data,
    } as VehicleActivity;
  },
};

// ---------------------------------------------------------------------------
// DealerUser converter
// ---------------------------------------------------------------------------

export const userConverter: FirestoreDataConverter<DealerUser> = {
  toFirestore(user: WithFieldValue<DealerUser>): DocumentData {
    const { id, ...rest } = user as DealerUser & { id?: string };
    return convertAllDates(rest as unknown as Record<string, unknown>);
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): DealerUser {
    const raw = snapshot.data(options);
    const data = convertAllTimestamps(raw);
    return {
      id: snapshot.id,
      ...data,
    } as DealerUser;
  },
};
