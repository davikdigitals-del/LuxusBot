'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import api, { ApiError } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import AuthField from '@/components/AuthField';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import SocialSignInButtons from '@/components/SocialSignInButtons';
import { IconMail, IconLock, IconSpinner } from '@/components/icons';

export default function LoginPage() {
  const { login, completeLogin, setPendingGoogleCredential } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const socialTicketHandled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const ticket = params.get('social_ticket');
    const search = new URLSearchParams(window.location.search);
    const socialError = search.get('social_error');
    if (socialTicketHandled.current) return;
    if (ticket) window.history.replaceState(null, '', window.location.pathname);
    if (socialError) setError(`${socialError === 'github' ? 'GitHub' : 'Discord'} sign-in failed. Please try again.`);
    if (!ticket) return;
    socialTicketHandled.current = true;

    let cancelled = false;
    setSubmitting(true);
    api.post('/api/auth/social/complete', { ticket }, { skipAuth: true })
      .then(async (result) => {
        if (cancelled) return;
        if (!result.registered) {
          sessionStorage.setItem('luxus_social_signup', JSON.stringify({
            ticket: result.signupTicket,
            profile: result.profile,
          }));
          router.push('/register');
          return;
        }
        await completeLogin(result);
        router.push(result.requiresPayment ? '/dashboard/billing' : '/dashboard');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Social sign-in failed. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setSubmitting(false);
      });

    return () => { cancelled = true; };
  }, [completeLogin, router]);

  const onGoogleCredential = async (credential) => {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post('/api/auth/google', { credential }, { skipAuth: true });
      if (!result.registered) {
        setPendingGoogleCredential(credential);
        router.push('/register');
        return;
      }
      await completeLogin(result);
      router.push(result.requiresPayment ? '/dashboard/billing' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink-900">Welcome back</h2>
        <p className="mt-1.5 text-sm text-ink-600">Sign in to keep an eye on your conversations.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red">
            {error}
          </div>
        )}

        <AuthField
          label="Email"
          icon={IconMail}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-ink-800">Password</span>
            <Link href="/forgot-password" className="text-xs text-brass-dark hover:underline">
              Forgot password?
            </Link>
          </div>
          <AuthField
            label={<span className="sr-only">Password</span>}
            icon={IconLock}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-ink-900 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-600">
        <span className="h-px flex-1 bg-stone-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <GoogleSignInButton
        onCredential={onGoogleCredential}
        onError={setError}
      />
      <SocialSignInButtons />

      <p className="mt-8 text-center text-sm text-ink-600">
        New to Luxus Bot?{' '}
        <Link href="/register" className="font-medium text-brass-dark hover:underline">
          Get started
        </Link>
      </p>
    </AuthShell>
  );
}
