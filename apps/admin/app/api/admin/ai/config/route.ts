// Admin AI config — GET / PATCH / POST (init defaults)
// Firestore doc path: system/config (with field bag) — actually use a dedicated doc
// at `system/aiConfig` so we don't collide with any other system config.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DOC_PATH = ['system', 'aiConfig'] as const;

const ConfigSchema = z.object({
  model: z.string().min(1).max(100),
  maxTokens: z.number().int().positive().max(8192),
  temperature: z.number().min(0).max(2),
  systemPromptVersion: z.string().min(1).max(50),
  knowledgeBaseEnabled: z.boolean(),
});

const PatchSchema = ConfigSchema.partial();

const DEFAULT_CONFIG: z.infer<typeof ConfigSchema> = {
  model: 'claude-sonnet-4-6',
  maxTokens: 1024,
  temperature: 0.7,
  systemPromptVersion: 'v1',
  knowledgeBaseEnabled: true,
} as const;

async function getDoc() {
  return adminDb.collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
}

// ---------------------------------------------------------------------------
// GET — read config (returns 404 + default if not set)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const snap = await getDoc();
    if (!snap.exists) {
      return NextResponse.json(
        {
          success: false,
          code: 'CONFIG_NOT_FOUND',
          defaults: DEFAULT_CONFIG,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: snap.data() });
  } catch (err) {
    console.error('[admin/ai/config GET]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — initialize config doc with defaults (or provided overrides)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    let overrides: Partial<z.infer<typeof ConfigSchema>> = {};
    try {
      const body = await request.json();
      overrides = PatchSchema.parse(body);
    } catch {
      // No body or invalid — use full defaults
    }

    const merged = { ...DEFAULT_CONFIG, ...overrides };
    const now = new Date().toISOString();
    await adminDb
      .collection(DOC_PATH[0])
      .doc(DOC_PATH[1])
      .set({ ...merged, createdAt: now, updatedAt: now });

    return NextResponse.json({ success: true, data: merged });
  } catch (err) {
    console.error('[admin/ai/config POST]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — partial update
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    let parsed: Partial<z.infer<typeof ConfigSchema>>;
    try {
      const body = await request.json();
      parsed = PatchSchema.parse(body);
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: err instanceof z.ZodError ? err.flatten() : 'Invalid request body',
          code: 'INVALID_REQUEST',
        },
        { status: 400 },
      );
    }

    if (Object.keys(parsed).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields provided' },
        { status: 400 },
      );
    }

    const ref = adminDb.collection(DOC_PATH[0]).doc(DOC_PATH[1]);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'Config not initialized', code: 'CONFIG_NOT_FOUND' },
        { status: 404 },
      );
    }

    const update = { ...parsed, updatedAt: new Date().toISOString() };
    await ref.update(update);

    const updated = (await ref.get()).data();
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[admin/ai/config PATCH]', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
