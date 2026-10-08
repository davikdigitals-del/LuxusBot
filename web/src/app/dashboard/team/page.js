'use client';

import { useEffect, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Badge, Button, ErrorBanner } from '@/components/ui';

const INVITE_ROLES = ['viewer', 'agent', 'admin'];

export default function TeamPage() {
  const { currentBusinessId, currentRole, user } = useAuth();
  const isOwner = currentRole === 'owner';

  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [departmentName, setDepartmentName] = useState('');
  const [creatingDepartment, setCreatingDepartment] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'agent', department: '' });
  const [inviting, setInviting] = useState(false);

  const load = () => {
    if (!currentBusinessId) return;
    setLoading(true);
    api.get(`/api/business/${currentBusinessId}/team`)
      .then((data) => {
        setMembers(data.members);
        setDepartments(data.departments || []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the team.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentBusinessId]);

  const onCreateDepartment = async (e) => {
    e.preventDefault();
    setCreatingDepartment(true);
    setError('');
    try {
      const data = await api.post(`/api/business/${currentBusinessId}/team/departments`, { name: departmentName });
      setDepartments(data.departments);
      const created = data.departments[data.departments.length - 1];
      setInviteForm((form) => ({ ...form, department: form.department || created }));
      setDepartmentName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create that department.');
    } finally {
      setCreatingDepartment(false);
    }
  };

  const onDeleteDepartment = async (department) => {
    if (!window.confirm(`Delete the "${department}" department? Members will be unassigned from it.`)) return;
    setDeletingDepartment(department);
    setError('');
    try {
      const data = await api.delete(
        `/api/business/${currentBusinessId}/team/departments/${encodeURIComponent(department)}`,
      );
      setDepartments(data.departments);
      setMembers((list) => list.map((member) => ({
        ...member,
        departments: (member.departments || []).filter((value) => value !== department),
      })));
      setInviteForm((form) => form.department === department ? { ...form, department: '' } : form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that department.');
    } finally {
      setDeletingDepartment('');
    }
  };

  const onInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    try {
      await api.post(`/api/business/${currentBusinessId}/team/invite`, inviteForm);
      setInviteForm((form) => ({ ...form, email: '' }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that invite.');
    } finally {
      setInviting(false);
    }
  };

  const onRoleChange = async (userId, role) => {
    setError('');
    try {
      await api.put(`/api/business/${currentBusinessId}/team/${userId}`, { role });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that role.');
    }
  };

  const canTag = currentRole === 'owner' || currentRole === 'admin';
  const onDepartments = async (userId, selectedDepartments) => {
    setError('');
    try {
      const data = await api.put(`/api/business/${currentBusinessId}/team/${userId}/departments`, {
        departments: selectedDepartments,
      });
      setMembers((list) => list.map((x) => (x.id === userId ? { ...x, departments: data.member.departments } : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save departments.');
    }
  };

  const onRemove = async (userId) => {
    setError('');
    try {
      await api.delete(`/api/business/${currentBusinessId}/team/${userId}`);
      setMembers((m) => m.filter((x) => x.id !== userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that person.');
    }
  };

  return (
    <div>
      <PageHeader title="Team" description="Create departments first, then invite teammates into the right department." />
      <ErrorBanner message={error} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-medium text-ink-900">1. Create a department</h2>
          <p className="mb-4 mt-1 text-sm text-ink-600">Departments receive conversations as a shared queue. A teammate who comes online can pick up waiting chats.</p>
          <form onSubmit={onCreateDepartment} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="department-name" className="sr-only">Department name</label>
            <input
              id="department-name"
              required
              maxLength={30}
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g. Support"
              className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={creatingDepartment}>
              {creatingDepartment ? 'Creating…' : 'Create department'}
            </Button>
          </form>
          {departments.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {departments.map((department) => (
                <li key={department} className="inline-flex items-center gap-1 rounded-full bg-stone-100 pl-2.5 pr-1 py-1">
                  <span className="text-xs text-ink-700">{department}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${department} department`}
                    disabled={deletingDepartment === department}
                    onClick={() => onDeleteDepartment(department)}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-ink-500 hover:bg-stone-200 hover:text-signal-red disabled:opacity-50"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-ink-600">No departments yet.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-medium text-ink-900">2. Invite a teammate</h2>
          <p className="mb-4 mt-1 text-sm text-ink-600">Choose the department they will help before sending the invitation.</p>
          <form onSubmit={onInvite} className="flex flex-col gap-3">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm text-ink-800">Email</label>
              <input
                id="email" type="email" required value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="invite-department" className="mb-1.5 block text-sm text-ink-800">Department</label>
                <select
                  id="invite-department"
                  required
                  disabled={!departments.length}
                  value={inviteForm.department}
                  onChange={(e) => setInviteForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-100"
                >
                  <option value="">Select a department</option>
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="role" className="mb-1.5 block text-sm text-ink-800">Role</label>
                <select
                  id="role" value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                >
                  {INVITE_ROLES.filter((r) => r !== 'admin' || isOwner).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            {!departments.length && <p className="text-xs text-amber-800">Create a department above before inviting teammates.</p>}
            <Button type="submit" className="self-start" disabled={inviting || !departments.length}>
              {inviting ? 'Sending…' : 'Send invite'}
            </Button>
          </form>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-medium text-ink-900">Team members</h2>
      {loading ? (
        <p className="text-sm text-ink-600">Loading…</p>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-stone-100">
            {members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-ink-900">{m.firstName} {m.lastName}</p>
                  <p className="break-all text-xs text-ink-600">{m.email}</p>
                  <p className="mt-1 text-xs capitalize text-ink-500">Role: {m.role}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                  {m.status === 'pending' && <Badge tone="amber">pending</Badge>}
                  {isOwner && m.role !== 'owner' && (
                    <select
                      value={m.role}
                      onChange={(e) => onRoleChange(m.id, e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1 text-xs"
                    >
                      {['viewer', 'agent', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  {m.role !== 'viewer' && canTag ? (
                    departments.length ? departments.map((department) => {
                      const selected = (m.departments || []).includes(department);
                      return (
                        <label
                          key={department}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                            selected
                              ? 'border-[#c8ddce] bg-[#e9f2eb] text-[#285b43]'
                              : 'border-stone-200 bg-white text-ink-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => onDepartments(
                              m.id,
                              e.target.checked
                                ? [...(m.departments || []), department]
                                : (m.departments || []).filter((value) => value !== department),
                            )}
                            className="accent-[#285b43]"
                          />
                          {department}
                        </label>
                      );
                    }) : <span className="text-xs text-ink-500">No departments</span>
                  ) : (m.departments?.length > 0
                    ? m.departments.map((department) => <Badge key={department}>{department}</Badge>)
                    : <Badge>No department</Badge>)}
                  {m.role !== 'owner' && m.id !== user?._id && (
                    <button onClick={() => onRemove(m.id)} className="text-sm text-signal-red hover:underline">
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
