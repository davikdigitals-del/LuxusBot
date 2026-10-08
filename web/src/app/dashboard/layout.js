'use client';

import RequireAuth from '@/components/RequireAuth';
import Sidebar from '@/components/Sidebar';
import SubscriptionBanner from '@/components/SubscriptionBanner';

export default function DashboardLayout({ children }) {
  return (
    <RequireAuth>
      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[#f7f7f2] md:h-screen md:flex-row">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-9 md:h-screen">
          <SubscriptionBanner />
          <div className="mx-auto w-full max-w-[1440px] break-words">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
