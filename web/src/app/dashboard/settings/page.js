'use client';

import { useEffect, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { PageHeader, Card, Button, ErrorBanner } from '@/components/ui';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getSupportedTimezones() {
  if (typeof Intl.supportedValuesOf !== 'function') return ['UTC'];
  return [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])];
}

function SaveBar({ saving, saved }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      {saved && <span className="text-sm text-signal-green">Saved</span>}
    </div>
  );
}

export default function SettingsPage() {
  const { currentBusinessId, user, updateUser } = useAuth();
  const [business, setBusiness] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentBusinessId) return;
    api.get(`/api/business/${currentBusinessId}`)
      .then((data) => setBusiness(data.business))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, [currentBusinessId]);

  if (loading) return <p className="text-sm text-ink-600">Loading…</p>;
  if (!business) return <ErrorBanner message={error || 'Could not load this business.'} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your business profile, assistant identity, and working hours." />
      <ErrorBanner message={error} />
      <ProfileSection user={user} onUserUpdated={updateUser} setError={setError} />
      <GeneralSection businessId={currentBusinessId} business={business} onSaved={setBusiness} setError={setError} />
      <AssistantSection businessId={currentBusinessId} business={business} onSaved={setBusiness} setError={setError} />
      <HoursSection businessId={currentBusinessId} business={business} onSaved={setBusiness} setError={setError} />
    </div>
  );
}

function ProfileSection({ user, onUserUpdated, setError }) {
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const data = await api.put('/api/auth/profile', form);
      onUserUpdated(data.user);
      setForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || '',
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-1 font-display text-lg text-ink-900">My profile</h2>
      <p className="mb-4 text-sm text-ink-600">Update the name and phone number on your account.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="First name"
            required
            maxLength={60}
            value={form.firstName}
            onChange={(value) => setForm((current) => ({ ...current, firstName: value }))}
          />
          <Field
            label="Last name"
            required
            maxLength={60}
            value={form.lastName}
            onChange={(value) => setForm((current) => ({ ...current, lastName: value }))}
          />
          <Field
            label="Phone"
            type="tel"
            maxLength={30}
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-sm text-ink-800">Email</label>
            <input
              id="profile-email"
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full rounded border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-ink-600"
            />
            <p className="mt-1 text-xs text-ink-600">Contact support if you need to change your sign-in email.</p>
          </div>
        </div>
        <SaveBar saving={saving} saved={saved} />
      </form>
    </Card>
  );
}

function GeneralSection({ businessId, business, onSaved, setError }) {
  const [form, setForm] = useState({
    name: business.name || '',
    primaryColor: business.primaryColor || '#3B82F6',
    email: business.contact?.email || '',
    phone: business.contact?.phone || '',
    website: business.contact?.website || '',
    industry: business.contact?.industry || '',
    description: business.contact?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const data = await api.put(`/api/business/${businessId}`, {
        name: form.name,
        primaryColor: form.primaryColor,
        contact: {
          email: form.email, phone: form.phone, website: form.website,
          industry: form.industry, description: form.description,
        },
      });
      onSaved(data.business);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save general settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg text-ink-900 mb-4">General</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Business name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <Field label="Brand color" type="color" value={form.primaryColor} onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))} className="h-9" />
          <Field label="Support email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Field label="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
          <Field label="Industry" value={form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} />
        </div>
        <Field label="Description" textarea value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        <SaveBar saving={saving} saved={saved} />
      </form>
    </Card>
  );
}

function AssistantSection({ businessId, business, onSaved, setError }) {
  const [form, setForm] = useState({
    name: business.assistant?.name || 'Assistant',
    personality: business.assistant?.personality || 'professional, helpful, friendly',
    systemPrompt: business.assistant?.systemPrompt || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const data = await api.put(`/api/business/${businessId}`, { assistant: form });
      onSaved(data.business);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save assistant settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg text-ink-900 mb-4">Assistant</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assistant name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Personality" value={form.personality} onChange={(v) => setForm((f) => ({ ...f, personality: v }))} />
        </div>
        <Field
          label="Extra instructions" textarea maxLength={4000}
          value={form.systemPrompt} onChange={(v) => setForm((f) => ({ ...f, systemPrompt: v }))}
          placeholder="Anything specific the assistant should always do or avoid…"
        />
        <SaveBar saving={saving} saved={saved} />
      </form>
    </Card>
  );
}

function HoursSection({ businessId, business, onSaved, setError }) {
  const initial = business.businessHours || {};
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [timezone, setTimezone] = useState(
    initial.timezone || business.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [timezones, setTimezones] = useState([]);
  const [outOfHoursMessage, setOutOfHoursMessage] = useState(initial.outOfHoursMessage || '');
  const [schedule, setSchedule] = useState(() => {
    const s = {};
    for (const day of DAYS) {
      s[day] = initial.schedule?.[day] || { start: '09:00', end: '18:00', enabled: day !== 'saturday' && day !== 'sunday' };
    }
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimezones(getSupportedTimezones());
  }, []);

  const updateDay = (day, patch) => setSchedule((s) => ({ ...s, [day]: { ...s[day], ...patch } }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const data = await api.put(`/api/business/${businessId}`, {
        businessHours: { enabled, timezone, schedule, outOfHoursMessage },
      });
      onSaved(data.business);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save business hours.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg text-ink-900 mb-4">Business hours</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enforce business hours and add an after-hours note to replies
        </label>

        {enabled && (
          <>
            <div>
              <label htmlFor="business-hours-timezone" className="mb-1.5 block text-sm text-ink-800">Timezone</label>
              <select
                id="business-hours-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass"
              >
                {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
                {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-600">Your schedule and after-hours notices use this timezone.</p>
            </div>
            <Field
              label="Message added outside business hours"
              textarea
              maxLength={500}
              value={outOfHoursMessage}
              onChange={setOutOfHoursMessage}
              placeholder="Optional extra note. The assistant will add your next opening day and time automatically."
            />
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <label className="flex w-full items-center gap-2 text-sm text-ink-800 capitalize sm:w-32">
                    <input
                      type="checkbox"
                      checked={schedule[day].enabled}
                      onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                    />
                    {day}
                  </label>
                  <input
                    type="time" value={schedule[day].start} disabled={!schedule[day].enabled}
                    onChange={(e) => updateDay(day, { start: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm disabled:opacity-40 sm:flex-none"
                  />
                  <span className="text-ink-600 text-sm">to</span>
                  <input
                    type="time" value={schedule[day].end} disabled={!schedule[day].enabled}
                    onChange={(e) => updateDay(day, { end: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm disabled:opacity-40 sm:flex-none"
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <SaveBar saving={saving} saved={saved} />
      </form>
    </Card>
  );
}

function Field({ label, textarea, className = '', ...props }) {
  const Tag = textarea ? 'textarea' : 'input';
  return (
    <div>
      <label className="block text-sm text-ink-800 mb-1.5">{label}</label>
      <Tag
        {...props}
        rows={textarea ? 3 : undefined}
        onChange={(e) => props.onChange(e.target.value)}
        className={`w-full rounded border border-stone-300 px-3 py-2 text-sm focus:border-brass focus:ring-1 focus:ring-brass ${className}`}
      />
    </div>
  );
}
