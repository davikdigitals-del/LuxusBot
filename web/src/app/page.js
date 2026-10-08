import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import { IconChat, IconHandoff, IconBook, IconCheck } from '@/components/icons';

const FEATURES = [
  { icon: IconChat, title: 'Answers from your own content', body: 'Upload your policies, pricing, and FAQs. Your assistant answers from that - not a generic script.' },
  { icon: IconHandoff, title: 'Hand off without switching apps', body: 'Transfer a conversation to a teammate and they reply from their own WhatsApp. The customer never notices the handoff.' },
  { icon: IconBook, title: 'One dashboard, every conversation', body: 'See every chat your assistant is having, step in when it matters, and keep your team on the same page.' },
];

const STEPS = [
  { n: '01', title: 'Connect your WhatsApp', body: 'Scan a QR code, the same way you\'d link WhatsApp Web - no new number, no app for your customers to install.' },
  { n: '02', title: 'Teach it about your business', body: 'Paste in your FAQs, policies, and product details. Your assistant only answers from what you give it.' },
  { n: '03', title: 'Bring your team in', body: 'Invite teammates with the right role, and transfer a conversation to them the moment it needs a person.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#c9ded1] bg-[#e9f2eb] px-3 py-1.5 text-xs font-medium text-[#285b43]">
            <span className="h-2 w-2 rounded-full bg-[#3f7a5c]" />
            WhatsApp support, with your team in control
          </p>
          <h1 className="mt-6 font-display text-4xl leading-[1.08] text-ink-900 sm:text-5xl">
            Your business, answered with care.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-700 sm:text-lg">
            Give customers fast, useful answers on WhatsApp. Luxus Bot learns from your business content and brings in your team whenever a person is needed.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white transition hover:bg-[#204a36]">
              Explore plans
            </Link>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-md border border-stone-300 bg-white/70 px-5 text-sm font-semibold text-ink-800 transition hover:bg-white">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-600">Setup takes a few minutes. No new WhatsApp number required.</p>
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:ml-auto">
          <div className="overflow-hidden rounded-lg border border-[#d9ddd5] bg-white shadow-[0_24px_70px_-32px_rgba(18,21,28,0.35)]">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#e9f2eb] text-sm font-semibold text-[#285b43]">L</span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">Customer inbox</p>
                  <p className="text-xs text-ink-600">Acme Studio</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f2eb] px-2.5 py-1 text-xs font-medium text-[#285b43]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3f7a5c]" />
                Assistant online
              </span>
            </div>
            <div className="grid min-h-[310px] grid-cols-[150px_1fr] sm:min-h-[350px] sm:grid-cols-[190px_1fr]">
              <div className="hidden border-r border-stone-200 bg-[#fbfbf8] p-3 sm:block">
                <p className="px-2 py-2 text-[11px] font-semibold uppercase text-ink-600">Inbox</p>
                <div className="rounded-md bg-[#e9f2eb] px-2.5 py-2.5">
                  <p className="text-xs font-semibold text-[#285b43]">Maya Johnson</p>
                  <p className="mt-1 truncate text-[11px] text-ink-600">Do you deliver this week?</p>
                </div>
                <div className="px-2.5 py-3">
                  <p className="text-xs font-medium text-ink-800">Daniel Okafor</p>
                  <p className="mt-1 truncate text-[11px] text-ink-600">Thanks for the details</p>
                </div>
                <div className="px-2.5 py-3">
                  <p className="text-xs font-medium text-ink-800">Amara Bello</p>
                  <p className="mt-1 truncate text-[11px] text-ink-600">Can I speak with someone?</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Maya Johnson</p>
                    <p className="text-xs text-ink-600">WhatsApp conversation</p>
                  </div>
                  <span className="rounded border border-[#c9ded1] px-2 py-1 text-[11px] font-medium text-[#285b43]">AI handling</span>
                </div>
                <div className="flex flex-1 flex-col justify-end gap-3 bg-[#fcfcfa] p-4 sm:p-5">
                  <div className="max-w-[88%] self-start rounded-md border border-stone-200 bg-white px-3 py-2.5">
                    <p className="text-xs leading-5 text-ink-800">Hi, do you deliver the starter set this week?</p>
                    <p className="mt-1 text-[10px] text-ink-500">10:42 AM</p>
                  </div>
                  <div className="max-w-[92%] self-end rounded-md bg-[#e9f2eb] px-3 py-2.5">
                    <p className="text-xs leading-5 text-ink-800">Yes, we deliver across Lagos. Orders placed before 2 PM can arrive tomorrow.</p>
                    <p className="mt-1 text-right text-[10px] text-[#52745e]">Answered from your delivery policy</p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-stone-200 pt-3">
                    <span className="h-9 flex-1 rounded-md border border-stone-200 bg-white" />
                    <span className="flex h-9 items-center rounded-md bg-[#285b43] px-3 text-xs font-medium text-white">Reply</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 border-t border-stone-200 bg-white">
              {[
                ['24', 'Chats today'],
                ['18', 'AI answered'],
                ['6', 'Team handoffs'],
              ].map(([value, label]) => (
                <div key={label} className="border-r border-stone-100 px-3 py-3 text-center last:border-r-0 sm:py-4">
                  <p className="font-display text-lg text-ink-900">{value}</p>
                  <p className="text-[10px] text-ink-600 sm:text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-lg font-display text-2xl leading-tight text-ink-900 sm:text-3xl">Everything your team needs to reply well.</h2>
            <p className="max-w-md text-sm leading-6 text-ink-600">One shared workspace for the assistant, your knowledge, and the people behind your business.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="border-t-2 border-[#c9ded1] pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e9f2eb] text-[#285b43]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold text-[#285b43]">A CLEAR START</p>
            <h2 className="mt-3 font-display text-2xl leading-tight text-ink-900 sm:text-3xl">Set up in an afternoon.</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-600">Keep your number, bring your team in when needed, and improve answers with the knowledge you already have.</p>
          </div>
          <ol className="divide-y divide-stone-200 border-y border-stone-200">
            {STEPS.map(({ n, title, body }) => (
              <li key={n} className="grid gap-2 py-5 sm:grid-cols-[52px_1fr] sm:gap-4">
                <span className="font-display text-xl text-[#3f7a5c]">{n}</span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-ink-600">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink-900">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-3 lg:px-10 lg:py-14">
          {[
            'Every business has its own isolated conversations, knowledge, and settings.',
            'Use Luxus Bot AI out of the box, or bring your own Anthropic key.',
            'Plans start at $60 per month. No contracts; cancel any time.',
          ].map((text) => (
            <div key={text} className="flex gap-3 border-l-2 border-[#6d9b7b] pl-4">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9bc5a6]" />
              <p className="text-sm leading-6 text-stone-200">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">MADE FOR EVERYDAY SUPPORT</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight text-ink-900">A calmer way to manage the questions that keep coming in.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ['Product and service questions', 'Give customers quick answers based on the product details and guidance your team maintains.'],
              ['Policies and practical details', 'Make opening hours, delivery guidance, and other common information easier to find in a conversation.'],
              ['Requests that need a person', 'Bring a teammate into the chat when a customer needs judgment, context, or personal follow-up.'],
            ].map(([title, body]) => (
              <article key={title} className="border-t-2 border-[#c9ded1] pt-4">
                <h3 className="text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{body}</p>
              </article>
            ))}
          </div>
          <Link href="/use-cases" className="mt-6 inline-flex text-sm font-semibold text-[#285b43] hover:underline">Explore common use cases</Link>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-14 sm:px-8 sm:py-16 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <h2 className="font-display text-2xl text-ink-900 sm:text-3xl">Ready to make every reply count?</h2>
          <p className="mt-2 text-sm text-ink-600">Compare plans and get your workspace set up.</p>
        </div>
        <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white transition hover:bg-[#204a36]">
          View plans
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
