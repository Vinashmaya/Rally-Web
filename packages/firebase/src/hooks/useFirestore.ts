'use client';

// Firestore hooks — real-time document and collection listeners
// Uses onSnapshot for live data, properly unsubscribes on unmount

import { useState, useEffect } from 'react';
import {
  doc,
  collection,
  collectionGroup,
  onSnapshot,
  query,
} from 'firebase/firestore';
import type {
  DocumentData,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../client';

// ---------------------------------------------------------------------------
// Timestamp conversion helper
// ---------------------------------------------------------------------------

/**
 * Recursively converts Firestore Timestamp fields to JS Date objects.
 * Handles nested objects and arrays.
 */
function convertTimestamps<T>(data: DocumentData): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (
      typeof value === 'object' &&
      'toDate' in value &&
      typeof (value as Timestamp).toDate === 'function'
    ) {
      // Firestore Timestamp -> JS Date
      result[key] = (value as Timestamp).toDate();
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null && 'toDate' in item
          ? (item as Timestamp).toDate()
          : item,
      );
    } else if (typeof value === 'object') {
      result[key] = convertTimestamps(value as DocumentData);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ---------------------------------------------------------------------------
// useDocument — single document real-time listener
// ---------------------------------------------------------------------------

interface UseDocumentReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a single Firestore document in real-time.
 * Automatically converts Firestore Timestamps to JS Dates.
 *
 * @param path - Full Firestore document path (e.g. "vehicles/1C6SRFFT7TN244052")
 * @returns { data, loading, error }
 */
export function useDocument<T>(path: string): UseDocumentReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, path);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const raw = snapshot.data();
          const converted = convertTimestamps<T>(raw);
          setData({ ...converted, id: snapshot.id } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [path]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// useCollection — collection real-time listener with query support
// ---------------------------------------------------------------------------

interface UseCollectionReturn<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a Firestore collection in real-time with optional query constraints.
 * Automatically converts Firestore Timestamps to JS Dates.
 *
 * @param path - Full Firestore collection path (e.g. "vehicles")
 * @param constraints - Optional array of QueryConstraint (where, orderBy, limit, etc.)
 * @param constraintKey - Optional stable string key that changes when constraint *values* change.
 *   When provided, this is used as the effect dependency instead of the default type-only serialization.
 *   Domain hooks should provide this to ensure re-subscription on value changes.
 * @returns { data, loading, error }
 */
export function useCollection<T>(
  path: string,
  constraints?: QueryConstraint[],
  constraintKey?: string,
): UseCollectionReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use the provided constraintKey if available, otherwise fall back to type-only serialization.
  // Domain hooks should always pass constraintKey for correct reactivity on value changes.
  const constraintsKey = constraintKey
    ?? (constraints ? JSON.stringify(constraints.map((c) => c.type)) : 'none');

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const collectionRef = collection(db, path);
    const q = constraints && constraints.length > 0
      ? query(collectionRef, ...constraints)
      : query(collectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          const converted = convertTimestamps<T>(raw);
          return { ...converted, id: docSnap.id } as T;
        });
        setData(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, constraintsKey]);

  return { data, loading, error };
}

// ---------------------------------------------------------------------------
// useCollectionGroup — collection group real-time listener with query support
// ---------------------------------------------------------------------------

/**
 * Subscribe to a Firestore collection group in real-time with optional query constraints.
 * Queries across all collections with the same name, regardless of parent document.
 * Automatically converts Firestore Timestamps to JS Dates.
 *
 * @param collectionName - The collection name to query across all parent documents
 * @param constraints - Optional array of QueryConstraint (where, orderBy, limit, etc.)
 * @param constraintKey - Optional stable string key that changes when constraint *values* change.
 * @returns { data, loading, error }
 */
export function useCollectionGroup<T>(
  collectionName: string,
  constraints?: QueryConstraint[],
  constraintKey?: string,
): UseCollectionReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use the provided constraintKey if available, otherwise fall back to type-only serialization.
  const constraintsKey = constraintKey
    ?? (constraints ? JSON.stringify(constraints.map((c) => c.type)) : 'none');

  useEffect(() => {
    if (!collectionName) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const groupRef = collectionGroup(db, collectionName);
    const q = constraints && constraints.length > 0
      ? query(groupRef, ...constraints)
      : query(groupRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          const converted = convertTimestamps<T>(raw);
          return { ...converted, id: docSnap.id } as T;
        });
        setData(docs);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, constraintsKey]);

  return { data, loading, error };
}
