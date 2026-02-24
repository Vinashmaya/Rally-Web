'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Avatar,
  Skeleton,
} from '@rally/ui';
import {
  useDocument,
  USER_ROLE_DISPLAY,
  isManagerRole,
  isSalesRole,
  isServiceRole,
} from '@rally/firebase';
import type { DealerUser, UserPermissions, UserRole } from '@rally/firebase';
import {
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  UserCog,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Permission Display Labels
// ---------------------------------------------------------------------------

const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canViewAllVehicles: 'View All Vehicles',
  canChangeAnyStatus: 'Change Any Status',
  canStartTestDrive: 'Start Test Drives',
  canMarkAsSold: 'Mark as Sold',
  canMoveToService: 'Move to Service',
  canCompleteDetail: 'Complete Detail',
  canViewAnalytics: 'View Analytics',
  canManageUsers: 'Manage Users',
  canProgramNfcTags: 'Program NFC Tags',
  canExportData: 'Export Data',
  canViewTelemetry: 'View Telemetry',
  canOverrideHolds: 'Override Holds',
  canDeleteInteractions: 'Delete Interactions',
  canAccessAllDepartments: 'Access All Departments',
} as const;

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as (keyof UserPermissions)[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoleBadgeVariant(role: UserRole): 'gold' | 'info' | 'success' | 'default' {
  if (role === 'owner' || role === 'general_manager') return 'gold';
  if (isSalesRole(role)) return 'info';
  if (isServiceRole(role)) return 'success';
  return 'default';
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton Loading
// ---------------------------------------------------------------------------

function UserDetailSkeleton() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          <Skeleton variant="circle" className="h-20 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-5 w-24" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Info Row Component
// ---------------------------------------------------------------------------

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      <div className="text-text-tertiary shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          {label}
        </p>
        <p className="text-sm text-text-primary mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function UserDetailPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const uid = params.uid;

  const { data: user, loading, error } = useDocument<DealerUser>(`users/${uid}`);

  if (loading) {
    return <UserDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
        <Card>
          <CardContent>
            <p className="text-sm text-status-error">
              Failed to load user: {error.message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
        <Card>
          <CardContent>
            <p className="text-sm text-text-secondary">User not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Button>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          <Avatar
            size="lg"
            name={user.displayName}
            src={user.photoURL}
            className="h-20 w-20 text-2xl"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">
              {user.displayName}
            </h1>
            <p className="text-sm text-text-secondary truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={getRoleBadgeVariant(user.role)} size="md">
                {USER_ROLE_DISPLAY[user.role]}
              </Badge>
              {isManagerRole(user.role) && (
                <Badge variant="gold" size="sm">Manager</Badge>
              )}
            </div>
            {user.createdAt && (
              <p className="text-xs text-text-tertiary mt-2">
                Member since {formatDate(user.createdAt)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">Profile</h2>
        </CardHeader>
        <CardContent>
          <InfoRow
            icon={<UserCog className="h-4 w-4" />}
            label="Display Name"
            value={user.displayName}
          />
          <InfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={user.email}
          />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={user.phone ?? 'Not provided'}
          />
          <InfoRow
            icon={<Shield className="h-4 w-4" />}
            label="Role"
            value={USER_ROLE_DISPLAY[user.role]}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4" />}
            label="Joined"
            value={user.createdAt ? formatDate(user.createdAt) : 'Unknown'}
          />
          <InfoRow
            icon={<Clock className="h-4 w-4" />}
            label="Last Active"
            value={user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
          />
        </CardContent>
      </Card>

      {/* Permissions Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">Permissions</h2>
          <p className="text-xs text-text-secondary">
            Based on {USER_ROLE_DISPLAY[user.role]} role defaults
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {PERMISSION_KEYS.map((key) => {
              const granted = user.permissions[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2.5 px-1 border-b border-surface-border last:border-0"
                >
                  {granted ? (
                    <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-status-error shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      granted ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    {PERMISSION_LABELS[key]}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activity Summary Card */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">Recent Activity</h2>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-text-tertiary mb-3" strokeWidth={1.5} />
            <p className="text-sm text-text-secondary">
              Activity timeline coming soon
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Track vehicle scans, test drives, status changes, and more
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 justify-end pb-8">
        <Button
          variant="secondary"
          disabled
          title="TODO: Implement role editing"
        >
          {/* TODO: Implement Edit Role modal with role picker and Firestore update */}
          <UserCog className="h-4 w-4" />
          Edit Role
        </Button>
        <Button
          variant="danger"
          disabled
          title="TODO: Implement user deactivation"
        >
          {/* TODO: Implement deactivation confirmation dialog + Firestore update */}
          Deactivate User
        </Button>
      </div>
    </div>
  );
}
