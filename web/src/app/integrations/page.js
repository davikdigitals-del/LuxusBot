import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const ENDPOINTS = [
  ['GET', '/conversations', 'conversations:read'],
  ['GET', '/conversations/:id', 'conversations:read'],
  ['GET', '/conversations/:id/messages', 'messages:read'],
  ['POST', '/conversations/:id/messages', 'messages:send'],
  ['GET', '/knowledge', 'knowledge:read'],
  ['GET', '/knowledge/:id', 'knowledge:read'],
  ['GET', '/knowledge/search?query=...', 'knowledge:read'],
  ['POST', '/knowledge', 'knowledge:write'],
  ['PUT', '/knowledge/:id', 'knowledge:write'],
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const metadata = {
  title: 'Integrations and API | Luxus Bot',
  description: 'Connect your systems to Luxus Bot using tenant-scoped API keys and the versioned external API.',
};

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f2]">
      <MarketingNav />
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
          <p className="text-xs font-semibold text-[#285b43]">INTEGRATIONS</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-ink-900 sm:text-5xl">Bring your support workflow into your own systems.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-600">The Luxus Bot external API lets your applications read conversations and knowledge, send approved replies, and maintain knowledge documents with a permissioned API key.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16 lg:px-10">
        <div>
          <p className="text-xs font-semibold text-[#285b43]">AUTHENTICATION</p>
          <h2 className="mt-3 font-display text-2xl text-ink-900">Use a key with only the access you need.</h2>
          <p className="mt-3 text-sm leading-6 text-ink-600">Create and manage keys from Dashboard → API keys. Send the key in the <code className="rounded bg-white px-1">x-api-key</code> header. Keys are scoped to the business that created them and require an active paid plan.</p>
          <div className="mt-5 rounded-md border border-stone-200 bg-white p-4">
            <p className="text-xs font-medium text-ink-700">API base URL</p>
            <code className="mt-1 block break-all text-sm text-ink-900">{API_BASE}/api/v1</code>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-600">Treat API keys like passwords. They are shown only once when created; disable or revoke them from the dashboard if no longer needed.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl text-ink-900">Available endpoints</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-stone-200 bg-white">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs text-ink-600">
                <tr><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Path</th><th className="px-4 py-3 font-medium">Required permission</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ENDPOINTS.map(([method, path, permission]) => (
                  <tr key={`${method}-${path}`}>
                    <td className="px-4 py-3 font-mono text-xs text-[#285b43]">{method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-800">{path}</td>
                    <td className="px-4 py-3 text-xs text-ink-600">{permission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-14 md:grid-cols-2 lg:px-10">
          <div>
            <p className="text-xs font-semibold text-[#285b43]">QUICK EXAMPLE</p>
            <h2 className="mt-3 font-display text-2xl text-ink-900">Search your knowledge base.</h2>
            <pre className="mt-4 overflow-x-auto rounded-md bg-ink-900 p-4 text-xs leading-5 text-white"><code>{`curl "${API_BASE}/api/v1/knowledge/search?query=return%20policy" \\
  -H "x-api-key: YOUR_API_KEY"`}</code></pre>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#285b43]">IMPORTANT BEHAVIOR</p>
            <h2 className="mt-3 font-display text-2xl text-ink-900">Human messages stay in the team&apos;s hands.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-600">Sending a message through the API is supported only for an existing conversation already transferred to human handoff mode. Knowledge write access allows adding and updating documents; it does not grant deletion.</p>
            <Link href="/getting-started" className="mt-5 inline-flex text-sm font-semibold text-[#285b43] hover:underline">See the setup checklist</Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
