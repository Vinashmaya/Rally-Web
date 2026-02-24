'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@rally/ui';
import { Input } from '@rally/ui';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // TODO: Wire up Firebase Auth + 2FA verification
      console.log('Admin login attempt:', email);
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-2xl font-bold text-rally-gold tracking-tight">
          Rally
        </span>
        <h1 className="text-xl font-semibold text-text-primary">
          Sign In
        </h1>
        <p className="text-sm text-text-secondary">
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
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="text-xs text-status-error text-center">{error}</p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Sign In
        </Button>

        <p className="text-xs text-text-tertiary text-center">
          Restricted access. 2FA required.
        </p>
      </form>
    </div>
  );
}
