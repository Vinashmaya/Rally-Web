import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Set session cookie after Firebase client sign-in
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the token is genuine before storing it
    await getAdminAuth().verifyIdToken(idToken, true);

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch (error) {
    console.error('[Session] Token verification failed:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Invalid or expired token', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 },
    );
  }
}

// DELETE — Clear session cookie on sign-out
export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set('__session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
