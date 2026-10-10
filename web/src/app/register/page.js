'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import AuthShell from '@/components/AuthShell';
import AuthField from '@/components/AuthField';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import SocialSignInButtons from '@/components/SocialSignInButtons';
import { PLANS } from '@/lib/plans';
import { IconBuilding, IconMail, IconSpinner, IconUser } from '@/components/icons';

export default function RegisterPage() {
  const router = useRouter();
  const {
    completeLogin,
    pendingGoogleCredential,
    consumePendingGoogleCredential,
  } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    plan: 'individual',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [socialSignup, setSocialSignup] = useState(null);

  const update = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  const onGoogleCredential = useCallback(async (credential) => {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post('/api/auth/google', { credential }, { skipAuth: true });
      if (result.registered) {
        await completeLogin(result);
        router.push(result.requiresPayment ? '/dashboard/billing' : '/dashboard');
        return;
      }

      setGoogleCredential(credential);
      setForm((current) => ({
        ...current,
        email: result.profile.email,
        firstName: result.profile.firstName || current.firstName,
        lastName: result.profile.lastName || current.lastName,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [completeLogin, router]);

  useEffect(() => {
    if (!pendingGoogleCredential) return;
    const credential = consumePendingGoogleCredential();
    if (credential) onGoogleCredential(credential);
  }, [consumePendingGoogleCredential, onGoogleCredential, pendingGoogleCredential]);

  useEffect(() => {
    const stored = sessionStorage.getItem('luxus_social_signup');
    if (!stored) return;
    sessionStorage.removeItem('luxus_social_signup');
    try {
      const signup = JSON.parse(stored);
      if (!signup.ticket || !signup.profile?.email) throw new Error('Invalid social signup data');
      setSocialSignup(signup);
      setForm((current) => ({
        ...current,
        email: signup.profile.email,
        firstName: signup.profile.firstName || current.firstName,
        lastName: signup.profile.lastName || current.lastName,
      }));
    } catch {
      setError('Social sign-in expired. Please try again.');
    }
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = socialSignup
        ? await api.post('/api/billing/social-signup', {
          ticket: socialSignup.ticket,
          businessName: form.businessName,
          plan: form.plan,
        }, { skipAuth: true })
        : googleCredential
        ? await api.post('/api/billing/google-signup', {
          credential: googleCredential,
          firstName: form.firstName,
          lastName: form.lastName,
          businessName: form.businessName,
          plan: form.plan,
        }, { skipAuth: true })
        : await api.post('/api/billing/signup', form, { skipAuth: true });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  const selectedPlan = PLANS.find((plan) => plan.id === form.plan) || PLANS[1];

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="font-display text-2xl text-ink-900">Create your workspace</h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-600">Choose a plan and complete payment. Your account is created automatically after payment succeeds.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <div role="alert" className="rounded-md border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <AuthField label="First name" icon={IconUser} autoComplete="given-name" required value={form.firstName} onChange={update('firstName')} />
          <AuthField label="Last name" autoComplete="family-name" required value={form.lastName} onChange={update('lastName')} />
        </div>
        <AuthField label="Business name" icon={IconBuilding} autoComplete="organization" required value={form.businessName} onChange={update('businessName')} />
        <AuthField
          label="Email"
          icon={IconMail}
          type="email"
          autoComplete="email"
          required
          readOnly={Boolean(googleCredential || socialSignup)}
          value={form.email}
          onChange={update('email')}
        />
        {(googleCredential || socialSignup) && (
          <p className="-mt-2 text-xs text-ink-600">
            {socialSignup ? 'Your email was verified by your social provider.' : 'Google verified this address.'} Select a plan and complete payment to create your account.
          </p>
        )}

        <div>
          <label htmlFor="plan" className="mb-1.5 block text-sm text-ink-800">Plan</label>
          <select
            id="plan"
            value={form.plan}
            onChange={update('plan')}
            className="w-full rounded-md border border-stone-300 bg-white py-2.5 pl-3 pr-3 text-sm text-ink-900 transition focus:border-brass focus:outline-none focus:ring-1 focus:ring-brass"
          >
            {PLANS.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — ${plan.price}/month
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-600/70">{selectedPlan.tagline}</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
          {submitting ? 'Opening secure checkout…' : `Pay $${selectedPlan.price} and create account`}
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

      <p className="mt-7 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brass-dark hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
