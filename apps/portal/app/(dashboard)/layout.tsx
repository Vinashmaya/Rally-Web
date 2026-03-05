import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb } from '@rally/firebase/admin';
import DashboardShell from './DashboardShell';

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

export default async function PortalDashboardLayout({
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

  return <DashboardShell>{children}</DashboardShell>;
}
