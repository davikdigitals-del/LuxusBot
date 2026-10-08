import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const STEPS = [
  ['Create your workspace', 'Register your account and choose the plan that suits your support volume. You can review plan limits and billing details before checkout.'],
  ['Connect WhatsApp', 'Follow the connection flow in your dashboard and check the WhatsApp status there once linking is complete.'],
  ['Add your business knowledge', 'Start with the FAQs, product details, policies, and practical information your customers ask about most. Keep the material clear and current.'],
  ['Bring your team in', 'Invite the teammates who handle customer support, set their workspace roles, and agree on when a conversation should be handed over.'],
  ['Review and improve', 'Check real conversations, update missing information, and let a person lead whenever a question needs individual care.'],
];

export const metadata = {
  title: 'Getting Started | Luxus Bot',
  description: 'A practical checklist for setting up Luxus Bot for WhatsApp customer support.',
};

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">GETTING STARTED</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ink-900 sm:text-5xl">A simple path from setup to better support conversations.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">Prepare your WhatsApp connection, give the assistant useful business context, and make sure your team knows how to step in.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-screen-2xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[220px_1fr] lg:gap-16 lg:px-10">
        <aside className="h-fit rounded-md border border-stone-200 bg-white p-5 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-ink-900">Before you begin</h2>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-ink-600">
            <li>Access to the WhatsApp account you plan to connect</li>
            <li>Your most useful customer FAQs and business policies</li>
            <li>Teammates who will manage conversations</li>
          </ul>
        </aside>
        <ol className="divide-y divide-stone-200 border-y border-stone-200">
          {STEPS.map(([title, description], index) => (
            <li key={title} className="grid gap-3 py-6 sm:grid-cols-[48px_1fr] sm:gap-5">
              <span className="font-display text-xl text-[#3f7a5c]">0{index + 1}</span>
              <div>
                <h2 className="text-base font-semibold text-ink-900">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <h2 className="font-display text-2xl text-ink-900">Ready to prepare your workspace?</h2>
            <p className="mt-2 text-sm text-ink-600">Compare plans or open the account registration page.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-semibold text-ink-800 hover:bg-stone-100">Compare plans</Link>
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white hover:bg-[#204a36]">Create account</Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
