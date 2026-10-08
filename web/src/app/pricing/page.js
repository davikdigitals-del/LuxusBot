import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import { IconCheck } from '@/components/icons';
import { PLANS } from '@/lib/plans';

const FAQS = [
  { q: 'Can I create an account before choosing a plan?', a: 'Yes. Account creation is free, and you can explore your workspace before subscribing. AI replies remain paused until you choose and pay for a plan in Billing.' },
  { q: 'What counts as an AI reply?', a: 'Each time the assistant answers a customer message. Messages answered by your own team never count. If you use up your replies, new chats are passed to your team until your next monthly payment.' },
  { q: 'What if the AI is unavailable?', a: 'Your customers are never left waiting. If the assistant can\'t reply, the chat is passed to an online team member automatically.' },
  { q: 'Why does the assistant take a few seconds to answer?', a: 'Replies arrive after a short, natural pause with a "typing..." indicator, like a person would reply. This keeps your WhatsApp number looking normal to WhatsApp.' },
  { q: 'Do I need my own Anthropic key?', a: 'No - Luxus Bot works out of the box. If you\'d rather use your own key (for billing control), you can add one in Settings and it takes over automatically.' },
  { q: 'How do I pay?', a: 'Payments are processed through Kora. Prices are shown in US dollars and converted to your Kora account currency at checkout. Renew manually from Billing each month; payments do not renew automatically.' },
  { q: 'Is my data shared with other businesses on Luxus Bot?', a: 'No. Every business\'s conversations, knowledge base, and settings are fully isolated - by design, not just by convention.' },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-4 text-center sm:pt-20">
        <h1 className="font-display text-4xl text-ink-900">Simple monthly pricing.</h1>
        <p className="mt-3 text-ink-600">Pick the plan that fits your volume. Prices in US dollars, billed monthly, no contracts.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-lg border p-6 ${plan.highlight ? 'border-brass bg-white shadow-sm' : 'border-stone-200 bg-white'}`}
            >
              {plan.highlight && (
                <span className="mb-3 inline-block w-fit rounded-full bg-brass/10 px-2.5 py-0.5 text-xs font-medium text-brass-dark">
                  Most popular
                </span>
              )}
              <h2 className="font-display text-xl text-ink-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-ink-600">{plan.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-3xl text-ink-900">${plan.price}</span>
                <span className="text-sm text-ink-600">/month</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                    <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-dark" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-6 rounded-md py-2.5 text-center text-sm font-medium transition ${
                  plan.highlight ? 'bg-ink-900 text-white hover:bg-ink-800' : 'border border-stone-300 text-ink-800 hover:bg-stone-100'
                }`}
              >
                Create account
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-ink-600">Create an account for free. Choose a plan later in Billing to activate AI replies.</p>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold text-[#285b43]">CHOOSE WITH CONFIDENCE</p>
            <h2 className="mt-3 font-display text-3xl text-ink-900">Find the plan that fits your support volume.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Every plan includes the core workspace. Choose by the monthly AI reply allowance and team size your business needs.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['Starting out', 'A smaller team handling a steady set of common customer questions.'],
              ['Growing volume', 'A busy support workflow with more monthly replies and teammates.'],
              ['Larger operation', 'A higher-volume business coordinating a larger support team.'],
            ].map(([title, body], index) => (
              <article key={title} className="rounded-md border border-stone-200 p-5">
                <p className="text-xs font-medium text-[#285b43]">{PLANS[index].name}</p>
                <h3 className="mt-2 text-base font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{body}</p>
                <p className="mt-4 text-xs text-ink-600">{PLANS[index].features.slice(0, 2).join(' · ')}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-ink-600">Checkout is processed through Kora. The charge uses the currency configured for your Kora account; renewals are manual.</p>
        </div>
      </section>

      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl text-ink-900 text-center">Questions</h2>
          <div className="mt-8 space-y-6">
            {FAQS.map(({ q, a }) => (
              <div key={q}>
                <p className="text-sm font-medium text-ink-900">{q}</p>
                <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
