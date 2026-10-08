'use client';

import { useEffect, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Button, ErrorBanner } from '@/components/ui';

const input = 'w-full rounded border border-stone-300 px-3 py-2 text-sm';

export default function RoutingPage() {
  const { currentBusinessId } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [rules, setRules] = useState([]);
  const [humanDept, setHumanDept] = useState('');
  const [fallback, setFallback] = useState('');
  const [notice, setNotice] = useState('');
  const [unavailableNotice, setUnavailableNotice] = useState('');
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentBusinessId) return;
    Promise.all([
      api.get(`/api/business/${currentBusinessId}/routing`),
      api.get(`/api/business/${currentBusinessId}/team`),
    ]).then(([r, t]) => {
      const x = r.routing || {};
      setEnabled(!!x.enabled);
      setRules((x.rules || []).map((rule) => ({ department: rule.department, keywords: (rule.keywords || []).join(', ') })));
      setHumanDept(x.humanRequestDepartment || '');
      setFallback(x.fallbackAgentId || '');
      setNotice(x.customerNotice || '');
      setUnavailableNotice(x.customerUnavailableNotice || '');
      setMembers((t.members || []).filter((m) => m.status === 'active' && m.role !== 'viewer'));
      setDepartments(t.departments || []);
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load routing settings.'));
  }, [currentBusinessId]);

  const setRule = (i, patch) => setRules((list) => list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.put(`/api/business/${currentBusinessId}/routing`, {
        enabled,
        rules: rules.map((r) => ({ department: r.department, keywords: r.keywords.split(',').map((k) => k.trim()).filter(Boolean) })),
        humanRequestDepartment: humanDept,
        fallbackAgentId: fallback || null,
        customerNotice: notice,
        customerUnavailableNotice: unavailableNotice,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Auto-routing" description="Send chats to a department queue. Online teammates in that department receive the chats." />
      <ErrorBanner message={error} />
      <Card className="mb-5">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Turn on auto-routing</span>
        </label>
        <p className="mt-2 text-xs text-ink-600">Online teammates are assigned one at a time. If nobody in the department is online, the conversation waits in that department and is assigned as soon as a teammate connects.</p>
      </Card>

      <Card className="mb-5">
        <h2 className="font-medium text-ink-900">Rules</h2>
        <p className="mb-3 mt-1 text-xs text-ink-600">Checked top to bottom. Departments are created on the Team page; invite or assign teammates to each department there. Keywords of 4+ letters also match endings (refund matches refunds, refunded); short ones match whole words only.</p>
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <select className={`${input} sm:w-40`} value={r.department} onChange={(e) => setRule(i, { department: e.target.value })}>
                <option value="">Select department</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <input className={input} placeholder="Keywords, comma separated" value={r.keywords} onChange={(e) => setRule(i, { keywords: e.target.value })} />
              <button type="button" className="self-start text-sm text-signal-red sm:self-center" onClick={() => setRules((l) => l.filter((_, idx) => idx !== i))}>Remove</button>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setRules((l) => [...l, { department: '', keywords: '' }])}>Add rule</Button>
      </Card>

      <Card className="mb-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm">When a customer asks for a human, send to department</label>
          <select className={input} value={humanDept} onChange={(e) => setHumanDept(e.target.value)}>
            <option value="">Select department</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-600">This department also receives chats when the AI is unavailable and a live person is needed.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Fallback person (used only when no department is selected)</label>
          <select className={input} value={fallback} onChange={(e) => setFallback(e.target.value)}>
            <option value="">No fallback person</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</option>)}
          </select>
        </div>
        <p className="text-xs text-ink-600">When a department is selected, chats stay in that department queue if nobody is online; they are not redirected to an unrelated person.</p>
        <div>
          <label className="mb-1.5 block text-sm">Message shown to the customer when handed over</label>
          <textarea className={input} rows={2} maxLength={300} value={notice} onChange={(e) => setNotice(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm">Message shown when no team member is online</label>
          <textarea className={input} rows={2} maxLength={300} value={unavailableNotice} onChange={(e) => setUnavailableNotice(e.target.value)} placeholder="Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible." />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </div>
  );
}
