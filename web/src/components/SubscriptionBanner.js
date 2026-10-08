'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

/** Shown on every dashboard page while the subscription is lapsed (AI is paused). */
export default function SubscriptionBanner() {
  const { currentBusiness } = useAuth();
  if (!currentBusiness) return null;
  const sub = currentBusiness.subscription || {};
  const active = ['pro', 'individual', 'enterprise'].includes(sub.plan) && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date();
  if (active) return null;
  return (
    <div role="alert" className="mb-6 rounded border border-signal-amber/40 bg-signal-amber/10 px-4 py-3 text-sm text-ink-800">
      Your subscription is not active, so the AI assistant is paused and customer chats go to your team.{' '}
      <Link href="/dashboard/billing" className="font-medium text-brass-dark underline">Renew in Billing</Link>
    </div>
  );
}
