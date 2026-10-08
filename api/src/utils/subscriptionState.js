export const PLAN_IDS = ['pro', 'individual', 'enterprise'];

/**
 * Maps a legacy payment-provider subscription status to what we store.
 * Access itself is decided by currentPeriodEnd (see isSubscriptionActive), so a cancelled
 * customer keeps what they already paid for and a failed renewal only lasts the grace period.
 * Returns null for statuses where nothing should change.
 */
export function legacySubscriptionState(status) {
  switch (status) {
    case 'active': return { status: 'active', cancelAtPeriodEnd: false };
    case 'non-renewing': return { status: 'active', cancelAtPeriodEnd: true }; // cancelled, paid until the period ends
    case 'attention': return { status: 'past_due', cancelAtPeriodEnd: false };
    case 'cancelled':
    case 'completed': return { status: 'canceled', cancelAtPeriodEnd: true };
    default: return null;
  }
}

/** Legacy provider events represented by the stored subscription state. */
export const LEGACY_EVENT_TO_STATUS = {
  'subscription.create': 'active',
  'subscription.not_renew': 'non-renewing',
  'subscription.disable': 'cancelled',
  'invoice.payment_failed': 'attention',
};

/** On one of the paid plans and still inside the paid period (plus grace days). */
export function isSubscriptionActive(subscription, now = Date.now(), graceDays = 0) {
  if (!subscription || !PLAN_IDS.includes(subscription.plan) || !subscription.currentPeriodEnd) return false;
  return new Date(subscription.currentPeriodEnd).getTime() + graceDays * 86400000 > now;
}

/** Same day next month (clamped: Jan 31 -> Feb 28/29). */
export function addMonths(date, months = 1) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
