'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from 'recharts';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, ErrorBanner } from '@/components/ui';

export default function AnalyticsPage() {
  const { currentBusinessId } = useAuth();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentBusinessId) return;
    api.get(`/api/business/${currentBusinessId}/analytics/dashboard?period=${period}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load analytics.'));
  }, [currentBusinessId, period]);

  const download = async () => {
    try {
      const token = localStorage.getItem('luxus_token');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${base}/api/business/${currentBusinessId}/analytics/export?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'luxus-bot-analytics.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  return <div>
    <PageHeader title="Analytics" description="Conversation, response and customer activity over time." />
    <ErrorBanner message={error} />
    <div className="mb-5 flex flex-wrap gap-2">
      {['7d','30d','90d'].map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded border px-3 py-1.5 text-sm ${period === p ? 'bg-ink-900 text-white' : 'border-stone-300'}`}>{p}</button>)}
      <button onClick={download} className="w-full rounded border border-stone-300 px-3 py-2 text-sm sm:ml-auto sm:w-auto sm:py-1.5">Export CSV</button>
    </div>
    {data && <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-5">
        {[[data.totals.conversations,'Conversations'],[data.totals.messages,'Messages'],[data.totals.resolved,'Resolved'],[`${data.totals.resolutionRate.toFixed(1)}%`,'Resolution rate'],[data.totals.newContacts,'New contacts']].map(([v,l]) => <Card key={l}><p className="text-xs text-ink-600">{l}</p><p className="mt-1 font-display text-2xl">{v}</p></Card>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><h2 className="mb-4 font-display text-lg">Conversations</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="_id" tick={{fontSize:10}} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="conversations" /></BarChart></ResponsiveContainer></div></Card>
        <Card><h2 className="mb-4 font-display text-lg">Messages</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="_id" tick={{fontSize:10}} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="messages" /></LineChart></ResponsiveContainer></div></Card>
      </div>
    </>}
  </div>;
}
