'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/use-cases', label: 'Use cases' },
  { href: '/getting-started', label: 'Get started' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-stone-200 bg-stone-50/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between gap-2">
          <Link href="/" className="shrink-0 font-display text-xl text-ink-900">Luxus Bot</Link>

          <nav aria-label="Main navigation" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 whitespace-nowrap lg:gap-5 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap rounded px-1 py-2 text-xs transition lg:text-sm ${pathname === l.href ? 'font-medium text-ink-900' : 'text-ink-600 hover:text-ink-900'}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            {!loading && user ? (
              <Link href="/dashboard" className="rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-white hover:bg-ink-800 sm:px-4 sm:text-sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded px-2 py-2 text-xs text-ink-700 hover:text-ink-900 sm:text-sm">Sign in</Link>
                <Link href="/register" className="rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-white hover:bg-ink-800 sm:px-4 sm:text-sm">
                  Get started
                </Link>
              </>
            )}
            <button
              type="button"
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="min-h-10 rounded px-2 text-xs font-medium text-ink-700 hover:bg-stone-100 md:hidden"
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-navigation" aria-label="Mobile main navigation" className="mt-3 border-t border-stone-200 pt-2 md:hidden">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex min-h-11 items-center rounded px-3 text-sm ${active ? 'bg-[#e9f2eb] font-medium text-[#285b43]' : 'text-ink-700 hover:bg-stone-100'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
