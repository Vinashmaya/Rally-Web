// Client-side Firestore mutation functions
// Used for user-initiated writes (creating lists, starting activities, etc.)
// Server-side operations (user provisioning, DNS) use API routes instead.

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from './client';
import type { VehicleActivityState } from './types/activity';

// ---------------------------------------------------------------------------
// Vehicle Activities
// ---------------------------------------------------------------------------

export interface CreateActivityInput {
  vehicleId: string;
  stockNumber: string;
  state: VehicleActivityState;
  startedByUserId: string;
  startedByName: string;
  dealershipId: string;
  startingFuelLevel?: number;
}

export async function createVehicleActivity(input: CreateActivityInput): Promise<string> {
  const ref = await addDoc(collection(db, 'vehicleActivities'), {
    ...input,
    startedAt: serverTimestamp(),
    endedAt: null,
    durationSeconds: null,
  });
  return ref.id;
}

export async function endVehicleActivity(activityId: string): Promise<void> {
  await updateDoc(doc(db, 'vehicleActivities', activityId), {
    endedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Vehicle Lists
// ---------------------------------------------------------------------------

export interface CreateListInput {
  name: string;
  color: string;
  icon: string;
  dealershipId: string;
  ownerId: string;
  ownerName: string;
  isShared?: boolean;
}

export async function createVehicleList(input: CreateListInput): Promise<string> {
  const ref = await addDoc(collection(db, 'vehicleLists'), {
    ...input,
    isDefault: false,
    isShared: input.isShared ?? false,
    sharedWith: [],
    vehicleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    sortOrder: 0,
  });
  return ref.id;
}

export async function updateVehicleList(
  listId: string,
  data: Partial<Pick<CreateListInput, 'name' | 'color' | 'icon' | 'isShared'>>
): Promise<void> {
  await updateDoc(doc(db, 'vehicleLists', listId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVehicleList(listId: string): Promise<void> {
  await deleteDoc(doc(db, 'vehicleLists', listId));
}

export interface AddToListInput {
  vehicleId: string;
  stockNumber: string;
  vin: string;
  addedBy: string;
  notes?: string;
}

export async function addVehicleToList(listId: string, input: AddToListInput): Promise<void> {
  const itemRef = doc(db, 'vehicleLists', listId, 'items', input.vehicleId);
  await setDoc(itemRef, {
    ...input,
    addedAt: serverTimestamp(),
  });
  // Increment denormalized count
  await updateDoc(doc(db, 'vehicleLists', listId), {
    vehicleCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function removeVehicleFromList(listId: string, vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, 'vehicleLists', listId, 'items', vehicleId));
  // Decrement denormalized count
  await updateDoc(doc(db, 'vehicleLists', listId), {
    vehicleCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export async function updateUserPreferences(
  uid: string,
  preferences: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    preferences,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Interactions (Audit Trail)
// ---------------------------------------------------------------------------

export interface CreateInteractionInput {
  type: string;
  vehicleId?: string;
  userId: string;
  dealershipId: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export async function createInteraction(input: CreateInteractionInput): Promise<string> {
  const ref = await addDoc(collection(db, 'interactions'), {
    ...input,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}
