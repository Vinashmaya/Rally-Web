'use client';

// Cross-app impersonation handoff:
//  1. Reads `?ic=` from the URL on mount and signs in with the custom token.
//  2. Strips the param from history immediately (do NOT leak the token).
//  3. Inspects the current ID token's claims; if `actAs !== actor`, render
//     the persistent ImpersonationBanner.
//  4. "End impersonation" calls the admin app's end endpoint, signs out,
//     and routes the operator back to the admin console.
//
// This component is designed to be dropped at the top of each portal's root
// layout. It renders nothing until it has resolved an impersonation state.

import { useEffect, useState } from 'react';
import {
  signInWithCustomToken,
  signOut,
  onIdTokenChanged,
  type User,
} from 'firebase/auth';
import { auth } from '@rally/firebase/client';
import { ImpersonationBanner } from './ImpersonationBanner';

interface ImpersonationState {
  active: boolean;
  targetName: string;
  startedAt: number;
}

/** Decoded impersonation breadcrumbs from the active ID token claims. */
interface ImpersonationClaims {
  actAs?: string;
  actor?: string;
  impersonationStart?: number;
  email?: string;
  name?: string;
}

const ADMIN_HOST =
  process.env.NEXT_PUBLIC_ADMIN_HOST ?? 'https://admin.rally.vin';

async function readImpersonationState(user: User | null): Promise<ImpersonationState | null> {
  if (!user) return null;
  try {
    const result = await user.getIdTokenResult();
    const claims = result.claims as ImpersonationClaims;
    if (!claims.actAs || !claims.actor || claims.actAs === claims.actor) {
      return null;
    }
    return {
      active: true,
      targetName: claims.name ?? claims.email ?? user.displayName ?? user.email ?? user.uid,
      startedAt:
        typeof claims.impersonationStart === 'number'
          ? claims.impersonationStart
          : Date.now(),
    };
  } catch {
    return null;
  }
}

export function ImpersonationHandoff() {
  const [state, setState] = useState<ImpersonationState | null>(null);

  // On first paint, check for `?ic=` and exchange it for an auth session.
  useEffect(() => {
    const url = new URL(window.location.href);
    const ic = url.searchParams.get('ic');
    if (!ic) return;

    // Strip `ic` from the URL immediately so it never lives in browser
    // history, referrers, or analytics.
    url.searchParams.delete('ic');
    window.history.replaceState({}, '', url.toString());

    void (async () => {
      try {
        const cred = await signInWithCustomToken(auth, ic);
        // Force a fresh ID token so claims are populated, then refresh
        // the __session cookie on this app.
        const idToken = await cred.user.getIdToken(true);
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }).catch(() => {});
      } catch (err) {
        console.error('[ImpersonationHandoff] custom token sign-in failed:', err);
      }
    })();
  }, []);

  // Watch ID token changes — claims arrive after sign-in completes.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      const next = await readImpersonationState(user);
      setState(next);
    });
    return () => unsubscribe();
  }, []);

  const handleEnd = async () => {
    try {
      // Hit the admin app's cross-origin endpoint to revoke + audit.
      // Use credentials so the admin __session cookie travels (if any).
      await fetch(`${ADMIN_HOST}/api/auth/end-impersonation`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    } finally {
      // Clear the local session and bounce back to admin so the operator
      // can re-authenticate as themselves.
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      await signOut(auth).catch(() => {});
      window.location.href = ADMIN_HOST;
    }
  };

  if (!state?.active) return null;

  return (
    <ImpersonationBanner
      targetName={state.targetName}
      startedAt={state.startedAt}
      onEnd={handleEnd}
    />
  );
}
