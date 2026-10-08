'use client';

import { useEffect, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, Button, EmptyState, ErrorBanner } from '@/components/ui';

const CATEGORIES = ['general', 'products', 'pricing', 'policies', 'faq', 'support', 'other'];

export default function KnowledgePage() {
  const { currentBusinessId, currentRole } = useAuth();
  const canEdit = ['owner', 'admin', 'agent'].includes(currentRole);
  const canDelete = ['owner', 'admin'].includes(currentRole);

  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = () => {
    if (!currentBusinessId) return;
    setLoading(true);
    api.get(`/api/business/${currentBusinessId}/knowledge`)
      .then((data) => setDocuments(data.documents))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the knowledge base.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusinessId]);

  const onAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/api/business/${currentBusinessId}/knowledge`, {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setForm({ title: '', content: '', category: 'general', tags: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that document.');
    } finally {
      setSaving(false);
    }
  };

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setError('');
    try {
      const token = localStorage.getItem('luxus_token');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const body = new FormData();
      body.append('file', file); body.append('category', form.category); body.append('tags', form.tags);
      const res = await fetch(`${base}/api/business/${currentBusinessId}/knowledge/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setFile(null); setForm((f) => ({ ...f, tags: '' })); load();
    } catch (err) { setError(err instanceof ApiError ? err.message : err.message || 'Could not upload that file.'); }
    finally { setUploading(false); }
  };

  const onDelete = async (docId) => {
    setError('');
    try {
      await api.delete(`/api/business/${currentBusinessId}/knowledge/${docId}`);
      setDocuments((docs) => docs.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that document.');
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api.post(`/api/business/${currentBusinessId}/knowledge/search`, { query: query.trim() });
      setResults(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        description="What your assistant knows about your business."
        action={canEdit && <Button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add document'}</Button>}
      />
      <ErrorBanner message={error} />

      {canEdit && (
        <Card className="mb-6">
          <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
            <div className="w-full min-w-0 flex-1 sm:min-w-[14rem]">
              <label className="block text-sm text-ink-800 mb-1.5">Upload a knowledge document</label>
              <input type="file" accept=".pdf,.docx,.txt,.md,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-ink-600">PDF, DOCX, TXT, MD or JSON · max 10 MB per file</p>
            </div>
            <Button type="submit" disabled={!file || uploading}>{uploading ? 'Processing…' : 'Upload & process'}</Button>
          </form>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={onAdd} className="space-y-3">
            <div>
              <label htmlFor="title" className="block text-sm text-ink-800 mb-1.5">Title</label>
              <input
                id="title" required maxLength={200} value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm text-ink-800 mb-1.5">Category</label>
              <select
                id="category" value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="content" className="block text-sm text-ink-800 mb-1.5">Content</label>
              <textarea
                id="content" required rows={5} maxLength={50000} value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
                placeholder="What should the assistant know? Paste policies, FAQs, pricing, product details…"
              />
            </div>
            <div>
              <label htmlFor="tags" className="block text-sm text-ink-800 mb-1.5">Tags (comma separated, optional)</label>
              <input
                id="tags" value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save document'}</Button>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Test what the assistant would retrieve for a question…"
            className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
          />
          <Button type="submit" variant="secondary" className="w-full sm:w-auto" disabled={searching || !query.trim()}>
            {searching ? 'Searching…' : 'Test'}
          </Button>
        </form>
        {results && (
          <div className="mt-3 space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-ink-600">No matches - the assistant would fall back to a general answer.</p>
            ) : (
              results.map((r) => (
                <div key={r.id} className="rounded border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                  <p className="font-medium text-ink-900">{r.title}</p>
                  <p className="text-ink-700 mt-0.5">{r.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <p className="text-sm text-ink-600">Loading…</p>
      ) : documents.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Add your FAQs, policies, and product info so the assistant can answer accurately." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-ink-900">{doc.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge>{doc.category}</Badge>
                    {doc.tags?.map((t) => <span key={t} className="text-xs text-ink-600">#{t}</span>)}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => onDelete(doc.id)} className="self-start text-sm text-signal-red hover:underline sm:self-auto">
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
