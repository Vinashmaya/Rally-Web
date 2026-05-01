import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { deleteDnsRecord, updateDnsRecord } from '@rally/infra';
import { requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// ── Zod schema for PATCH body ──────────────────────────────────────

const UpdateDnsRecordSchema = z
  .object({
    content: z.string().min(1).optional(),
    proxied: z.boolean().optional(),
    ttl: z.number().int().min(1).max(86400).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (content, proxied, ttl) must be provided',
  });

// DELETE — Remove a DNS record by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const { recordId } = await params;

    await deleteDnsRecord(recordId);

    return NextResponse.json({ success: true, data: { deletedId: recordId } });
  } catch (error) {
    console.error('[API] DNS delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// PATCH — Update content / proxied / ttl on an existing DNS record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const { recordId } = await params;

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = UpdateDnsRecordSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updateDnsRecord(recordId, parsed.data);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] DNS update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
