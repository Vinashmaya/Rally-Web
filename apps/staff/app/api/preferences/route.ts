import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@rally/firebase/admin';

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
    const body = await request.json();

    const { uid, preferences } = body as {
      uid: string;
      preferences: UserPreferences;
    };

    if (!uid || !preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Missing required fields: uid, preferences (object)' },
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
