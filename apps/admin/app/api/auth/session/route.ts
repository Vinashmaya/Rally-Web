import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// POST — Set session cookie after Firebase client sign-in
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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
