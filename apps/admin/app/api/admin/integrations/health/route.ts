import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  adminDb,
  FieldValue,
  requireSuperAdmin,
  isVerifiedSession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// BRIDGE — Integration health probes
//
// Each integration has a `probe()` that returns an IntegrationStatus.
// All probes run in parallel (Promise.allSettled) with a 3s timeout.
// Results are cached in Firestore at `system/integrationsHealth` with a 60s
// TTL so page views don't hammer upstreams. POST forces a fresh probe.
//
// Auth contract: super admin only (server-side via requireSuperAdmin).
//
// Endpoints chosen (and why):
//   Vincue          GET https://pro.vincue.com/api/                   (base URL, cheap)
//   DriveCentric    GET https://core.drivecentric.io/                  (root liveness)
//   eLead           STUB — no known unauthenticated health endpoint
//   Kahu            GET https://kdw-next.kahuapp.com/                  (root)
//   Ghost           GET https://aicdjr.com/fleet/dev/v1/health         (best-guess)
//   Mapbox          GET https://api.mapbox.com/v4/mapbox.satellite.json
//                       ?access_token=<NEXT_PUBLIC_MAPBOX_TOKEN>
//   Cloudflare      GET https://api.cloudflare.com/client/v4/user/tokens/verify
//                       Authorization: Bearer <CLOUDFLARE_API_TOKEN>
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 60_000;

type IntegrationStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'unconfigured';
type IntegrationType = 'crm' | 'dms' | 'tracking' | 'communication' | 'infrastructure';

interface IntegrationHealth {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  color: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  lastChecked: string;
  error?: string;
}

interface IntegrationDef {
  id: string;
  name: string;
  type: IntegrationType;
  description: string;
  color: string;
  probe: () => Promise<{ status: IntegrationStatus; latencyMs: number | null; error?: string }>;
}

// ---------------------------------------------------------------------------
// Probe helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<{ ok: boolean; status: number; latencyMs: number; error?: string }> {
  const controller = new AbortController();
  const timeout = init?.timeoutMs ?? PROBE_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Avoid Next.js fetch caching layer
      cache: 'no-store',
    });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, status: res.status, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, latencyMs, error };
  } finally {
    clearTimeout(timer);
  }
}

function classify(latencyMs: number, ok: boolean): IntegrationStatus {
  if (!ok) return 'down';
  if (latencyMs > 1500) return 'degraded';
  return 'healthy';
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

async function probeVincue() {
  const base = process.env.VINCUE_API_BASE ?? 'https://pro.vincue.com/api';
  const res = await fetchWithTimeout(base, { method: 'GET' });
  // Vincue may return 401/404 on the bare base URL but the TCP/TLS round-trip
  // still proves the host is reachable. Any HTTP response (status > 0) counts
  // as alive; only network errors mean down.
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  return { status: classify(res.latencyMs, true), latencyMs: res.latencyMs };
}

async function probeDriveCentric() {
  const base = process.env.DRIVECENTRIC_API_BASE ?? 'https://core.drivecentric.io';
  const res = await fetchWithTimeout(base, { method: 'GET' });
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  return { status: classify(res.latencyMs, true), latencyMs: res.latencyMs };
}

async function probeELead() {
  // No known unauthenticated health endpoint. If/when we get a proper
  // ELEAD_HEALTH_URL we can probe it directly; until then, surface as
  // unconfigured rather than fabricate a status.
  const url = process.env.ELEAD_HEALTH_URL;
  if (!url) {
    return {
      status: 'unconfigured' as IntegrationStatus,
      latencyMs: null,
      error: 'No eLead health endpoint configured (set ELEAD_HEALTH_URL).',
    };
  }
  const res = await fetchWithTimeout(url);
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  return { status: classify(res.latencyMs, res.ok), latencyMs: res.latencyMs };
}

async function probeKahu() {
  const base = process.env.KAHU_API_BASE ?? 'https://kdw-next.kahuapp.com';
  const res = await fetchWithTimeout(base, { method: 'GET' });
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  return { status: classify(res.latencyMs, true), latencyMs: res.latencyMs };
}

async function probeGhost() {
  const base = process.env.GHOST_API_BASE ?? 'https://aicdjr.com/fleet/dev/v1';
  const url = `${base.replace(/\/$/, '')}/health`;
  const res = await fetchWithTimeout(url);
  if (res.status === 0) {
    // Try base URL as a fallback liveness ping
    const fallback = await fetchWithTimeout(base);
    if (fallback.status === 0) {
      return { status: 'down' as IntegrationStatus, latencyMs: fallback.latencyMs, error: fallback.error };
    }
    return { status: 'degraded' as IntegrationStatus, latencyMs: fallback.latencyMs, error: 'health endpoint unreachable, base URL alive' };
  }
  return { status: classify(res.latencyMs, res.ok), latencyMs: res.latencyMs };
}

async function probeMapbox() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN;
  if (!token) {
    return {
      status: 'unconfigured' as IntegrationStatus,
      latencyMs: null,
      error: 'NEXT_PUBLIC_MAPBOX_TOKEN not set',
    };
  }
  const url = `https://api.mapbox.com/v4/mapbox.satellite.json?access_token=${encodeURIComponent(token)}`;
  const res = await fetchWithTimeout(url);
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  if (!res.ok) {
    return {
      status: 'degraded' as IntegrationStatus,
      latencyMs: res.latencyMs,
      error: `HTTP ${res.status}`,
    };
  }
  return { status: classify(res.latencyMs, res.ok), latencyMs: res.latencyMs };
}

