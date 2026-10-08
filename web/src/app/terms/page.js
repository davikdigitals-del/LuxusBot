import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <MarketingNav />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl text-ink-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-600">Draft template - last updated placeholder</p>

        <div className="mt-6 rounded border border-brass/30 bg-brass/5 p-4 text-sm text-ink-800">
          This is placeholder template text, not a reviewed legal document. Have
          a lawyer review and adapt it to your business and jurisdiction before
          relying on it.
        </div>

        <div className="mt-8 space-y-6 text-sm text-ink-700 leading-relaxed">
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">1. Using Luxus Bot</h2>
            <p>By creating an account, you agree to use Luxus Bot to communicate with your own customers in good faith and in line with WhatsApp&apos;s own terms of service and applicable law in your jurisdiction.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">2. Your account</h2>
            <p>You&apos;re responsible for what happens under your account, including messages your assistant sends based on content you&apos;ve added to your knowledge base.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">3. Acceptable use</h2>
            <p>No unsolicited bulk messaging, no illegal content, no attempting to disrupt the service or access another business&apos;s data.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">4. Billing</h2>
            <p>Paid plans renew automatically unless cancelled before the next billing date. No refunds for partial months, except where required by law.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">5. Termination</h2>
            <p>You can cancel at any time. We may suspend accounts that violate these terms or misuse the service.</p>
          </div>
          <div>
            <h2 className="text-base font-medium text-ink-900 mb-1.5">6. Liability</h2>
            <p>Luxus Bot is provided as-is. We work to keep it reliable but don&apos;t guarantee it will be uninterrupted or error-free.</p>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
