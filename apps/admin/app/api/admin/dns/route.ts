import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listDnsRecords, createDnsRecord } from '@rally/infra';
import { requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — List all DNS records for the rally.vin zone
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const records = await listDnsRecords();
    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('[API] DNS list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// POST — Create a new DNS A record
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { name, content } = body as { name: string; content: string };

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: name, content' },
        { status: 400 },
      );
    }

    const record = await createDnsRecord(name, content);
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[API] DNS create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