async function probeCloudflare() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    return {
      status: 'unconfigured' as IntegrationStatus,
      latencyMs: null,
      error: 'CLOUDFLARE_API_TOKEN not set',
    };
  }
  const res = await fetchWithTimeout('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 0) {
    return { status: 'down' as IntegrationStatus, latencyMs: res.latencyMs, error: res.error };
  }
  if (!res.ok) {
    return {
      status: 'degraded' as IntegrationStatus,
      latencyMs: res.latencyMs,
      error: `HTTP ${res.status} (token may be invalid)`,
    };
  }
  return { status: classify(res.latencyMs, res.ok), latencyMs: res.latencyMs };
}

// ---------------------------------------------------------------------------
// Integration definitions
// ---------------------------------------------------------------------------

const INTEGRATIONS: readonly IntegrationDef[] = [
  {
    id: 'int-vincue',
    name: 'Vincue',
    type: 'dms',
    description: 'Dealer Management System — inventory sync, deal management, and reporting.',
    color: '#3B82F6',
    probe: probeVincue,
  },
  {
    id: 'int-drivecentric',
    name: 'DriveCentric',
    type: 'crm',
    description: 'Customer Relationship Management — lead tracking, follow-ups, and customer history.',
    color: '#8B5CF6',
    probe: probeDriveCentric,
  },
  {
    id: 'int-elead',
    name: 'eLead',
    type: 'crm',
    description: 'CRM platform — lead management and internet lead routing.',
    color: '#F59E0B',
    probe: probeELead,
  },
  {
    id: 'int-kahu',
    name: 'Kahu',
    type: 'tracking',
    description: 'Vehicle tracking and lot management — GPS positions and theft recovery.',
    color: '#22C55E',
    probe: probeKahu,
  },
  {
    id: 'int-ghost',
    name: 'Ghost',
    type: 'tracking',
    description: 'Rally OBD2 hardware — telematics, battery health, and iBeacon lot tracking.',
    color: '#D4A017',
    probe: probeGhost,
  },
  {
    id: 'int-mapbox',
    name: 'Mapbox',
    type: 'infrastructure',
    description: 'Maps and geocoding — dealership lot maps, vehicle positioning, and route planning.',
    color: '#0EA5E9',
    probe: probeMapbox,
  },
  {
    id: 'int-cloudflare',
    name: 'Cloudflare',
    type: 'infrastructure',
    description: 'CDN and DNS — edge caching, DDoS protection, and subdomain management.',
    color: '#F97316',
    probe: probeCloudflare,
  },
] as const;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedHealth {
  integrations: IntegrationHealth[];
  lastChecked: string;
}

