'use client';

import RequireAuth from '@/components/RequireAuth';
import Sidebar from '@/components/Sidebar';
import { PageHeader } from '@/components/ui';
import WhatsAppConnect from '@/components/WhatsAppConnect';

export default function AgentWhatsAppPage() {
  return (
    <RequireAuth>
      <div className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-stone-50 md:h-screen md:flex-row">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-9">
          <div className="mx-auto w-full max-w-4xl">
            <PageHeader
              title="My WhatsApp"
              description="Link your own number to reply to transferred conversations right from WhatsApp."
            />
          <WhatsAppConnect
            statusUrl="/api/agent/whatsapp/status"
            connectUrl="/api/agent/whatsapp/connect"
            disconnectUrl="/api/agent/whatsapp"
            subtitle="When a conversation is transferred to you, it lands in your own “Message Yourself” chat - reply there and it goes straight to the customer."
          />
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
