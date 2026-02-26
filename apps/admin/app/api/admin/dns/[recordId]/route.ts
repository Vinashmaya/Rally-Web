import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deleteDnsRecord } from '@rally/infra';
import { requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

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
