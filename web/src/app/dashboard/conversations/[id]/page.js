'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Badge, Button, ErrorBanner } from '@/components/ui';

function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ConversationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentBusinessId } = useAuth();

  const [conversation, setConversation] = useState(null);
  const [team, setTeam] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferType, setTransferType] = useState('department');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [note, setNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!currentBusinessId) return;
    setLoading(true);
    api.get(`/api/business/${currentBusinessId}/conversations/${id}`)
      .then((data) => setConversation(data.conversation))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this conversation.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusinessId, id]);

  useEffect(() => {
    if (!currentBusinessId) return;
    api.get(`/api/business/${currentBusinessId}/team`)
      .then((data) => {
        setTeam(data.members.filter((m) => m.status === 'active'));
        setDepartments(data.departments || []);
      })
      .catch(() => {}); // non-critical - the transfer picker just won't populate
  }, [currentBusinessId]);

  const onTransfer = async (e) => {
    e.preventDefault();
    if (transferType === 'department' ? !selectedDepartment : !selectedAgent) return;
    setTransferring(true);
    setError('');
    try {
      const recipient = transferType === 'department'
        ? { department: selectedDepartment }
        : { agentId: selectedAgent };
      await api.post(`/api/business/${currentBusinessId}/conversations/${id}/transfer`, { ...recipient, note });
      setShowTransfer(false);
      setNote('');
      setSelectedAgent('');
      setSelectedDepartment('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not transfer this conversation.');
    } finally {
      setTransferring(false);
    }
  };

  const onReturnToAI = async () => {
    setError('');
    try {
      await api.post(`/api/business/${currentBusinessId}/conversations/${id}/return-to-ai`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not return this conversation to the AI.');
    }
  };

  const onSendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/api/business/${currentBusinessId}/conversations/${id}/reply`, { message: reply.trim() });
      setReply('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that reply.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-600">Loading…</p>;
  if (!conversation) return <ErrorBanner message={error || 'Conversation not found.'} />;

  return (
    <div>
      <Link href="/dashboard/conversations" className="text-sm text-ink-600 hover:text-ink-900">← Conversations</Link>

      <div className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl text-ink-900">{conversation.contact?.name || conversation.phoneNumber}</h1>
          <p className="text-sm text-ink-600">{conversation.phoneNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={conversation.status === 'resolved' ? 'green' : conversation.status === 'escalated' ? 'amber' : 'neutral'}>
            {conversation.status}
          </Badge>
          {conversation.handoffMode === 'human' ? (
            <>
              <Button variant="secondary" onClick={onReturnToAI}>Return to AI</Button>
              <Button variant="primary" onClick={() => setShowTransfer(true)}>Transfer</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setShowTransfer(true)}>Transfer</Button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} />

      {conversation.handoffMode === 'human' && conversation.assignedAgent && (
        <div className="mb-4 rounded border border-brass/30 bg-brass/5 px-4 py-2.5 text-sm text-ink-800">
          Handed off to <strong>{conversation.assignedAgent.name}</strong>
          {conversation.assignedDepartment && <> · <strong>{conversation.assignedDepartment}</strong> department</>}
          {conversation.transferNote && <> — &ldquo;{conversation.transferNote}&rdquo;</>}
        </div>
      )}

      {conversation.status === 'escalated' && !conversation.assignedAgent && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {conversation.assignedDepartment
            ? `Waiting in the ${conversation.assignedDepartment} department queue. It will be assigned when a teammate comes online.`
            : 'No teammate is assigned yet. The customer was told the team is unavailable; assign the conversation when someone is online.'}
        </div>
      )}

      <div className="rounded border border-stone-200 bg-white">
        <div className="max-h-[55vh] space-y-4 overflow-y-auto p-3 sm:p-5">
          {conversation.messages.length === 0 ? (
            <p className="text-sm text-ink-600">No messages yet.</p>
          ) : (
            conversation.messages.map((m, i) => (
                <div key={i} className={`flex min-w-0 ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[90%] break-words rounded-lg px-3.5 py-2 text-sm [overflow-wrap:anywhere] sm:max-w-[75%] ${
                  m.role === 'user' ? 'bg-stone-100 text-ink-900' : 'bg-ink-900 text-white'
                }`}>
                  <p>{m.content}</p>
                  <p className={`mt-1 text-[11px] ${m.role === 'user' ? 'text-ink-600' : 'text-stone-300'}`}>
                    {m.metadata?.sentBy === 'agent' ? 'Agent' : m.role === 'user' ? 'Customer' : 'Assistant'} · {formatWhen(m.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {conversation.handoffMode === 'human' && (
          <form onSubmit={onSendReply} className="flex flex-col gap-2 border-t border-stone-200 p-3 sm:flex-row">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply as this business…"
              className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
            />
            <Button type="submit" className="w-full sm:w-auto" disabled={sending || !reply.trim()}>{sending ? 'Sending…' : 'Send'}</Button>
          </form>
        )}
      </div>

      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/40 px-4 py-6 sm:items-center sm:px-6" role="dialog" aria-modal="true">
          <form onSubmit={onTransfer} className="my-auto w-full max-w-sm rounded bg-white p-5 shadow-lg">
            <h2 className="font-display text-lg text-ink-900 mb-4">Transfer conversation</h2>

            <label htmlFor="recipient-type" className="block text-sm text-ink-800 mb-1.5">Transfer to</label>
            <select
              id="recipient-type"
              value={transferType}
              onChange={(e) => setTransferType(e.target.value)}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm mb-4"
            >
              <option value="department">Department queue</option>
              <option value="agent">A specific teammate</option>
            </select>

            {transferType === 'department' ? (
              <>
                <label htmlFor="department" className="block text-sm text-ink-800 mb-1.5">Department</label>
                <select
                  id="department"
                  required
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm mb-4"
                >
                  <option value="">Choose a department…</option>
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </>
            ) : (
              <>
                <label htmlFor="agent" className="block text-sm text-ink-800 mb-1.5">Teammate</label>
                <select
                  id="agent"
                  required
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm mb-4"
                >
                  <option value="">Choose someone…</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.role})</option>
                  ))}
                </select>
              </>
            )}

            <label htmlFor="note" className="block text-sm text-ink-800 mb-1.5">Note (optional)</label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm mb-4"
              placeholder="Why you're handing this off…"
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowTransfer(false)}>Cancel</Button>
              <Button type="submit" disabled={transferring || (transferType === 'department' ? !selectedDepartment : !selectedAgent)}>
                {transferring ? 'Transferring…' : 'Transfer'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
