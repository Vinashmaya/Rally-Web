import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireAuth, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

interface UserPreferences {
  notifications?: boolean;
  defaultView?: string;
  theme?: string;
  language?: string;
  [key: string]: string | boolean | number | undefined;
}

// PUT — Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { preferences } = body as {
      preferences: UserPreferences;
    };

    const uid = auth.uid; // Use verified UID, not user-supplied

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Missing required field: preferences (object)' },
        { status: 400 },
      );
    }

    // Verify user exists
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Merge update — only updates the preferences field, preserves everything else
    await adminDb.collection('users').doc(uid).update({
      preferences,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { uid, preferences },
    });
  } catch (error) {
    console.error('[API] Preferences update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
