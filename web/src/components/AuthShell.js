import Link from 'next/link';
import { IconChat, IconHandoff, IconBook } from '@/components/icons';

const FEATURES = [
  {
    icon: IconChat,
    title: 'An assistant that knows your business',
    body: 'Answers from your own knowledge base - your policies, pricing, and FAQs - not generic guesses.',
  },
  {
    icon: IconHandoff,
    title: 'Hand off to a teammate, on WhatsApp',
    body: 'Transfer a tricky conversation and reply right from your own phone. The customer never has to switch apps.',
  },
  {
    icon: IconBook,
    title: 'One dashboard for every conversation',
    body: 'See what your assistant said, who it talked to, and step in the moment it matters.',
  },
];

/**
 * Split-screen shell for /login and /register: a dark branded panel with
 * real product content on the left, the form on the right. Collapses to a
 * single column (form only, brief top strip) below md.
 */
export default function AuthShell({ children }) {
  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-stone-50">
      {/* Brand panel */}
      <div className="relative flex flex-col overflow-hidden bg-ink-900 px-5 py-4 text-stone-100 sm:px-8 sm:py-5 md:min-h-screen md:w-[44%] md:px-12 md:py-14">
        {/* subtle corner texture, restrained - not a gradient hero */}
        <svg className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 opacity-[0.07]" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="99" stroke="#D4B168" strokeWidth="1" />
          <circle cx="100" cy="100" r="70" stroke="#D4B168" strokeWidth="1" />
          <circle cx="100" cy="100" r="41" stroke="#D4B168" strokeWidth="1" />
        </svg>

        <Link href="/" className="relative w-fit font-display text-2xl hover:text-white/80">
          Luxus Bot
        </Link>

        <div className="relative mt-12 hidden max-w-sm md:mt-20 md:block">
          <h1 className="font-display text-[2.15rem] leading-[1.15] text-white">
            Give your business a WhatsApp assistant that actually knows it.
          </h1>
          <p className="mt-4 text-sm text-stone-300 leading-relaxed">
            Luxus Bot answers customers on WhatsApp using your own content, and brings
            in your team the moment a conversation needs a human touch.
          </p>
        </div>

        <ul className="relative mt-12 hidden space-y-6 md:block">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass-light">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-sm text-stone-400 leading-snug">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-auto pt-10 text-xs text-stone-500 relative hidden md:block">
          Built for teams who&apos;d rather their customers wait on a good answer than a queue.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10 sm:py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
