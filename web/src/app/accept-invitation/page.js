'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import AuthField from '@/components/AuthField';
import { ApiError, default as api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { IconLock, IconMail, IconSpinner } from '@/components/icons';

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, login, refresh } = useAuth();
  const token = searchParams.get('token') || '';
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError('This invitation link is missing its token.');
      setLoading(false);
      return undefined;
    }
    api.get(`/api/auth/invitation?token=${encodeURIComponent(token)}`, { skipAuth: true })
      .then((result) => {
        if (cancelled) return;
        setInvitation(result.invitation);
        setEmail(result.invitation.email);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this invitation.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (invitation.requiresPassword) {
        await api.post('/api/auth/accept-invitation', {
          token,
          password,
          firstName,
          lastName,
        }, { skipAuth: true });
        await login(invitation.email, password);
      } else {
        if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
          if (email.trim().toLowerCase() !== invitation.email.toLowerCase()) {
            throw new Error('Sign in with the email address this invitation was sent to.');
          }
          const loginResult = await login(email, password);
          if (loginResult.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            throw new Error('Sign in with the email address this invitation was sent to.');
          }
        }
        await api.post('/api/auth/accept-invitation', { token });
        await refresh();
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err.message || 'Could not accept this invitation.'));
    } finally {
      setSubmitting(false);
    }
  };

  const alreadySignedInAsInvitee = user && invitation && user.email.toLowerCase() === invitation.email.toLowerCase();

  return (
    <AuthShell>
      <div className="mb-7">
        <h2 className="font-display text-2xl text-ink-900">Accept your invitation</h2>
        {invitation && (
          <p className="mt-2 text-sm text-ink-600">
            Join <strong>{invitation.businessName}</strong> as a <strong>{invitation.role}</strong>
            {invitation.department ? <> in <strong>{invitation.department}</strong></> : ''}.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <IconSpinner className="h-4 w-4 animate-spin" /> Loading invitation…
        </div>
      ) : error && !invitation ? (
        <div role="alert" className="rounded-md border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red">
          {error}
        </div>
      ) : invitation && (
        <form onSubmit={accept} className="space-y-4" noValidate>
          {error && (
            <div role="alert" className="rounded-md border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red">
              {error}
            </div>
          )}

          {invitation.requiresPassword ? (
            <>
              <AuthField label="First name" required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              <AuthField label="Last name" required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              <AuthField label="Email" icon={IconMail} type="email" value={invitation.email} readOnly />
              <AuthField
                label="Create password"
                icon={IconLock}
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </>
          ) : alreadySignedInAsInvitee ? (
            <p className="text-sm text-ink-600">Signed in as {invitation.email}. Accept to join the team.</p>
          ) : (
            <>
              <AuthField
                label="Invited email"
                icon={IconMail}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <AuthField
                label="Password"
                icon={IconLock}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-ink-600">Sign in with the account that received this invitation.</p>
            </>
          )}

          <button
            type="submit"
            disabled={submitting || (!invitation.requiresPassword && !alreadySignedInAsInvitee && !password)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ink-900 py-2.5 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
          >
            {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
            {submitting ? 'Accepting…' : 'Accept invitation'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<AuthShell><p className="text-sm text-ink-600">Loading invitation…</p></AuthShell>}>
      <AcceptInvitationForm />
    </Suspense>
  );
}
