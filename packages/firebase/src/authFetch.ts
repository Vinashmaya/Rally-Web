'use client';

// Authenticated fetch wrapper for API route calls.
// Attaches the current user's Firebase ID token as a Bearer header.
// This ensures API routes work even when Cloudflare's proxy strips
// the __session Set-Cookie header from origin responses.

import { auth } from './client';

/**
 * Fetch wrapper that attaches `Authorization: Bearer <idToken>`.
 * Usage: `const res = await authFetch('/api/admin/tenants');`
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }

  const idToken = await user.getIdToken();

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${idToken}`);

  return fetch(input, { ...init, headers });
}
