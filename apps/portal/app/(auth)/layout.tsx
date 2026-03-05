import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

async function tenantExists(slug: string): Promise<boolean> {
  try {
    const snapshot = await getAdminDb()
      .collection('groups')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    return !snapshot.empty;
  } catch {
    return false;
  }
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug');

  // Unknown tenant → redirect to main site
  if (tenantSlug && !(await tenantExists(tenantSlug))) {
    redirect('https://rally.vin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
