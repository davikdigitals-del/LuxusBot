import { Business } from '../models/index.js';
import { PLAN_IDS } from '../utils/subscriptionState.js';

const DAY_MS = 86400000;

/**
 * Counts one AI reply against the business's plan, atomically.
 * Returns { allowed: true } and increments, or { allowed: false } when
 *  - there is no paid subscription (or it lapsed beyond the grace period), or
 *  - the monthly message count is used up, or
 *  - an optional monthly AI spend cap (USD) is reached (off by default).
 * When not allowed the AI is not called, so it costs nothing; the caller hands the chat to a live agent.
 * Usage resets when a renewal payment succeeds (see billingService), not on the calendar.
 */
export async function consumeAiMessage(businessId, { graceDays = 0, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - graceDays * DAY_MS);

  const updated = await Business.findOneAndUpdate(
    {
      _id: businessId,
      'subscription.plan': { $in: PLAN_IDS },
      'subscription.currentPeriodEnd': { $gt: cutoff },
      $expr: {
        $and: [
          { $lt: [{ $ifNull: ['$usage.messagesThisMonth', 0] }, { $ifNull: ['$limits.messagesPerMonth', 0] }] },
          // AI spend cap is optional: a budget of 0 means "no cap"
          { $or: [
            { $lte: [{ $ifNull: ['$limits.aiBudgetUsd', 0] }, 0] },
            { $lt: [{ $ifNull: ['$usage.aiCostThisMonth', 0] }, { $ifNull: ['$limits.aiBudgetUsd', 0] }] },
          ] },
        ],
      },
    },
    { $inc: { 'usage.messagesThisMonth': 1 } },
    { new: true },
  ).select('usage limits');

  return { allowed: Boolean(updated) };
}

/** Adds what one AI reply cost (USD, from Anthropic's token counts) to this month's total. */
export async function recordAiCost(businessId, cost) {
  const amount = Number(cost);
  if (!Number.isFinite(amount) || amount <= 0) return;
  await Business.updateOne({ _id: businessId }, { $inc: { 'usage.aiCostThisMonth': Math.round(amount * 1e6) / 1e6 } });
}

/** Gives back one counted reply when the AI failed to answer (the customer went to a live agent instead). */
export async function refundAiMessage(businessId) {
  await Business.updateOne(
    { _id: businessId, 'usage.messagesThisMonth': { $gt: 0 } },
    { $inc: { 'usage.messagesThisMonth': -1 } },
  );
}

export default { consumeAiMessage, recordAiCost, refundAiMessage };
