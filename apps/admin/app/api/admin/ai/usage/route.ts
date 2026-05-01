// Admin AI usage analytics + Knowledge Base stats.
//
// Returns:
//   - usageMetrics: total queries this month, unique users, avg ms, top dealerships
//   - tokenUsageDaily: last 14 days, rolled up
//   - knowledgeBase: derived from vehicle-details.json (counts, year range, mtime, categories)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UsageDoc {
  uid: string;
  dealershipId: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  hadVinContext: boolean;
  errored?: boolean;
  createdAt: { toDate: () => Date } | Date;
}

interface VehicleRecord {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  bodyType?: string;
  condition?: string;
}

interface VehicleDetailsFile {
  scrapedAt?: string;
  vehicleCount?: number;
  vehicles: VehicleRecord[];
}

// ---------------------------------------------------------------------------
// KB derivation
// ---------------------------------------------------------------------------

let _kbCache: {
  loadedAt: number;
  data: Awaited<ReturnType<typeof computeKnowledgeBase>>;
} | null = null;

async function findVehicleDetailsPath(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'vehicle-details.json'),
    path.join(process.cwd(), '..', '..', 'vehicle-details.json'),
    path.join(process.cwd(), '..', 'vehicle-details.json'),
  ];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }
  return null;
}

async function computeKnowledgeBase() {
  const filePath = await findVehicleDetailsPath();
  if (!filePath) {
    return {
      available: false as const,
      stats: null,
      categories: [],
    };
  }

  const [stat, raw] = await Promise.all([
    fs.stat(filePath),
    fs.readFile(filePath, 'utf8'),
  ]);
  const file = JSON.parse(raw) as VehicleDetailsFile;
  const vehicles = file.vehicles ?? [];

  const makes = new Set<string>();
  const models = new Set<string>();
  const bodyTypes = new Map<string, number>();
  const conditions = new Map<string, number>();
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const v of vehicles) {
    if (v.make) makes.add(v.make);
    if (v.model) models.add(`${v.make ?? ''}|${v.model}`);
    if (v.bodyType) bodyTypes.set(v.bodyType, (bodyTypes.get(v.bodyType) ?? 0) + 1);
    if (v.condition) conditions.set(v.condition, (conditions.get(v.condition) ?? 0) + 1);
    if (typeof v.year === 'number') {
      if (v.year < minYear) minYear = v.year;
      if (v.year > maxYear) maxYear = v.year;
    }
  }

  const categories = [
    ...Array.from(bodyTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, entries]) => ({
        id: `body-${name.toLowerCase().replace(/\s+/g, '-')}`,
        name,
        kind: 'bodyType' as const,
        entries,
      })),
    ...Array.from(conditions.entries()).map(([name, entries]) => ({
      id: `cond-${name.toLowerCase()}`,
      name: `${name} Vehicles`,
      kind: 'condition' as const,
      entries,
    })),
  ];

  return {
    available: true as const,
    stats: {
      totalEntries: vehicles.length,
      makes: makes.size,
      models: models.size,
      yearMin: Number.isFinite(minYear) ? minYear : null,
      yearMax: Number.isFinite(maxYear) ? maxYear : null,
      lastUpdated: stat.mtime.toISOString(),
      sourceScrapedAt: file.scrapedAt ?? null,
      fileSizeBytes: stat.size,
    },
    categories,
  };
}

async function getKnowledgeBase() {
  // Cache for 60 seconds
  if (_kbCache && Date.now() - _kbCache.loadedAt < 60_000) {
    return _kbCache.data;
  }
  const data = await computeKnowledgeBase();
  _kbCache = { loadedAt: Date.now(), data };
  return data;
}

// ---------------------------------------------------------------------------
// Usage aggregation
// ---------------------------------------------------------------------------

function toDate(value: UsageDoc['createdAt']): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function dayKey(d: Date): string {
  // YYYY-MM-DD in local TZ — 14 day rollup
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function computeUsage() {
  // 14 day window — uses createdAt range
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Pull all docs in window
  const snap = await adminDb
    .collection('aiUsage')
    .where('createdAt', '>=', fourteenDaysAgo)
    .get();

  const docs = snap.docs.map((d) => d.data() as UsageDoc);

  // Token usage by day (last 14 days)
  const byDay = new Map<string, { inputTokens: number; outputTokens: number; queries: number }>();
  // Bootstrap each day with zeros so chart has all 14 buckets
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    byDay.set(dayKey(d), { inputTokens: 0, outputTokens: 0, queries: 0 });
  }

  // Month-to-date aggregates
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const uniqueUsers = new Set<string>();
  const dealershipCounts = new Map<string, number>();
  let monthQueries = 0;
  let totalDurationMs = 0;
  let durationSamples = 0;

  for (const doc of docs) {
    const created = toDate(doc.createdAt);
    if (!created) continue;

    const k = dayKey(created);
    const bucket = byDay.get(k);
    if (bucket) {
      bucket.inputTokens += doc.inputTokens ?? 0;
      bucket.outputTokens += doc.outputTokens ?? 0;
      bucket.queries += 1;
    }

    if (created >= monthStart) {
      monthQueries += 1;
      if (doc.uid) uniqueUsers.add(doc.uid);
      if (doc.dealershipId) {
        dealershipCounts.set(doc.dealershipId, (dealershipCounts.get(doc.dealershipId) ?? 0) + 1);
      }
      if (typeof doc.durationMs === 'number') {
        totalDurationMs += doc.durationMs;
        durationSamples += 1;
      }
    }
  }

  const tokenUsageDaily = Array.from(byDay.entries()).map(([day, v]) => ({
    day,
    inputTokens: v.inputTokens,
    outputTokens: v.outputTokens,
    tokens: v.inputTokens + v.outputTokens,
    queries: v.queries,
  }));

  const topDealerships = Array.from(dealershipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dealershipId, count]) => ({ dealershipId, count }));

  return {
    usageMetrics: {
      monthQueries,
      uniqueUsers: uniqueUsers.size,
      avgResponseMs: durationSamples > 0 ? Math.round(totalDurationMs / durationSamples) : 0,
      topDealerships,
    },
    tokenUsageDaily,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const [knowledgeBase, usage] = await Promise.all([
      getKnowledgeBase(),
      computeUsage(),
    ]);

    return NextResponse.json({
      success: true,
      data: { knowledgeBase, ...usage },
    });
  } catch (err) {
    console.error('[admin/ai/usage GET]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
