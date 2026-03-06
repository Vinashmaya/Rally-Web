import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminStorage, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// POST — Upload an overlay image to Firebase Storage
// Returns the download URL for the uploaded file
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const storeId = formData.get('storeId') as string | null;
    const configId = formData.get('configId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 10MB` },
        { status: 400 },
      );
    }

    // Build storage path
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const storagePath = `lot-configs/${storeId}/${configId ?? 'new'}/overlays/${filename}`;

    // Upload to Firebase Storage
    const bucket = getAdminStorage().bucket();
    const storageFile = bucket.file(storagePath);
    const buffer = Buffer.from(await file.arrayBuffer());

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: auth.uid,
          storeId,
          configId: configId ?? '',
        },
      },
    });

    // Make file publicly readable and get download URL
    await storageFile.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    return NextResponse.json({
      url: publicUrl,
      storagePath: `gs://${bucket.name}/${storagePath}`,
      filename,
    });
  } catch (err) {
    console.error('[lot-config/upload POST]', err);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 },
    );
  }
}
