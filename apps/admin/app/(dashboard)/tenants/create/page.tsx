'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  useToast,
} from '@rally/ui';
// NOTE: Cannot import from @rally/infra in client components — it pulls in
// firebase-admin which requires Node.js modules (fs, http2). Constants and
// types are duplicated here. The real provisioning call goes through an API route.

const RESERVED_SLUGS = [
  'app', 'manage', 'admin', 'api', 'www', 'mail', 'ftp',
  'portal', 'cdn', 'assets', 'static', 'dev', 'staging',
  'test', 'demo', 'help', 'support', 'docs', 'blog',
] as const;

interface ProvisioningStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  error?: string;
}
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Form schema — mirrors slugSchema from @rally/infra but inline for the
// form so react-hook-form can validate incrementally
// ---------------------------------------------------------------------------

const tenantFormSchema = z.object({
  groupName: z
    .string()
    .min(1, 'Group name is required')
    .max(100, 'Group name must be under 100 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(32, 'Slug must be at most 32 characters')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Lowercase alphanumeric with hyphens, cannot start/end with hyphen',
    )
    .refine(
      (slug) => !RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number]),
      'This subdomain is reserved',
    ),
  principalEmail: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  principalName: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be under 100 characters'),
});

type TenantFormData = z.infer<typeof tenantFormSchema>;

// ---------------------------------------------------------------------------
// Provisioning step names and display labels
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<string, string> = {
  validate_slug: 'Validate slug',
  check_firestore_unique: 'Check slug uniqueness',
  create_dns_record: 'Create DNS record (Cloudflare)',
  create_plesk_subdomain: 'Create vhost (Plesk)',
  request_ssl_cert: 'Request SSL certificate',
  seed_firestore_group: 'Seed Firestore group',
  create_principal_user: 'Create principal user',
  write_audit_log: 'Write audit log',
} as const;

// ---------------------------------------------------------------------------
// Step status icon component
// ---------------------------------------------------------------------------

