'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, EmptyState, ErrorBanner } from '@/components/ui';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'escalated', label: 'With agent' },
  { value: 'resolved', label: 'Resolved' },
];

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ConversationsPage() {
  const { currentBusinessId } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusinessId) return;
    let cancelled = false;
    setLoading(true);
    const query = status ? `?status=${status}` : '';
    api.get(`/api/business/${currentBusinessId}/conversations${query}`)
      .then((data) => !cancelled && setConversations(data.conversations))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'Could not load conversations.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [currentBusinessId, status]);

  return (
    <div>
      <PageHeader title="Conversations" description="Every chat your assistant is handling." />
      <ErrorBanner message={error} />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded px-3 py-1.5 text-sm transition ${
              status === f.value ? 'bg-ink-900 text-white' : 'border border-stone-300 text-ink-700 hover:bg-stone-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-600">Loading…</p>
      ) : conversations.length === 0 ? (
        <EmptyState title="No conversations yet" description="Once your assistant is connected, chats will show up here." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/conversations/${c.id}`} className="flex flex-col gap-2 px-4 py-3.5 transition hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-ink-900">{c.contactName || c.phoneNumber}</p>
                    <p className="text-xs text-ink-600 mt-0.5">
                      {c.intent && `${c.intent} · `}{formatWhen(c.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {c.handoffMode === 'human' && (
                      <Badge tone="amber">{c.assignedAgent ? c.assignedAgent.name : 'with agent'}</Badge>
                    )}
                    <Badge tone={c.status === 'resolved' ? 'green' : c.status === 'escalated' ? 'amber' : 'neutral'}>
                      {c.status}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
