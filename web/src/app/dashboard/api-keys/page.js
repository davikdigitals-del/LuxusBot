'use client';

import { useEffect, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, Button, EmptyState, ErrorBanner } from '@/components/ui';

export default function ApiKeysPage() {
  const { currentBusinessId } = useAuth();
  const [keys, setKeys] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', permissions: [] });
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);

  const load = () => {
    if (!currentBusinessId) return;
    setLoading(true);
    api.get(`/api/business/${currentBusinessId}/api-keys`)
      .then((data) => { setKeys(data.apiKeys); setPermissions(data.availablePermissions); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load API keys.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusinessId]);

  const togglePermission = (p) => setForm((f) => ({
    ...f,
    permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
  }));

  const onCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const data = await api.post(`/api/business/${currentBusinessId}/api-keys`, form);
      setJustCreated(data.apiKey);
      setForm({ name: '', permissions: [] });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that key. (API keys need a paid plan.)');
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (keyId, enabled) => {
    setError('');
    try {
      await api.put(`/api/business/${currentBusinessId}/api-keys/${keyId}`, { enabled });
      setKeys((ks) => ks.map((k) => (k.id === keyId ? { ...k, enabled } : k)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that key.');
    }
  };

  const onRevoke = async (keyId) => {
    setError('');
    try {
      await api.delete(`/api/business/${currentBusinessId}/api-keys/${keyId}`);
      setKeys((ks) => ks.filter((k) => k.id !== keyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke that key.');
    }
  };

  return (
    <div>
      <PageHeader
        title="API keys"
        description="For integrating Luxus Bot with your own systems."
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Create key'}</Button>}
      />
      <ErrorBanner message={error} />

      {justCreated && (
        <Card className="mb-6 border-brass/40 bg-brass/5">
          <p className="text-sm font-medium text-ink-900">Copy this key now - it won&apos;t be shown again.</p>
          <code className="mt-2 block rounded bg-ink-900 px-3 py-2 text-sm text-white break-all">{justCreated}</code>
          <button onClick={() => setJustCreated(null)} className="mt-2 text-sm text-brass-dark hover:underline">Done, I&apos;ve saved it</button>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={onCreate} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm text-ink-800 mb-1.5">Name</label>
              <input
                id="name" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
                placeholder="e.g. CI pipeline, order sync"
              />
            </div>
            <div>
              <p className="text-sm text-ink-800 mb-1.5">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {permissions.map((p) => (
                  <label key={p} className={`rounded border px-2.5 py-1 text-xs cursor-pointer ${
                    form.permissions.includes(p) ? 'border-brass bg-brass/10 text-brass-dark' : 'border-stone-300 text-ink-700'
                  }`}>
                    <input type="checkbox" className="sr-only" checked={form.permissions.includes(p)} onChange={() => togglePermission(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={creating || !form.name || form.permissions.length === 0}>
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-ink-600">Loading…</p>
      ) : keys.length === 0 ? (
        <EmptyState title="No API keys yet" description="Create one to let your own systems talk to Luxus Bot." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{k.name}</p>
                  <p className="mt-0.5 break-words text-xs text-ink-600"><code>{k.prefix}…</code> · {k.permissions.join(', ')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                  <Badge tone={k.enabled ? 'green' : 'neutral'}>{k.enabled ? 'enabled' : 'disabled'}</Badge>
                  <button onClick={() => onToggle(k.id, !k.enabled)} className="text-sm text-ink-700 hover:underline">
                    {k.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => onRevoke(k.id)} className="text-sm text-signal-red hover:underline">Revoke</button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

    </div>
  );
}
