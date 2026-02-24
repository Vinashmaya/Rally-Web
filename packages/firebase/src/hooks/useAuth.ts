'use client';

// Auth hook — Firebase client SDK authentication
// Wraps onAuthStateChanged with React state management

import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setState({ user, loading: false, error: null });
      },
      (error) => {
        setState({ user: null, loading: false, error });
      },
    );

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return credential.user;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign in failed');
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<User> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      return credential.user;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign up failed');
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Sign out failed');
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    signIn,
    signUp,
    signOut,
  };
}
