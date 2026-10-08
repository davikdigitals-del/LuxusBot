import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-display text-lg text-ink-900">Luxus Bot</span>
            <p className="mt-1.5 max-w-xs text-sm text-ink-600">
              Your WhatsApp assistant, and the team behind it, in one place.
            </p>
          </div>
          <div className="flex gap-10 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-ink-900">Product</p>
              <Link href="/features" className="block text-ink-600 hover:text-ink-900">Features</Link>
              <Link href="/use-cases" className="block text-ink-600 hover:text-ink-900">Use cases</Link>
              <Link href="/getting-started" className="block text-ink-600 hover:text-ink-900">Getting started</Link>
              <Link href="/integrations" className="block text-ink-600 hover:text-ink-900">Integrations</Link>
              <Link href="/faq" className="block text-ink-600 hover:text-ink-900">FAQ</Link>
              <Link href="/pricing" className="block text-ink-600 hover:text-ink-900">Pricing</Link>
              <Link href="/register" className="block text-ink-600 hover:text-ink-900">Create account</Link>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-ink-900">Company</p>
              <Link href="/about" className="block text-ink-600 hover:text-ink-900">About Luxus Bot</Link>
              <Link href="/contact" className="block text-ink-600 hover:text-ink-900">Contact</Link>
              <Link href="/terms" className="block text-ink-600 hover:text-ink-900">Terms</Link>
              <Link href="/privacy" className="block text-ink-600 hover:text-ink-900">Privacy</Link>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-ink-600/70">© {new Date().getFullYear()} Luxus Bot. All rights reserved.</p>
      </div>
    </footer>
  );
}
