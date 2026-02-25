import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'featureFlags' as const;

interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// GET — List all feature flags
export async function GET() {
  try {
    const snapshot = await adminDb.collection(COLLECTION).orderBy('name').get();

    const flags: FeatureFlag[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FeatureFlag[];

    return NextResponse.json({ success: true, data: flags });
  } catch (error) {
    console.error('[API] Feature flags list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// POST — Create or update a feature flag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, name, enabled, description } = body as {
      id: string;
      name: string;
      enabled: boolean;
      description?: string;
    };

    if (!id || !name || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: id, name, enabled (boolean)' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const flagData = {
      name,
      enabled,
      description: description ?? '',
      updatedAt: now,
    };

    // Check if flag exists to decide between create and update
    const existing = await adminDb.collection(COLLECTION).doc(id).get();

    if (existing.exists) {
      await adminDb.collection(COLLECTION).doc(id).update(flagData);
    } else {
      await adminDb
        .collection(COLLECTION)
        .doc(id)
        .set({ ...flagData, createdAt: now });
    }

    return NextResponse.json({
      success: true,
      data: { id, ...flagData },
    });
  } catch (error) {
    console.error('[API] Feature flag create/update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
