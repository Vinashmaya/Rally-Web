import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// CRM Customer Detail Proxy
//
// Proxies to the Rally VPS API (api.rally.vin) to fetch enriched DriveCentric
// detail (contactHistory, notes, conversationPreview) for a customer.
//
// Auth flow:
//   1. Verify caller has a Rally session (cookie or bearer).
//   2. Forward the same bearer token to the VPS API.
//
// The browser never sees the VPS URL — RALLY_API_URL stays server-side.
// ---------------------------------------------------------------------------

interface ProxyError {
  error: string;
  detail?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (!isVerifiedSession(auth)) return auth;

    const { customerId } = await params;
    if (!customerId || customerId.trim().length === 0) {
      return NextResponse.json<ProxyError>(
        { error: 'Missing customerId path parameter' },
        { status: 400 },
      );
    }

    const apiBase = process.env.RALLY_API_URL;
    if (!apiBase) {
      return NextResponse.json<ProxyError>(
        { error: 'Server misconfigured: RALLY_API_URL is not set' },
        { status: 500 },
      );
    }

    // Forward the caller's bearer token. The VPS API accepts either
    // Firebase Bearer ID token OR Rally API Key + UID headers — we use
    // the bearer flow because the user is authenticated.
    const incomingAuth = request.headers.get('authorization');
    if (!incomingAuth) {
      // requireAuth already gates this, but keep an explicit guard:
      // a session-cookie session doesn't carry a forwardable bearer.
      // In that case we mint nothing — the VPS endpoint requires a token,
      // so return 401 with a clear hint.
      return NextResponse.json<ProxyError>(
        {
          error:
            'Cannot proxy without a bearer token. Re-authenticate to refresh your ID token.',
        },
        { status: 401 },
      );
    }

    const encoded = encodeURIComponent(customerId);
    const upstreamUrl = `${apiBase.replace(/\/$/, '')}/api/crm-customer-detail?customerId=${encoded}`;

    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Authorization: incomingAuth,
        Accept: 'application/json',
      },
      // Detail endpoint can take a moment when DC is slow.
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });

    const text = await upstream.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        // Non-JSON upstream response — surface as 502
        return NextResponse.json<ProxyError>(
          {
            error: 'Upstream returned non-JSON response',
            detail: text.slice(0, 500),
          },
          { status: 502 },
        );
      }
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            (payload as { error?: string } | null)?.error ??
            `Upstream error (HTTP ${upstream.status})`,
        },
        { status: upstream.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('[API] CRM customer detail proxy error:', error);
    return NextResponse.json<ProxyError>(
      {
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 },
    );
  }
}
