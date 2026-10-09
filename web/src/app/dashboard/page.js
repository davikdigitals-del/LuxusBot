'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, ErrorBanner } from '@/components/ui';

const STAT_CARDS = [
  { key: 'conversationsToday', label: 'Conversations today' },
  { key: 'conversationsThisMonth', label: 'Conversations this month' },
  { key: 'messagesToday', label: 'Messages today' },
  { key: 'messagesThisMonth', label: 'Messages this month' },
  { key: 'activeHandoffs', label: 'Waiting on a human' },
  { key: 'totalContacts', label: 'Total contacts' },
];

function formatWhen(iso) {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

export default function DashboardOverview() {
  const { currentBusinessId, user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [localTime, setLocalTime] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateLocalTime = () => setLocalTime(new Date());
    updateLocalTime();
    const interval = setInterval(updateLocalTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentBusinessId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/api/business/${currentBusinessId}/dashboard`),
      api.get(`/api/business/${currentBusinessId}/dashboard/activity`),
    ])
      .then(([dash, act]) => {
        if (cancelled) return;
        setOverview(dash.overview);
        setActivity(act.activity);
      })
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [currentBusinessId]);

  if (loading) return <p className="text-sm text-ink-600">Loading…</p>;

  const hour = localTime?.getHours();
  const timeGreeting = hour === undefined
    ? 'Welcome'
    : hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
  const firstName = user?.firstName?.trim();

  return (
    <div>
      <PageHeader
        title={`${timeGreeting}${firstName ? `, ${firstName}` : ''}`}
        description="Welcome back! Let’s get your business moving."
      />
      <ErrorBanner message={error} />

      {overview && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
            {STAT_CARDS.map(({ key, label }) => (
              <Card key={key}>
                <p className="text-xs text-ink-600">{label}</p>
                <p className="mt-1 font-display text-3xl text-ink-900">{overview[key]}</p>
              </Card>
            ))}
          </div>
          <div className="-mt-4 mb-6 space-y-1 text-xs text-ink-600">
            <p>Conversations count individual customer chats started today or this month. Group chats are excluded.</p>
            <p>Message counts include incoming customer messages and outgoing AI or agent replies. Group chats are excluded.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-8">
            <Card>
              <p className="text-xs text-ink-600 mb-2">AI replies used this month</p>
              <p className="font-display text-2xl text-ink-900">
                {overview.messagesUsed} <span className="text-base text-ink-600 font-sans">/ {overview.messagesLimit}</span>
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-stone-100">
                <div
                  className="h-1.5 rounded-full bg-brass"
                  style={{ width: `${Math.min(100, (overview.messagesUsed / (overview.messagesLimit || 1)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-600">Plan usage counts AI replies, not agent replies.</p>
            </Card>

            <Card>
              <p className="text-xs text-ink-600 mb-2">WhatsApp connection</p>
              <div className="flex items-center gap-2">
                <Badge tone={overview.whatsapp.status === 'connected' ? 'green' : 'amber'}>
                  {overview.whatsapp.status}
                </Badge>
                {overview.whatsapp.phoneNumber && <span className="text-sm text-ink-700">{overview.whatsapp.phoneNumber}</span>}
              </div>
              {overview.whatsapp.status !== 'connected' && (
                <Link href="/dashboard/whatsapp" className="mt-2 inline-block text-sm text-brass-dark hover:underline">
                  Connect now →
                </Link>
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        <p className="text-xs text-ink-600 mb-3">Recent activity</p>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-600">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {activity.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 break-words">
                  <span className="text-ink-900">{item.contactName}</span>
                  {item.intent && <span className="ml-2 text-ink-600">· {item.intent}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {item.handoffMode === 'human' && <Badge tone="amber">with agent</Badge>}
                  <span className="text-xs text-ink-600">{formatWhen(item.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
