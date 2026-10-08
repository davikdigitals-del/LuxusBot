'use client';

import { useAuth } from '@/lib/AuthContext';
import { PageHeader } from '@/components/ui';
import WhatsAppConnect from '@/components/WhatsAppConnect';

export default function BusinessWhatsAppPage() {
  const { currentBusinessId } = useAuth();

  if (!currentBusinessId) return null;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="The number your assistant replies from."
      />
      <WhatsAppConnect
        statusUrl={`/api/business/${currentBusinessId}/whatsapp/status`}
        connectUrl={`/api/business/${currentBusinessId}/whatsapp/connect`}
        disconnectUrl={`/api/business/${currentBusinessId}/whatsapp`}
        subtitle="Customers message this number and your assistant answers from here."
      />
    </div>
  );
}
