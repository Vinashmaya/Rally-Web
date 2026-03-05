'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, ShieldAlert } from 'lucide-react';
import { Button, Input, useToast } from '@rally/ui';
import { useAuthStore } from '@rally/services';

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast({ type: 'error', title: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);

      // Verify super admin status — non-admins are signed out immediately
      const { isSuperAdmin } = useAuthStore.getState();
      if (!isSuperAdmin) {
        await signOut();
        toast({
          type: 'error',
          title: 'Access denied',
          description: 'This portal is restricted to super administrators.',
        });
        return;
      }

      router.push('/');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sign in failed. Please try again.';
      toast({ type: 'error', title: 'Sign in failed', description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold font-mono text-rally-gold tracking-tight">
          RALLY
        </h1>
        <p className="text-sm text-text-secondary flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          Super Admin
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="admin@rally.vin"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          startIcon={<Mail className="h-4 w-4" />}
          required
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          startIcon={<Lock className="h-4 w-4" />}
          required
          autoComplete="current-password"
        />

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
          <LogIn className="h-4 w-4" />
          Sign In
        </Button>

        <p className="text-xs text-text-tertiary text-center">
          Restricted access. Super admin only.
        </p>
      </form>
    </div>
  );
}
