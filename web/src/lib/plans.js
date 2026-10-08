// Mirrors api/src/services/billingService.js (PLANS). Change prices/limits there first, then here.
export const PLANS = [
  {
    id: 'pro', name: 'Pro', price: 60,
    tagline: 'For a small business getting started with WhatsApp automation.',
    features: ['2,000 AI replies / month', '3 team members', '100 MB knowledge base', 'Live-agent handoff', 'API access', 'Email support'],
  },
  {
    id: 'individual', name: 'Individual', price: 360, highlight: true,
    tagline: 'For a busy business with steady daily WhatsApp traffic.',
    features: ['15,000 AI replies / month', '10 team members', '500 MB knowledge base', 'Live-agent handoff', 'API access', 'Priority support'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 980,
    tagline: 'For high volume and larger support teams.',
    features: ['50,000 AI replies / month', '50 team members', '2 GB knowledge base', 'Live-agent handoff', 'API access', 'Dedicated support'],
  },
];

export const planById = (id) => PLANS.find((p) => p.id === id);
