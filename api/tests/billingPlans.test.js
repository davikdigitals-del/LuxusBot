import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { PLANS, planById, planLimits, getPublicPlans, startSignupCheckout } = await import('../src/services/billingService.js');
const { isSubscriptionActive, PLAN_IDS } = await import('../src/utils/subscriptionState.js');

test('three monthly plans at the agreed prices', () => {
  assert.deepEqual(PLAN_IDS, ['pro', 'individual', 'enterprise']);
  assert.equal(PLANS.pro.priceUsd, 60);
  assert.equal(PLANS.individual.priceUsd, 360);
  assert.equal(PLANS.enterprise.priceUsd, 980);
  assert.equal(planById('nope'), null);
});

test('bigger plans get more of everything', () => {
  const [a, b, c] = ['pro', 'individual', 'enterprise'].map((id) => planLimits(PLANS[id]));
  for (const key of ['messagesPerMonth', 'maxTeamMembers', 'maxKnowledgeBaseMB']) {
    assert.ok(a[key] < b[key] && b[key] < c[key], key);
  }
});

test('no AI cost cap by default (budget 0 = off)', () => {
  assert.equal(planLimits(PLANS.pro).aiBudgetUsd, 0);
});

test('every paid plan grants AI access inside its paid period', () => {
  const end = new Date(Date.now() + 86400000);
  for (const plan of PLAN_IDS) assert.equal(isSubscriptionActive({ plan, currentPeriodEnd: end }), true);
  assert.equal(isSubscriptionActive({ plan: 'none', currentPeriodEnd: end }), false);
});

test('public plan list says plans are unavailable without Kora credentials and currency', async () => {
  const plans = await getPublicPlans();
  assert.equal(plans.length, 3);
  assert.ok(plans.every((p) => p.configured === false));
  assert.ok(plans.every((p) => p.paymentCurrency === ''));
});

test('checkout refuses an unknown plan or missing Kora configuration, before touching the network', async () => {
  const base = { email: 'a@b.co', firstName: 'A', lastName: 'B', businessName: 'Acme' };
  await assert.rejects(() => startSignupCheckout({ ...base, plan: 'free' }), /choose a plan/i);
  await assert.rejects(() => startSignupCheckout({ ...base, plan: 'pro' }), /not configured/i);
});
