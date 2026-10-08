import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';
import { IconBook, IconChat, IconCheck, IconHandoff } from '@/components/icons';

const CAPABILITIES = [
  {
    icon: IconBook,
    number: '01',
    title: 'Answers grounded in your business',
    body: 'Add product details, policies, pricing, and FAQs to your knowledge base. The assistant uses that material to answer common questions instead of relying on a generic script.',
    points: ['Organize information by topic', 'Update answers as your business changes', 'Keep each business workspace separate'],
  },
  {
    icon: IconHandoff,
    number: '02',
    title: 'A clear path to a person',
    body: 'When a conversation needs judgment or a personal touch, your team can take over. The customer stays in the same WhatsApp conversation.',
    points: ['Hand off conversations to teammates', 'Keep the conversation history in view', 'Let people handle sensitive or unusual requests'],
  },
  {
    icon: IconChat,
    number: '03',
    title: 'One workspace for the whole team',
    body: 'Bring conversations, knowledge, team access, and WhatsApp connection status into one dashboard, with roles for the people who manage your setup.',
    points: ['Review recent conversations', 'Invite teammates with defined roles', 'Manage business settings in one place'],
  },
];

const FLOW = [
  ['Connect', 'Link the WhatsApp account you use with customers.'],
  ['Teach', 'Add the information your assistant should use when replying.'],
  ['Work together', 'Review chats and step in whenever a person should lead.'],
];

export const metadata = {
  title: 'Features | Luxus Bot',
  description: 'Explore how Luxus Bot combines WhatsApp replies, business knowledge, and human support in one workspace.',
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">THE LUXUS BOT WORKSPACE</p>
          <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end lg:gap-12">
            <h1 className="min-w-0 max-w-3xl font-display text-4xl leading-tight text-ink-900 sm:text-5xl lg:text-[clamp(2.5rem,3.8vw,3.25rem)]">Fast answers, with your team still in the picture.</h1>
            <p className="min-w-0 max-w-xl text-base leading-7 text-ink-600">Luxus Bot brings your WhatsApp conversations, business knowledge, and human support together so routine questions get handled and important moments reach your team.</p>
          </div>
          <Link href="/pricing" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white transition hover:bg-[#204a36]">See plans</Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-18 lg:px-10">
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {CAPABILITIES.map(({ icon: Icon, number, title, body, points }) => (
            <article key={number} className="grid gap-6 py-8 sm:py-10 lg:grid-cols-[72px_1fr_0.8fr] lg:gap-10">
              <div className="flex items-center gap-3 lg:block">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e9f2eb] text-[#285b43]"><Icon className="h-5 w-5" /></span>
                <span className="font-display text-lg text-[#3f7a5c] lg:mt-5 lg:block">{number}</span>
              </div>
              <div>
                <h2 className="font-display text-2xl leading-tight text-ink-900">{title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">{body}</p>
              </div>
              <ul className="space-y-2.5 lg:pt-1">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm leading-5 text-ink-700">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3f7a5c]" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-ink-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:px-10">
          <div>
            <p className="text-xs font-semibold text-[#9bc5a6]">A SIMPLE WORKFLOW</p>
            <h2 className="mt-3 font-display text-3xl leading-tight">From first message to the right next step.</h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-3">
            {FLOW.map(([title, body], index) => (
              <li key={title} className="border-t border-white/20 pt-4">
                <span className="text-xs font-semibold text-[#9bc5a6]">0{index + 1}</span>
                <h3 className="mt-3 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-300">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:px-10">
          <div>
            <p className="text-xs font-semibold text-[#285b43]">TEAM CONTROL</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-ink-900">Keep the right people close to every chat.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Your dashboard gives the team a shared view of conversations and the tools to step in when an automated answer is not enough.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ['Shared conversation context', 'Review the chat history before replying, so customers do not have to repeat themselves.'],
              ['Role-based access', 'Invite teammates and assign workspace roles that match how they help your business.'],
              ['Human handoff', 'Move a conversation to your team when a request needs care or a decision.'],
              ['Business-level visibility', 'Manage conversations, knowledge, and WhatsApp status from the same workspace.'],
            ].map(([title, body]) => (
              <article key={title} className="border-t border-stone-200 pt-4">
                <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-xs font-semibold text-[#285b43]">KEEP ANSWERS CURRENT</p>
            <h2 className="mt-3 font-display text-3xl leading-tight text-ink-900">Your knowledge can grow with your business.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Add and update the source material your assistant uses. When your products or policies change, your team can revise the knowledge base instead of rewriting a fixed script.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Start with what you have', 'Bring together FAQs, product information, and policies.'],
              ['Organize by topic', 'Keep useful information easy for your team to manage.'],
              ['Improve from real chats', 'Notice unanswered questions and add the missing guidance.'],
            ].map(([title, body], index) => (
              <article key={title} className="rounded-md border border-stone-200 bg-white p-4">
                <span className="font-display text-lg text-[#3f7a5c]">0{index + 1}</span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-14 sm:px-8 sm:py-16 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>
          <h2 className="font-display text-2xl text-ink-900">See how it fits your team.</h2>
          <p className="mt-2 text-sm text-ink-600">Compare reply volumes and team sizes across plans.</p>
        </div>
        <Link href="/pricing" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#285b43] px-5 text-sm font-semibold text-white hover:bg-[#204a36]">Compare plans</Link>
      </section>

      <MarketingFooter />
    </div>
  );
}