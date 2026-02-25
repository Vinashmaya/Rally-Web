import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// 14-day session — matches Firebase session cookie max (14 days)
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 14;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_SECONDS * 1000;

// POST — Create a Firebase session cookie after client sign-in.
// The client sends a fresh ID token; we exchange it for a long-lived
// session cookie that is verified via verifySessionCookie() in auth-guard.ts.
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
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
