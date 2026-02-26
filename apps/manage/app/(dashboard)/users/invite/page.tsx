'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@rally/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Badge,
  useToast,
} from '@rally/ui';
import {
  USER_ROLE_VALUES,
  USER_ROLE_DISPLAY,
  DEFAULT_PERMISSIONS,
} from '@rally/firebase';
import type { UserRole } from '@rally/firebase';
import { useTenantStore } from '@rally/services';
import { ArrowLeft, Send, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  role: z.enum(USER_ROLE_VALUES as unknown as [string, ...string[]]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

// ---------------------------------------------------------------------------
// Role Selector Component
// ---------------------------------------------------------------------------

interface RoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = value
    ? USER_ROLE_DISPLAY[value as UserRole]
    : 'Select a role...';

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-text-secondary">
        Role
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex h-10 w-full items-center justify-between rounded-rally
            bg-surface-overlay border px-3 py-2 text-sm
            transition-colors duration-150 cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rally-gold
            focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
            ${error ? 'border-status-error' : 'border-surface-border'}
            ${value ? 'text-text-primary' : 'text-text-disabled'}
          `}
        >
          <span>{selectedLabel}</span>
          <ChevronDown
            className={`h-4 w-4 text-text-tertiary transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-rally-lg border border-surface-border bg-surface-raised shadow-rally-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1">
              {USER_ROLE_VALUES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    onChange(role);
                    setIsOpen(false);
                  }}
                  className={`
                    flex w-full items-center gap-3 px-3 py-2 text-sm cursor-pointer
                    transition-colors duration-100
                    ${
                      role === value
                        ? 'bg-rally-goldMuted text-rally-gold'
                        : 'text-text-primary hover:bg-surface-overlay'
                    }
                  `}
                >
                  <span className="flex-1 text-left">
                    {USER_ROLE_DISPLAY[role]}
                  </span>
                  {role === value && (
                    <Badge variant="gold" size="sm">Selected</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function InviteUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      displayName: '',
      phone: '',
      role: '' as UserRole,
    },
  });

  const selectedRole = watch('role');

  const activeGroup = useTenantStore((s) => s.activeGroup);
  const groupId = activeGroup?.id ?? '';

  const onSubmit = async (data: InviteFormValues) => {
    if (!dealershipId || !groupId) {
      toast({
        type: 'error',
        title: 'No store selected',
        description: 'Select a store before inviting users.',
      });
      return;
    }

    try {
      const response = await authFetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          phone: data.phone || undefined,
          dealershipId,
          groupId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to invite user');
      }

      toast({
        type: 'success',
        title: 'Invitation sent',
        description: `${data.displayName} has been invited as ${USER_ROLE_DISPLAY[data.role as UserRole]}.`,
      });

      router.push('/users');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      toast({
        type: 'error',
        title: 'Failed to send invitation',
        description: message,
      });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/users')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Users
      </Button>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Invite User</h1>
        <p className="text-sm text-text-secondary mt-1">
          Send an invitation to a new team member
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-text-primary">
              User Details
            </h2>
            <p className="text-xs text-text-secondary">
              Fill in the details below to invite a new user
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Email */}
            <Input
              label="Email"
              type="email"
              placeholder="user@dealership.com"
              error={errors.email?.message}
              {...register('email')}
            />

            {/* Display Name */}
            <Input
              label="Display Name"
              placeholder="John Smith"
              error={errors.displayName?.message}
              {...register('displayName')}
            />

            {/* Phone */}
            <Input
              label="Phone (Optional)"
              type="tel"
              placeholder="(615) 555-0100"
              error={errors.phone?.message}
              {...register('phone')}
            />

            {/* Role Picker */}
            <RoleSelector
              value={selectedRole}
              onChange={(val) => setValue('role', val as UserRole, { shouldValidate: true })}
              error={errors.role?.message}
            />

            {/* Store Assignment (read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Store Assignment
              </label>
              <div className="flex h-10 w-full items-center rounded-rally bg-surface-overlay border border-surface-border px-3 py-2 text-sm text-text-secondary">
                {activeStore?.name ?? 'No store selected'}
              </div>
              <p className="text-xs text-text-tertiary">
                User will be assigned to the current active store
              </p>
            </div>
          </CardContent>

          <CardFooter className="pt-4">
            <div className="flex items-center gap-3 w-full justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/users')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
              >
                <Send className="h-4 w-4" />
                Send Invitation
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
