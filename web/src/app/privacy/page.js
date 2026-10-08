import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingNav />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl text-ink-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-600">Draft template - last updated placeholder</p>

        <div className="mt-6 rounded border border-brass/30 bg-brass/5 p-4 text-sm text-ink-800">
          This is placeholder template text, not a reviewed legal document. Have
          a lawyer review and adapt it to your business and jurisdiction -
          especially around WhatsApp message content and any regional data
          protection law that applies to you (e.g. NDPR, GDPR) - before relying on it.
        </div>

        <div className="mt-8 space-y-6 text-sm text-ink-700 leading-relaxed">
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">What we store</h2>
            <p>Your account details, your business&apos;s settings and knowledge base content, and the WhatsApp conversations your assistant has on your behalf - scoped strictly to your own business.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">How conversation data is used</h2>
            <p>To generate replies (via your chosen AI provider), to show you your own conversation history, and nothing else. We don&apos;t sell conversation data or use it to train models beyond what your chosen AI provider&apos;s own terms specify.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">Data isolation</h2>
            <p>Each business&apos;s data is isolated from every other business on the platform.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">Your choices</h2>
            <p>You can export or delete your business&apos;s data on request. Team members can be removed at any time, revoking their access immediately.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">Contact</h2>
            <p>Questions about this policy: <a href="mailto:hello@luxus.app" className="text-brass-dark hover:underline">hello@luxus.app</a></p>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
