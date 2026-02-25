import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { provisionTenant } from '@rally/infra';

export const dynamic = 'force-dynamic';

// POST — Provision a new tenant (Cloudflare DNS + Plesk vhost + Firestore seeding)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { slug, groupName, principalEmail, principalName } = body as {
      slug: string;
      groupName: string;
      principalEmail: string;
      principalName: string;
    };

    if (!slug || !groupName || !principalEmail || !principalName) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, groupName, principalEmail, principalName' },
        { status: 400 },
      );
    }

    const result = await provisionTenant({ slug, groupName, principalEmail, principalName });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, steps: result.steps },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[API] Tenant provisioning error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
