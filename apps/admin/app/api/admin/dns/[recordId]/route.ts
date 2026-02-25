import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deleteDnsRecord } from '@rally/infra';

export const dynamic = 'force-dynamic';

// DELETE — Remove a DNS record by ID
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  try {
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
