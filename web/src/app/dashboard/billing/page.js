'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, Button, ErrorBanner } from '@/components/ui';
import { PLANS, planById } from '@/lib/plans';

const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '-');

function BillingContent() {
  const { currentBusinessId, currentBusiness, refresh } = useAuth();
  const params = useSearchParams();
  const justPaid = params.get('paid') === '1';
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.get('/api/billing/plans', { skipAuth: true }).then((r) => setLive(r.plans)).catch((e) => setError(e.message));
  }, []);

  // After paying, the webhook updates the business a few seconds later - re-check a couple of times
  useEffect(() => {
    if (!justPaid) return undefined;
    const timers = [4000, 10000, 20000].map((ms) => setTimeout(() => refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [justPaid, refresh]);

  const sub = currentBusiness?.subscription || {};
  const current = planById(sub.plan);
  const active = Boolean(current) && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
  const used = currentBusiness?.usage?.messagesThisMonth || 0;
  const quota = currentBusiness?.limits?.messagesPerMonth || 0;

  const go = async (kind, plan) => {
    setBusy(plan || kind);
    setError('');
    try {
      const r = await api.post(`/api/billing/${currentBusinessId}/${kind}`, plan ? { plan } : {});
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      setBusy('');
    }
  };

  const statusBadge = active
    ? (sub.cancelAtPeriodEnd ? <Badge tone="amber">Ends {fmt(sub.currentPeriodEnd)}</Badge> : sub.status === 'past_due' ? <Badge tone="amber">Payment issue</Badge> : <Badge tone="green">Active</Badge>)
    : <Badge tone="red">Not active</Badge>;

  return (
    <div>
      <PageHeader title="Billing" description="Your Luxus Bot subscription." />
      <ErrorBanner message={error} />
      {justPaid && !active && (
        <div className="mb-4 rounded border border-stone-200 bg-white px-4 py-3 text-sm text-ink-700">
          Thanks - we&apos;re confirming your payment. This page updates in a few seconds.
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl text-ink-900">{current ? `${current.name} - $${current.price}/month` : 'No active plan'}</h2>
            <p className="mt-1 text-sm text-ink-600">
              {sub.paymentProvider === 'kora'
                ? 'Paid monthly through Kora. Renew manually to keep your subscription active.'
                : (sub.paymentProvider === 'paystack' || sub.paystackCustomerCode || sub.paystackSubscriptionCode)
                  ? 'Billed monthly through your previous automatic subscription.'
                  : 'Choose a plan to subscribe through Kora.'}
            </p>
          </div>
          {statusBadge}
        </div>

        {active ? (
          <div className="mt-5 space-y-1 text-sm text-ink-700">
            <p>{sub.cancelAtPeriodEnd ? 'Access until' : 'Next payment'}: <strong>{fmt(sub.currentPeriodEnd)}</strong></p>
            <p>AI replies this month: <strong>{used.toLocaleString()}</strong> of {quota.toLocaleString()}</p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink-700">
            Your subscription is not active, so the AI is paused. Your customers&apos; chats are passed to your team instead. Choose a plan below to turn it back on.
          </p>
        )}

        {active && sub.paymentProvider !== 'kora' && (sub.paymentProvider === 'paystack' || sub.paystackCustomerCode || sub.paystackSubscriptionCode) && (
          <div className="mt-5">
            <Button variant="secondary" disabled={busy === 'portal'} onClick={() => go('portal')}>
              {busy === 'portal' ? 'Opening…' : 'Manage previous automatic subscription'}
            </Button>
          </div>
        )}
      </Card>

      <h3 className="mb-3 mt-8 font-display text-lg text-ink-900">{active ? 'Change plan' : 'Choose a plan'}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const configured = live ? Boolean(live.find((x) => x.id === p.id)?.configured) : true;
          const isCurrent = active && current?.id === p.id && !sub.cancelAtPeriodEnd;
          return (
            <Card key={p.id}>
              <h4 className="font-display text-lg text-ink-900">{p.name}</h4>
              <p className="mt-1 text-2xl font-display text-ink-900">${p.price}<span className="text-sm text-ink-600">/month</span></p>
              {live?.find((x) => x.id === p.id)?.paymentCurrency && (
                <p className="text-xs text-ink-600">
                  Charged in {live.find((x) => x.id === p.id).paymentCurrency}; converted at checkout using Kora&apos;s rate.
                </p>
              )}
              <ul className="my-3 space-y-1 text-sm text-ink-700">
                {p.features.slice(0, 3).map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Button
                className="w-full"
                disabled={(isCurrent && sub.paymentProvider !== 'kora') || !configured || busy === p.id}
                onClick={() => go('checkout', p.id)}
              >
                {isCurrent && sub.paymentProvider !== 'kora'
                  ? 'Current plan'
                  : busy === p.id
                    ? 'Opening checkout…'
                    : !configured
                      ? 'Not available yet'
                      : isCurrent
                        ? `Renew ${p.name} - $${p.price}`
                        : active
                          ? `Switch to ${p.name}`
                          : `Subscribe - $${p.price}`}
              </Button>
            </Card>
          );
        })}
      </div>
      {active && <p className="mt-3 text-xs text-ink-600">Kora payments do not renew automatically. Renew before your current period ends to extend access; changing plans starts a new month from the payment date.</p>}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}