interface InMemoryCache {
  payload: CachedHealth | null;
  expiresAt: number;
}

// Process-level memoization. PM2 cluster mode means each instance has its
// own copy — that's fine; Firestore is the durable cache shared by all
// instances and clients.
const memCache: InMemoryCache = { payload: null, expiresAt: 0 };

async function readFromFirestoreCache(): Promise<CachedHealth | null> {
  try {
    const snap = await adminDb.collection('system').doc('integrationsHealth').get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || !Array.isArray(data.integrations)) return null;
    const lastChecked = typeof data.lastChecked === 'string' ? data.lastChecked : null;
    if (!lastChecked) return null;
    const age = Date.now() - new Date(lastChecked).getTime();
    if (age > CACHE_TTL_MS) return null;
    return {
      integrations: data.integrations as IntegrationHealth[],
      lastChecked,
    };
  } catch (err) {
    console.warn('[integrations/health] Firestore cache read failed:', err);
    return null;
  }
}

async function writeFirestoreCache(payload: CachedHealth): Promise<void> {
  try {
    await adminDb.collection('system').doc('integrationsHealth').set({
      integrations: payload.integrations,
      lastChecked: payload.lastChecked,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[integrations/health] Firestore cache write failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Probe orchestration
// ---------------------------------------------------------------------------

async function runAllProbes(): Promise<CachedHealth> {
  const lastChecked = new Date().toISOString();
  const results = await Promise.allSettled(
    INTEGRATIONS.map(async (def): Promise<IntegrationHealth> => {
      const r = await def.probe();
      return {
        id: def.id,
        name: def.name,
        type: def.type,
        description: def.description,
        color: def.color,
        status: r.status,
        latencyMs: r.latencyMs,
        lastChecked,
        ...(r.error ? { error: r.error } : {}),
      };
    }),
  );

  const integrations: IntegrationHealth[] = results.map((res, i) => {
    const def = INTEGRATIONS[i]!;
    if (res.status === 'fulfilled') return res.value;
    return {
      id: def.id,
      name: def.name,
      type: def.type,
      description: def.description,
      color: def.color,
      status: 'unknown',
      latencyMs: null,
      lastChecked,
      error: res.reason instanceof Error ? res.reason.message : String(res.reason),
    };
  });

  return { integrations, lastChecked };
}

// ---------------------------------------------------------------------------
// GET — cached or freshly probed
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    // 1) In-memory cache (fastest)
    if (memCache.payload && memCache.expiresAt > Date.now()) {
      return NextResponse.json({ success: true, data: memCache.payload, cache: 'memory' });
    }

    // 2) Firestore cache (shared across PM2 instances)
    const fsCache = await readFromFirestoreCache();
    if (fsCache) {
      memCache.payload = fsCache;
      memCache.expiresAt = Date.now() + CACHE_TTL_MS;
      return NextResponse.json({ success: true, data: fsCache, cache: 'firestore' });
    }

    // 3) Fresh probe
    const fresh = await runAllProbes();
    memCache.payload = fresh;
    memCache.expiresAt = Date.now() + CACHE_TTL_MS;
    await writeFirestoreCache(fresh);

    return NextResponse.json({ success: true, data: fresh, cache: 'fresh' });
  } catch (error) {
    console.error('[API] Integrations health GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — force a fresh probe (bypasses cache)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const fresh = await runAllProbes();
    memCache.payload = fresh;
    memCache.expiresAt = Date.now() + CACHE_TTL_MS;
    await writeFirestoreCache(fresh);

    // Audit
    try {
      await adminDb.collection('auditLogs').add({
        action: 'system.integrations.refresh',
        actorId: auth.uid,
        actorType: 'super-admin',
        targetType: 'system',
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn('[integrations/health] audit log failed:', err);
    }

    return NextResponse.json({ success: true, data: fresh, cache: 'fresh' });
  } catch (error) {
    console.error('[API] Integrations health POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
