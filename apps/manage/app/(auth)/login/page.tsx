'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn } from 'lucide-react';
import { Button, Input, useToast } from '@rally/ui';
import { useAuthStore } from '@rally/services';

export default function ManageLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const signIn = useAuthStore((s) => s.signIn);

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
        <p className="text-sm text-text-secondary">
          Management Console
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@dealership.com"
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
      </form>
    </div>
  );
}
