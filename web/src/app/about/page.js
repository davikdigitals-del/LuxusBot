import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const PRINCIPLES = [
  {
    number: '01',
    title: 'Useful before impressive',
    body: 'An assistant should make everyday support easier: answer what it knows, be clear about what it does not, and make the next step obvious.',
  },
  {
    number: '02',
    title: 'People stay responsible',
    body: 'Automation is there to help your team, not hide it. Keep a person close to the conversation for requests that need care, context, or a decision.',
  },
  {
    number: '03',
    title: 'Your business has its own context',
    body: 'Your policies, products, and customer conversations belong to your workspace. Luxus Bot keeps each business workspace separate and lets your team manage its own knowledge.',
  },
];

export const metadata = {
  title: 'About | Luxus Bot',
  description: 'Learn about the principles behind the Luxus Bot WhatsApp support workspace.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">ABOUT LUXUS BOT</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-tight text-ink-900 sm:text-6xl">Better support is a team effort.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600 sm:text-lg">Luxus Bot helps businesses answer customers on WhatsApp with the knowledge they already have and the people who know their customers best.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20 lg:px-10">
        <div>
          <p className="text-xs font-semibold text-[#285b43]">WHAT WE BELIEVE</p>
          <h2 className="mt-3 max-w-sm font-display text-3xl leading-tight text-ink-900">Technology should give your team more room to care.</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-600">The best support experience is not simply the fastest reply. It is a useful answer, grounded in your business, with a person ready when one is needed.</p>
        </div>
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {PRINCIPLES.map(({ number, title, body }) => (
            <article key={number} className="grid gap-3 py-6 sm:grid-cols-[52px_1fr] sm:gap-5">
              <span className="font-display text-xl text-[#3f7a5c]">{number}</span>
              <div>
                <h3 className="text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-2 lg:px-10">
          <div>
            <h2 className="font-display text-2xl text-ink-900">Made for real support teams.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Whether you are answering a steady stream of common questions or coordinating several teammates, the workspace brings shared context and human follow-up together.</p>
          </div>
          <div className="border-l-2 border-[#c9ded1] pl-5">
            <h2 className="font-display text-2xl text-ink-900">Built around your knowledge.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Start with the policies, product details, and answers you already use. Improve that material as your team sees what customers need.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <div>
            <p className="text-xs font-semibold text-[#285b43]">OUR APPROACH</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-ink-900">Helpful automation should know when to make room for people.</h2>
          </div>
          <div className="space-y-4 text-sm leading-6 text-ink-600">
            <p>Luxus Bot is designed to support a real customer-service workflow: business-specific information for routine questions, conversation history for shared context, and a clear way for a teammate to take over.</p>
            <p>That means your team stays responsible for its answers. Keep the knowledge base current, review conversations, and use human handoff when the situation calls for individual attention.</p>
            <Link href="/getting-started" className="inline-flex font-semibold text-[#285b43] hover:underline">See how to get started</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-14 sm:px-8 sm:py-16 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <h2 className="font-display text-2xl text-ink-900">Put your support knowledge to work.</h2>
          <p className="mt-2 text-sm text-ink-600">See the workflow and choose a plan for your team.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-stone-100">Explore features</Link>
          <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white hover:bg-[#204a36]">See plans</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}