function StepStatusIcon({ status }: { status: ProvisioningStep['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-text-disabled" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-rally-gold animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-status-success" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-status-error" />;
    case 'rolled_back':
      return <RotateCcw className="h-4 w-4 text-status-warning" />;
  }
}

function StepStatusBadge({ status }: { status: ProvisioningStep['status'] }) {
  const variantMap = {
    pending: 'default',
    running: 'gold',
    completed: 'success',
    failed: 'error',
    rolled_back: 'warning',
  } as const;

  return (
    <Badge variant={variantMap[status]} size="sm">
      {status === 'rolled_back' ? 'rolled back' : status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Slug generation helper
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TenantCreatePage() {
  const router = useRouter();
  const { toast } = useToast();

  // Provisioning state
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionSteps, setProvisionSteps] = useState<ProvisioningStep[]>([]);
  const [provisionResult, setProvisionResult] = useState<{
    success: boolean;
    groupId?: string;
    slug: string;
    error?: string;
  } | null>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    mode: 'onChange',
    defaultValues: {
      groupName: '',
      slug: '',
      principalEmail: '',
      principalName: '',
    },
  });

  const groupName = watch('groupName');
  const slug = watch('slug');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Auto-generate slug from group name
  useEffect(() => {
    if (!slugManuallyEdited && groupName) {
      const generated = generateSlug(groupName);
      setValue('slug', generated, { shouldValidate: true });
    }
  }, [groupName, slugManuallyEdited, setValue]);

  // ---------------------------------------------------------------------------
  // Simulated provisioning flow
  // TODO: Replace with real API route call (POST /api/admin/tenants/provision)
  // that invokes provisionTenant() from @rally/infra on the server
  // ---------------------------------------------------------------------------

  const simulateProvision = useCallback(
    async (data: TenantFormData) => {
      setIsProvisioning(true);
      setProvisionResult(null);

      const stepNames = [
        'validate_slug',
        'check_firestore_unique',
        'create_dns_record',
        'create_plesk_subdomain',
        'request_ssl_cert',
        'seed_firestore_group',
        'create_principal_user',
        'write_audit_log',
      ];

      const steps: ProvisioningStep[] = stepNames.map((name) => ({
        name,
        status: 'pending' as const,
      }));

      setProvisionSteps([...steps]);

      // Simulate each step with a delay
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue;

        // Mark running
        step.status = 'running';
        setProvisionSteps([...steps]);

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

        // Mark completed
        step.status = 'completed';
        setProvisionSteps([...steps]);
      }

      // Simulate success
      const mockGroupId = `grp_${Date.now().toString(36)}`;
      setProvisionResult({
        success: true,
        groupId: mockGroupId,
        slug: data.slug,
      });

      setIsProvisioning(false);

      toast({
        type: 'success',
        title: 'Tenant provisioned',
        description: `${data.groupName} is live at ${data.slug}.rally.vin`,
      });
    },
    [toast],
  );

  const onSubmit = handleSubmit(simulateProvision);

  // Show provisioning progress view
  if (provisionSteps.length > 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!isProvisioning) {
              setProvisionSteps([]);
              setProvisionResult(null);
            }
          }}
          disabled={isProvisioning}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Form
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {isProvisioning ? 'Provisioning...' : provisionResult?.success ? 'Tenant Provisioned' : 'Provisioning Failed'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {isProvisioning
              ? 'Setting up infrastructure, DNS, SSL, and database...'
              : provisionResult?.success
                ? `${slug}.rally.vin is live and ready.`
                : provisionResult?.error ?? 'An error occurred during provisioning.'}
          </p>
        </div>

        {/* Step progress */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">
              Provisioning Steps
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-surface-border">
              {provisionSteps.map((step) => (
                <div
                  key={step.name}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <StepStatusIcon status={step.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      {STEP_LABELS[step.name] ?? step.name}
                    </p>
                    {step.error && (
                      <p className="text-xs text-status-error mt-0.5">
                        {step.error}
                      </p>
                    )}
                  </div>
                  <StepStatusBadge status={step.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Result card — shown after provisioning completes */}
        {provisionResult?.success && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Tenant Created Successfully
                </h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-tertiary uppercase tracking-wider">
                    Group ID
                  </p>
                  <p className="text-sm font-[family-name:var(--font-geist-mono)] text-text-primary mt-0.5">
                    {provisionResult.groupId ?? 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary uppercase tracking-wider">
                    Subdomain
                  </p>
                  <a
                    href={`https://${provisionResult.slug}.rally.vin`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-rally-gold hover:text-rally-goldLight transition-colors flex items-center gap-1 mt-0.5"
                  >
                    {provisionResult.slug}.rally.vin
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-3 pt-4">
              <Button
                variant="primary"
                onClick={() =>
                  router.push(`/tenants/${provisionResult.groupId ?? ''}`)
                }
              >
                View Tenant Details
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/tenants')}
              >
                Back to Tenants
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Failed result */}
        {provisionResult && !provisionResult.success && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-status-error" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Provisioning Failed
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">
                {provisionResult.error ?? 'An unknown error occurred.'}
              </p>
              <p className="text-xs text-text-tertiary mt-2">
                Any infrastructure resources created during the process have been rolled back.
              </p>
            </CardContent>
            <CardFooter className="gap-3 pt-4">
              <Button
                variant="primary"
                onClick={() => {
                  setProvisionSteps([]);
                  setProvisionResult(null);
                }}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push('/tenants')}
              >
                Back to Tenants
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main form view
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/tenants')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tenants
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Provision New Tenant
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Create a new dealership group with DNS, SSL, and database setup.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">
              Tenant Details
            </h2>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Group Name */}
            <Input
              label="Group Name"
              placeholder="Gallatin CDJR"
              startIcon={<Building2 className="h-4 w-4" />}
              error={errors.groupName?.message}
              {...register('groupName')}
            />

            {/* Slug */}
            <div>
              <Input
                label="Subdomain Slug"
                placeholder="gallatin-cdjr"
                startIcon={<Globe className="h-4 w-4" />}
                error={errors.slug?.message}
                {...register('slug', {
                  onChange: () => setSlugManuallyEdited(true),
                })}
              />
              {/* Live slug preview */}
              {slug && !errors.slug && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Will be accessible at:{' '}
                  <span className="font-[family-name:var(--font-geist-mono)] text-rally-gold">
                    {slug}.rally.vin
                  </span>
                </p>
              )}
            </div>

            {/* Separator */}
            <div className="border-t border-surface-border" />

            <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Principal User
            </h3>

            {/* Principal Name */}
            <Input
              label="Full Name"
              placeholder="John Smith"
              startIcon={<User className="h-4 w-4" />}
              error={errors.principalName?.message}
              {...register('principalName')}
            />

            {/* Principal Email */}
            <Input
              label="Email Address"
              placeholder="john@gallatin-cdjr.com"
              type="email"
              startIcon={<Mail className="h-4 w-4" />}
              error={errors.principalEmail?.message}
              {...register('principalEmail')}
            />
          </CardContent>
          <CardFooter className="gap-3 pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid}
              loading={isProvisioning}
            >
              <Building2 className="h-4 w-4" />
              Provision Tenant
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/tenants')}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Info box */}
      <Card>
        <CardContent>
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">
            What happens when you provision
          </h3>
          <ol className="space-y-1.5 text-xs text-text-tertiary list-decimal list-inside">
            <li>Slug is validated and checked for uniqueness</li>
            <li>Cloudflare DNS A record created for <span className="font-[family-name:var(--font-geist-mono)]">{slug || 'slug'}.rally.vin</span></li>
            <li>Plesk vhost created with reverse proxy to port 3004</li>
            <li>Let&apos;s Encrypt SSL certificate requested</li>
            <li>Firestore group document seeded with config</li>
            <li>Principal user account created in Firebase Auth</li>
            <li>Audit log entry written</li>
          </ol>
          <p className="text-xs text-text-tertiary mt-3">
            On failure, all completed infrastructure steps are automatically rolled back.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
