'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api, { ApiError } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import AuthField from '@/components/AuthField';
import { IconLock, IconSpinner, IconCheck } from '@/components/icons';

const PASSWORD_MIN = 8;

function SetPassword() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const welcome = params.get('welcome') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < PASSWORD_MIN) return setError(`Use at least ${PASSWORD_MIN} characters.`);
    if (password !== confirm) return setError('The two passwords do not match.');
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password }, { skipAuth: true });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="font-display text-2xl text-ink-900">This link is incomplete</h2>
        <p className="mt-2 text-sm text-ink-600">Open the link from your email again, or request a new one.</p>
        <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-brass-dark hover:underline">Forgot password</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-signal-green/10 text-signal-green">
          <IconCheck className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-2xl text-ink-900">Password saved</h2>
        <p className="mt-1.5 text-sm text-ink-600">You can sign in now.</p>
        <Link href="/login" className="mt-6 inline-block rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800">Sign in</Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-display text-2xl text-ink-900">{welcome ? 'Set your password' : 'Choose a new password'}</h2>
        <p className="mt-1.5 text-sm text-ink-600">{welcome ? 'Your payment went through. Pick a password to sign in.' : 'Pick a password you have not used elsewhere.'}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red">{error}</div>
        )}
        <AuthField label="Password" icon={IconLock} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint={`At least ${PASSWORD_MIN} characters`} />
        <AuthField label="Confirm password" icon={IconLock} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-md bg-ink-900 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50">
          {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
          {submitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SetPassword />
      </Suspense>
    </AuthShell>
  );
}
