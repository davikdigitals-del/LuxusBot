import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setupEnv } from './helpers.js';

setupEnv();

const { legacySubscriptionState, LEGACY_EVENT_TO_STATUS, isSubscriptionActive, addMonths } = await import('../src/utils/subscriptionState.js');

test('active stays active; cancelled-but-paid keeps access until the period ends', () => {
  assert.deepEqual(legacySubscriptionState('active'), { status: 'active', cancelAtPeriodEnd: false });
  assert.deepEqual(legacySubscriptionState('non-renewing'), { status: 'active', cancelAtPeriodEnd: true });
});

test('a failed card is past_due (grace period), cancelled/completed end the subscription', () => {
  assert.equal(legacySubscriptionState('attention').status, 'past_due');
  for (const s of ['cancelled', 'completed']) assert.equal(legacySubscriptionState(s).status, 'canceled');
});

test('unknown statuses change nothing', () => {
  assert.equal(legacySubscriptionState('whatever'), null);
  assert.equal(legacySubscriptionState(undefined), null);
});

test('webhook events map to the right status', () => {
  assert.equal(LEGACY_EVENT_TO_STATUS['subscription.disable'], 'cancelled');
  assert.equal(LEGACY_EVENT_TO_STATUS['subscription.not_renew'], 'non-renewing');
  assert.equal(LEGACY_EVENT_TO_STATUS['invoice.payment_failed'], 'attention');
});

test('AI access = paid plan + inside the paid period (plus grace days)', () => {
  const now = Date.parse('2026-10-15T00:00:00Z');
  const sub = (end, plan = 'pro') => ({ plan, currentPeriodEnd: new Date(end) });

  assert.equal(isSubscriptionActive(sub('2026-10-20T00:00:00Z'), now, 0), true);
  assert.equal(isSubscriptionActive(sub('2026-10-14T00:00:00Z'), now, 0), false);
  assert.equal(isSubscriptionActive(sub('2026-10-14T00:00:00Z'), now, 3), true); // card failed, still in grace
  assert.equal(isSubscriptionActive(sub('2026-10-01T00:00:00Z'), now, 3), false);
  assert.equal(isSubscriptionActive(sub('2026-10-20T00:00:00Z', 'none'), now, 0), false);
  assert.equal(isSubscriptionActive({ plan: 'standard' }, now, 0), false);
  assert.equal(isSubscriptionActive(undefined, now, 0), false);
});

test('addMonths keeps the day and clamps short months', () => {
  assert.equal(addMonths('2026-10-15T10:00:00Z', 1).toISOString(), '2026-11-15T10:00:00.000Z');
  assert.equal(addMonths('2026-01-31T00:00:00Z', 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(addMonths('2026-12-10T00:00:00Z', 1).toISOString(), '2027-01-10T00:00:00.000Z');
});

test('legacy webhook signature: HMAC-SHA512 of the raw body with the secret key', async () => {
  const { verifyLegacyWebhookSignature } = await import('../src/services/billingService.js');
  const secret = 'sk_test_abc';
  const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'r1' } }));
  const good = crypto.createHmac('sha512', secret).update(body).digest('hex');

  assert.equal(verifyLegacyWebhookSignature(body, good, secret), true);
  assert.equal(verifyLegacyWebhookSignature(body, good, 'other'), false);
  assert.equal(verifyLegacyWebhookSignature(Buffer.from(body.toString() + ' '), good, secret), false);
  assert.equal(verifyLegacyWebhookSignature(body, 'short', secret), false);
  assert.equal(verifyLegacyWebhookSignature(body, undefined, secret), false);
  assert.equal(verifyLegacyWebhookSignature(body, good, ''), false);
});

test('Kora webhook signature: HMAC-SHA256 of serialized data with the secret key', async () => {
  const { verifyKoraSignature } = await import('../src/services/billingService.js');
  const secret = 'sk_test_abc';
  const data = { reference: 'r1', amount: 500 };
  const good = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');

  assert.equal(verifyKoraSignature(data, good, secret), true);
  assert.equal(verifyKoraSignature(data, good, 'other'), false);
  assert.equal(verifyKoraSignature(data, 'short', secret), false);
  assert.equal(verifyKoraSignature(null, good, secret), false);
  assert.equal(verifyKoraSignature(data, good, ''), false);
});
