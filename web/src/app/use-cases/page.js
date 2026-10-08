import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const USE_CASES = [
  {
    number: '01',
    title: 'Product and order questions',
    description: 'Add product details, delivery guidance, and common order information so customers can get useful answers in the WhatsApp conversation they already use.',
    examples: ['Product availability and details', 'Delivery information your business provides', 'Common questions before a purchase'],
  },
  {
    number: '02',
    title: 'Service enquiries',
    description: 'Make service descriptions, business policies, and frequently requested information available to the assistant and your support team.',
    examples: ['What a service includes', 'How your process works', 'Policies and practical next steps'],
  },
  {
    number: '03',
    title: 'Requests that need a person',
    description: 'When a customer needs individual attention, your team can review the conversation and take over instead of forcing the customer to start again.',
    examples: ['Unusual or sensitive requests', 'Questions that need human judgment', 'Follow-up that benefits from personal context'],
  },
];

export const metadata = {
  title: 'Use Cases | Luxus Bot',
  description: 'Explore practical ways teams use Luxus Bot for WhatsApp customer support and human follow-up.',
};

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-screen-2xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">USE CASES</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ink-900 sm:text-5xl">Support that starts with your business and keeps your team in reach.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">Use Luxus Bot to handle common WhatsApp questions from your business knowledge, while keeping people ready for the conversations that need them.</p>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {USE_CASES.map(({ number, title, description, examples }) => (
            <article key={number} className="grid gap-5 py-7 sm:grid-cols-[64px_1fr_0.8fr] sm:gap-8 sm:py-9">
              <span className="font-display text-xl text-[#3f7a5c]">{number}</span>
              <div>
                <h2 className="font-display text-2xl text-ink-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
              </div>
              <ul className="space-y-2 text-sm text-ink-700">
                {examples.map((example) => <li key={example} className="border-l-2 border-[#c9ded1] pl-3">{example}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <h2 className="font-display text-2xl text-ink-900">See the workflow in more detail.</h2>
            <p className="mt-2 text-sm text-ink-600">Explore the features or prepare your first workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-5 text-sm font-semibold text-ink-800 hover:bg-stone-100">Explore features</Link>
            <Link href="/getting-started" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white hover:bg-[#204a36]">Get started</Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
