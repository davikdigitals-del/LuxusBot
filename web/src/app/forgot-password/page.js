'use client';

import { useState } from 'react';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import AuthShell from '@/components/AuthShell';
import AuthField from '@/components/AuthField';
import { IconMail, IconSpinner, IconCheck } from '@/components/icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await api.post('/api/auth/forgot-password', { email }, { skipAuth: true });
      setResult(response.registered === false ? 'unregistered' : response.registered === true ? 'sent' : 'unknown');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      {result ? (
        <div className="text-center">
          {result === 'unregistered' ? (
            <>
              <h2 className="font-display text-2xl text-ink-900">Email not registered</h2>
              <p className="mt-1.5 text-sm text-ink-600">
                There is no account registered with <span className="text-ink-800">{email}</span>.
              </p>
            </>
          ) : (
            <>
              {result === 'sent' && (
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-signal-green/10 text-signal-green">
                  <IconCheck className="h-5 w-5" />
                </span>
              )}
              <h2 className="mt-4 font-display text-2xl text-ink-900">
                {result === 'sent' ? 'Check your inbox' : 'Request received'}
              </h2>
              <p className="mt-1.5 text-sm text-ink-600">
                {result === 'sent'
                  ? <>A reset link has been sent to <span className="text-ink-800">{email}</span>.</>
                  : <>If an account exists for <span className="text-ink-800">{email}</span>, a reset link is on its way.</>}
              </p>
            </>
          )}
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-ink-900 px-5 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="font-display text-2xl text-ink-900">Reset your password</h2>
            <p className="mt-1.5 text-sm text-ink-600">We&apos;ll email you a link to get back in.</p>
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
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-ink-900 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
            >
              {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-600">
            <Link href="/login" className="font-medium text-brass-dark hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
