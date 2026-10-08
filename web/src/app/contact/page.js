'use client';

import { useState } from 'react';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import api, { ApiError } from '@/lib/api';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'General questions and support', message: '', website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/contact', form, { skipAuth: true });
      setSent(true);
      setForm({ name: '', email: '', topic: 'General questions and support', message: '', website: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingNav />

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid min-w-0 max-w-6xl gap-8 px-4 py-10 sm:gap-10 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-16 lg:px-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#285b43]">CONTACT</p>
            <h1 className="mt-3 max-w-lg break-words font-display text-3xl leading-tight text-ink-900 sm:text-5xl">A real conversation starts here.</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-ink-600">Questions about getting started, your account, or a larger team? Choose the inbox that fits and tell us what you need.</p>
          </div>

          <div className="min-w-0 w-full max-w-2xl rounded-lg border border-stone-200 bg-[#f7f7f2] p-4 sm:p-6">
            {sent ? (
              <div role="status" className="rounded-md border border-[#c9ded1] bg-white p-5">
                <h2 className="font-display text-2xl text-ink-900">Message sent</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">Thanks for getting in touch. Your message is on its way to our team.</p>
                <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-[#285b43] hover:underline">Send another message</button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl text-ink-900">Send us a message</h2>
                <p className="mt-1 text-sm text-ink-600">We’ll route it to the right team.</p>
                <form onSubmit={submitForm} className="mt-5 min-w-0 space-y-3">
                  {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="contact-website">Website</label>
                    <input id="contact-website" name="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={updateField} />
                  </div>
                  <div>
                    <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-ink-800">Name</label>
                    <input id="contact-name" name="name" autoComplete="name" required maxLength={100} value={form.name} onChange={updateField} className="block w-full min-w-0 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-[#285b43] focus:outline-none focus:ring-1 focus:ring-[#285b43]" />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-ink-800">Email</label>
                    <input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={updateField} className="block w-full min-w-0 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-[#285b43] focus:outline-none focus:ring-1 focus:ring-[#285b43]" />
                  </div>
                  <div>
                    <label htmlFor="contact-topic" className="mb-1.5 block text-sm font-medium text-ink-800">What can we help with?</label>
                    <select id="contact-topic" name="topic" value={form.topic} onChange={updateField} className="block w-full min-w-0 max-w-full rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-[#285b43] focus:outline-none focus:ring-1 focus:ring-[#285b43]">
                      <option>General questions and support</option>
                      <option>Enterprise and custom plans</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-ink-800">Message</label>
                    <textarea id="contact-message" name="message" required rows={4} maxLength={5000} value={form.message} onChange={updateField} className="block w-full min-w-0 max-w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm leading-6 text-ink-900 focus:border-[#285b43] focus:outline-none focus:ring-1 focus:ring-[#285b43]" />
                    <p className="mt-1 text-right text-xs text-ink-600">{form.message.length}/5000</p>
                  </div>
                  <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white transition hover:bg-[#204a36] disabled:cursor-not-allowed disabled:opacity-60">
                    {submitting ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:gap-10 sm:px-8 sm:py-16 md:grid-cols-2 lg:px-10">
        <div>
          <h2 className="font-display text-2xl text-ink-900">Help us get to the point.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-ink-600">A little context helps us route your question. For support, include the email on your account and the page or step where you got stuck.</p>
        </div>
        <div className="border-t-2 border-[#c9ded1] pt-5 md:border-l-2 md:border-t-0 md:pt-0 md:pl-5">
          <h2 className="font-display text-2xl text-ink-900">Still comparing options?</h2>
          <p className="mt-3 text-sm leading-6 text-ink-600">Review what the assistant can do, or find answers about setup, billing, and data handling.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/features" className="text-[#285b43] hover:underline">Explore features</Link>
            <Link href="/faq" className="text-[#285b43] hover:underline">Read common questions</Link>
            <Link href="/pricing" className="text-[#285b43] hover:underline">Compare plans</Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
