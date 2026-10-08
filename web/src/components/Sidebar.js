'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const LINKS = [
  { href: '/dashboard', label: 'Overview', roles: null },
  { href: '/dashboard/conversations', label: 'Conversations', roles: null },
  { href: '/dashboard/knowledge', label: 'Knowledge base', roles: null },
  { href: '/dashboard/team', label: 'Team', roles: ['owner', 'admin'] },
  { href: '/dashboard/whatsapp', label: 'WhatsApp', roles: ['owner', 'admin'] },
  { href: '/dashboard/routing', label: 'Auto-routing', roles: ['owner', 'admin'] },
  { href: '/dashboard/analytics', label: 'Analytics', roles: null },
  { href: '/dashboard/billing', label: 'Billing', roles: ['owner', 'admin'] },
  { href: '/dashboard/api-keys', label: 'API keys', roles: ['owner', 'admin'] },
  { href: '/dashboard/settings', label: 'Settings', roles: ['owner', 'admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, businesses, currentBusiness, currentRole, switchBusiness, logout } = useAuth();
  const visibleLinks = LINKS.filter((link) => !link.roles || link.roles.includes(currentRole));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const linkIsActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink-900 text-stone-100 md:flex">
        <div className="border-b border-ink-700 px-5 py-5">
          <Link href="/" className="font-display text-2xl text-white hover:text-stone-200">Luxus Bot</Link>
        </div>

        {businesses.length > 1 && (
          <div className="px-4 py-4">
            <label htmlFor="business-switcher" className="mb-1.5 block text-[11px] font-medium text-stone-400">WORKSPACE</label>
            <select
              id="business-switcher"
              value={currentBusiness?._id || ''}
              onChange={(e) => switchBusiness(e.target.value)}
              className="w-full rounded border border-ink-600 bg-ink-800 px-2.5 py-2 text-xs text-stone-100"
            >
              {businesses.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        {businesses.length === 1 && (
          <p className="truncate border-b border-ink-700 px-5 py-3 text-xs text-stone-400">{currentBusiness?.name}</p>
        )}

        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-medium text-stone-500">WORKSPACE</p>
          {visibleLinks.map((link) => {
            const active = linkIsActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded px-3 py-2.5 text-sm transition ${
                  active ? 'bg-[#dcebe0] font-semibold text-[#285b43]' : 'text-stone-300 hover:bg-ink-800 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-700 px-3 py-3">
          <Link href="/account/whatsapp" className="block rounded px-3 py-2 text-sm text-stone-300 hover:bg-ink-800 hover:text-white">
            My WhatsApp
          </Link>
          <div className="truncate px-3 py-2 text-xs text-stone-400">{user?.email}</div>
          <button
            onClick={logout}
            className="w-full rounded px-3 py-2 text-left text-sm text-stone-300 hover:bg-ink-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="relative z-30 shrink-0 border-b border-stone-200 bg-white md:hidden">
        <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 sm:px-4">
          <Link href="/" className="min-w-0 font-display text-xl text-ink-900">Luxus Bot</Link>
          {businesses.length > 1 ? (
            <select
              aria-label="Switch workspace"
              value={currentBusiness?._id || ''}
              onChange={(e) => switchBusiness(e.target.value)}
              className="min-w-0 max-w-full rounded border border-stone-300 bg-white px-2 py-2 text-xs text-ink-800"
            >
              {businesses.map((business) => (
                <option key={business._id} value={business._id}>{business.name}</option>
              ))}
            </select>
          ) : (
            <span className="min-w-0 truncate text-right text-xs text-ink-600">{currentBusiness?.name}</span>
          )}
        </div>
        <div className="flex min-h-10 items-center border-t border-stone-100 px-3 sm:px-4">
          <button
            type="button"
            aria-controls="dashboard-mobile-navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded px-2 text-sm font-medium text-ink-700 hover:bg-stone-100"
          >
            <span className="sr-only">{mobileMenuOpen ? 'Close navigation' : 'Open navigation'}</span>
            <span aria-hidden="true" className="text-xl leading-none">{mobileMenuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        {mobileMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-x-0 bottom-0 top-[97px] z-40 bg-ink-950/40"
            />
            <aside
              id="dashboard-mobile-navigation"
              aria-label="Dashboard sidebar"
              className="fixed bottom-0 left-0 top-[97px] z-50 flex w-[min(18rem,85vw)] flex-col overflow-hidden bg-ink-900 text-stone-100 shadow-xl"
            >
              {businesses.length === 1 && (
                <p className="truncate border-b border-ink-700 px-5 py-3 text-xs text-stone-400">{currentBusiness?.name}</p>
              )}
              <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
                <p className="px-3 pb-2 text-[11px] font-medium text-stone-500">WORKSPACE</p>
                {visibleLinks.map((link) => {
                  const active = linkIsActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded px-3 py-3 text-sm transition ${
                        active ? 'bg-[#dcebe0] font-semibold text-[#285b43]' : 'text-stone-300 hover:bg-ink-800 hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="shrink-0 border-t border-ink-700 px-3 py-3">
                <Link
                  href="/account/whatsapp"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded px-3 py-2 text-sm text-stone-300 hover:bg-ink-800 hover:text-white"
                >
                  My WhatsApp
                </Link>
                <div className="truncate px-3 py-2 text-xs text-stone-400">{user?.email}</div>
                <button
                  onClick={logout}
                  className="w-full rounded px-3 py-2 text-left text-sm text-stone-300 hover:bg-ink-800 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </aside>
          </>
        )}
      </div>
    </>
  );
}
