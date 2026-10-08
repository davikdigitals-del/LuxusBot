import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/index.js';
import { Business, User } from '../models/index.js';
import logger from '../utils/logger.js';
import authService from './authService.js';
import emailService from './emailService.js';
import { legacySubscriptionState, LEGACY_EVENT_TO_STATUS, addMonths } from '../utils/subscriptionState.js';

/**
 * Three monthly plans. Customers pay BEFORE an account exists; the account is created by the
 * verified payment webhook. Legacy recurring plans continue to use their historical plan codes.
 * replies = AI replies per month (the real limit on what a customer can cost you).
 */
export const PLANS = {
  pro: {
    id: 'pro', name: 'Pro', priceUsd: 60, replies: 2000, teamMembers: 3, knowledgeMB: 100,
    tagline: 'For a small business getting started with WhatsApp automation.',
    features: ['2,000 AI replies / month', '3 team members', '100 MB knowledge base', 'Live-agent handoff', 'API access', 'Email support'],
  },
  individual: {
    id: 'individual', name: 'Individual', priceUsd: 360, replies: 15000, teamMembers: 10, knowledgeMB: 500,
    tagline: 'For a busy business with steady daily WhatsApp traffic.',
    features: ['15,000 AI replies / month', '10 team members', '500 MB knowledge base', 'Live-agent handoff', 'API access', 'Priority support'],
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', priceUsd: 980, replies: 50000, teamMembers: 50, knowledgeMB: 2000,
    tagline: 'For high volume and larger support teams.',
    features: ['50,000 AI replies / month', '50 team members', '2 GB knowledge base', 'Live-agent handoff', 'API access', 'Dedicated support'],
  },
};

export const planById = (id) => PLANS[String(id)] || null;
const planCodeFor = (id) => config.legacyBilling.planCodes?.[id] || '';
const planByCode = (code) => (code ? Object.values(PLANS).find((p) => planCodeFor(p.id) === code) || null : null);

export const planLimits = (plan) => ({
  messagesPerMonth: plan.replies,
  aiBudgetUsd: config.billing.aiBudgetUsd, // 0 = no AI cost cap
  maxKnowledgeBaseMB: plan.knowledgeMB,
  maxTeamMembers: plan.teamMembers,
  maxApiCallsPerMonth: plan.replies * 10,
});

const isKoraConfigured = () => Boolean(config.kora.secretKey && config.kora.defaultCurrency);
const paymentChannels = () => config.kora.channels.split(',').map((channel) => channel.trim()).filter(Boolean);

/** Legacy plan lookup is retained only to validate existing recurring subscriptions. */
const planCache = new Map();
async function legacyPlanInfo(planId) {
  const code = planCodeFor(planId);
  if (!code) throw new Error('This plan is not available yet. Please try again later.');
  const hit = planCache.get(code);
  if (hit && hit.expires > Date.now()) return hit.info;
  const res = await legacyPaymentRequest('get', `plan/${code}`);
  const info = { code, amount: Number(res.data.amount), currency: String(res.data.currency || '').toUpperCase(), interval: res.data.interval };
  planCache.set(code, { info, expires: Date.now() + 10 * 60 * 1000 });
  return info;
}

export async function getPublicPlans() {
  const configured = isKoraConfigured() && paymentChannels().length > 0;
  return Object.values(PLANS).map((plan) => ({
    ...plan,
    configured,
    paymentCurrency: configured ? config.kora.defaultCurrency : '',
  }));
}

async function legacyPaymentRequest(method, path, data) {
  if (!config.legacyBilling.secretKey) throw new Error('Legacy subscription management is not configured.');
  try {
    const res = await axios({
      method,
      url: `https://api.paystack.co/${path}`,
      headers: { Authorization: `Bearer ${config.paystack.secretKey}` },
      data,
      timeout: 15000,
    });
    return res.data;
  } catch (error) {
    logger.error('Legacy subscription API error:', { path, status: error.response?.status, message: error.response?.data?.message || error.message });
    throw new Error(error.response?.data?.message || 'The payment provider could not be reached. Please try again.');
  }
}

async function kora(method, path, data) {
  if (!config.kora.secretKey) throw new Error('Kora payments are not configured yet.');
  try {
    const res = await axios({
      method,
      url: `https://api.korapay.com/merchant/api/v1/${path}`,
      headers: { Authorization: config.kora.secretKey },
      data,
      timeout: 15000,
    });
    if (!res.data?.status) throw new Error(res.data?.message || 'Kora request failed.');
    return res.data;
  } catch (error) {
    logger.error('Kora API error:', {
      path,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw new Error(error.response?.data?.message || error.message || 'The payment provider could not be reached.');
  }
}

async function createKoraCheckout({ plan, email, customerName, redirectUrl, metadata }) {
  if (!isKoraConfigured()) throw new Error('Kora payments are not configured yet.');
  const currency = config.kora.defaultCurrency;
  const rateReference = `luxus-rate-${crypto.randomUUID()}`;
  const rate = currency === 'USD'
    ? { data: { to_amount: plan.priceUsd } }
    : await kora('post', 'conversions/rates', {
      amount: plan.priceUsd,
      from_currency: 'USD',
      to_currency: currency,
      reference: rateReference,
    });
  const chargeAmount = Math.ceil(Number(rate.data?.to_amount));
  if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
    throw new Error('Kora returned an invalid exchange rate for this plan.');
  }

  const reference = `luxus-${crypto.randomUUID()}`;
  const checkout = await kora('post', 'charges/initialize', {
    amount: chargeAmount,
    currency,
    reference,
    customer: { name: customerName, email },
    redirect_url: redirectUrl,
    notification_url: `${config.appUrl}/api/billing/kora-webhook`,
    narration: `${plan.name} monthly subscription`,
    channels: paymentChannels(),
    metadata,
  });
  if (typeof checkout.data?.checkout_url !== 'string' || !checkout.data.checkout_url) {
    throw new Error('Kora did not return a checkout URL.');
  }
  return { url: checkout.data.checkout_url, reference, amount: chargeAmount, currency };
}

/** Verify signatures for existing subscriptions using their historical webhook format. */
export function verifyLegacyWebhookSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = Buffer.from(crypto.createHmac('sha512', secret).update(rawBody).digest('hex'));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanStr = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Step 1 of joining: the website form. Creates NO account - it only opens a Kora
 * checkout for the $60 plan. The account appears when the payment succeeds.
 */
export async function startSignupCheckout({ email, firstName, lastName, businessName, plan: planId }) {
  const plan = planById(planId);
  if (!plan) throw new Error('Please choose a plan.');
  if (!isKoraConfigured() || !paymentChannels().length) throw new Error('Payments are not configured yet. Please try again later.');
  const cleanEmail = cleanStr(email, 200).toLowerCase();
  const first = cleanStr(firstName, 60);
  const last = cleanStr(lastName, 60);
  const business = cleanStr(businessName, 100);

  if (!EMAIL_RE.test(cleanEmail)) throw new Error('Please enter a valid email address.');
  if (!first || !last) throw new Error('Please enter your first and last name.');
  if (business.length < 2) throw new Error('Please enter your business name.');

  if (await User.findByEmail(cleanEmail)) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  return createKoraCheckout({
    plan,
    email: cleanEmail,
    customerName: `${first} ${last}`,
    redirectUrl: `${config.appUrl}/welcome`,
    metadata: { purpose: 'signup', plan: plan.id, businessName: business, firstName: first, lastName: last },
  });
}

/** Existing customers pay manually through Kora when renewing or changing plans. */
export async function createCheckoutSession({ businessId, user, plan: planId }) {
  const plan = planById(planId);
  if (!plan) throw new Error('Please choose a plan.');
  if (!isKoraConfigured() || !paymentChannels().length) throw new Error('Payments are not configured yet. Please try again later.');
  const business = await Business.findById(businessId).select('_id');
  if (!business) throw new Error('Business not found');
  return createKoraCheckout({
    plan,
    email: user.email,
    customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    redirectUrl: `${config.appUrl}/dashboard/billing?paid=1`,
    metadata: { purpose: 'resubscribe', plan: plan.id, businessId: String(businessId) },
  });
}

/** Management link for a subscription created before Kora checkout was introduced. */
export async function createPortalSession(businessId) {
  const business = await Business.findById(businessId).select('subscription');
  const sub = business?.subscription;
  if (!sub?.paystackCustomerCode && !sub?.paystackSubscriptionCode) throw new Error('No subscription found for this business');

  let code = sub.paystackSubscriptionCode;
  if (!code) {
    await syncSubscriptionFromCustomer(business._id, sub.paystackCustomerCode, planCodeFor(sub.plan));
    const fresh = await Business.findById(businessId).select('subscription');
    code = fresh?.subscription?.paystackSubscriptionCode;
  }
  if (!code) throw new Error('Your subscription is still being set up. Please try again in a minute.');

  const res = await legacyPaymentRequest('get', `subscription/${code}/manage/link`);
  return { url: res.data.link };
}

/** Best effort: copy the customer's subscription code/token onto the business. */
async function syncSubscriptionFromCustomer(businessId, customerCode, planCode) {
  if (!customerCode) return;
  try {
    const res = await legacyPaymentRequest('get', `customer/${customerCode}`);
    const subs = (res.data?.subscriptions || []).filter((s) => ['active', 'non-renewing', 'attention'].includes(s.status));
    const sub = subs.find((x) => planCode && x.plan?.plan_code === planCode) || subs[0];
    if (!sub) return;
    await Business.updateOne({ _id: businessId }, { $set: {
      'subscription.paystackSubscriptionCode': sub.subscription_code,
      'subscription.paystackEmailToken': sub.email_token,
    } });
  } catch (error) {
    logger.warn('Could not sync legacy subscription details:', error.message);
  }
}

async function findBusiness({ businessId, customerCode, subscriptionCode, email }) {
  if (businessId && mongoose.Types.ObjectId.isValid(businessId)) {
    const b = await Business.findById(businessId);
    if (b) return b;
  }
  if (customerCode) {
    const b = await Business.findOne({ 'subscription.paystackCustomerCode': customerCode });
    if (b) return b;
  }
  if (subscriptionCode) {
    const b = await Business.findOne({ 'subscription.paystackSubscriptionCode': subscriptionCode });
    if (b) return b;
  }
  if (email) {
    const user = await User.findByEmail(String(email).toLowerCase());
    if (user) return Business.findOne({ owner: user._id });
  }
  return null;
}

async function handleLegacyChargeSuccess(data) {
  const md = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  const paidCode = data.plan?.plan_code;
  // Identify a recurring plan by its historical plan code, then by payment metadata.
  const plan = planByCode(paidCode) || (md.purpose ? planById(md.plan) : null);
  if (!plan || data.status !== 'success') return;

  // Only a full, verified payment for a historical plan opens or extends an account.
  if (paidCode !== planCodeFor(plan.id)) {
    logger.warn('Legacy charge ignored: plan did not match', { reference: data.reference });
    return;
  }
  const info = await legacyPlanInfo(plan.id);
  if (String(data.currency).toUpperCase() !== info.currency || Number(data.amount) < info.amount) {
    logger.warn('Legacy charge ignored: unexpected amount/currency', { reference: data.reference, amount: data.amount, currency: data.currency });
    return;
  }

  const reference = data.reference;
  const email = data.customer?.email?.toLowerCase();
  const customerCode = data.customer?.customer_code;
  const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();

  const business = await findBusiness({ businessId: md.businessId, customerCode, email });

  if (!business) {
    if (md.purpose !== 'signup') {
      logger.warn('Legacy payment for an unknown business', { reference });
      return;
    }
    const { user, business: created } = await authService.createPaidAccount({
      email,
      firstName: md.firstName,
      lastName: md.lastName,
      businessName: md.businessName || email,
      plan: plan.id,
      paystackCustomerCode: customerCode,
      paymentReference: reference,
      paidAt,
      periodEnd: addMonths(paidAt, 1),
      limits: planLimits(plan),
    });
    emailService
      .sendAccountReadyEmail(user.email, user.firstName, created.name, user.passwordResetToken)
      .catch((err) => logger.error('Account-ready email failed:', err));
    await syncSubscriptionFromCustomer(created._id, customerCode, planCodeFor(plan.id));
    logger.info(`New paid account created: ${user.email} (${plan.id})`);
    return;
  }

  if (business.subscription?.paymentProvider === 'kora') {
    logger.warn('Legacy charge ignored for a Kora subscription', { reference });
    return;
  }

  // Renewal / re-subscription / plan change. The reference check makes webhook retries harmless.
  const oldCode = business.subscription?.paystackSubscriptionCode;
  const oldToken = business.subscription?.paystackEmailToken;
  const set = {
    'subscription.plan': plan.id,
    'subscription.status': 'active',
    'subscription.paymentProvider': 'legacy',
    'subscription.lastPaymentReference': reference,
    'subscription.currentPeriodStart': paidAt,
    'subscription.currentPeriodEnd': addMonths(paidAt, 1),
    'subscription.cancelAtPeriodEnd': false,
    limits: planLimits(plan),
    'usage.messagesThisMonth': 0,
    'usage.apiCallsThisMonth': 0,
    'usage.aiCostThisMonth': 0,
    'usage.lastResetAt': new Date(),
  };
  if (customerCode) set['subscription.paystackCustomerCode'] = customerCode;

  const res = await Business.updateOne({ _id: business._id, 'subscription.lastPaymentReference': { $ne: reference } }, { $set: set });
  if (!res.modifiedCount) return; // already processed

  await syncSubscriptionFromCustomer(business._id, customerCode || business.subscription?.paystackCustomerCode, planCodeFor(plan.id));

  // Changed plan: stop the old subscription so they are not billed twice
  if (oldCode && oldToken) {
    const fresh = await Business.findById(business._id).select('subscription.paystackSubscriptionCode');
    const newCode = fresh?.subscription?.paystackSubscriptionCode;
    if (newCode && newCode !== oldCode) {
      await legacyPaymentRequest('post', 'subscription/disable', { code: oldCode, token: oldToken })
        .catch((err) => logger.error('Could not cancel the old subscription after a plan change:', err.message));
    }
  }
}

async function handleLegacySubscriptionEvent(eventType, data) {
  const state = legacySubscriptionState(LEGACY_EVENT_TO_STATUS[eventType]);
  if (!state) return;

  const subscriptionCode = data.subscription_code || data.subscription?.subscription_code;
  const business = await findBusiness({
    customerCode: data.customer?.customer_code,
    subscriptionCode,
    email: data.customer?.email,
  });
  if (!business) {
    logger.info(`Legacy subscription ${eventType}: business not found yet`);
    return;
  }
  if (business.subscription?.paymentProvider === 'kora') return;

  // An old subscription being closed after a plan change must not affect the new one
  const stored = business.subscription?.paystackSubscriptionCode;
  if (subscriptionCode && stored && stored !== subscriptionCode && eventType !== 'subscription.create') return;

  const set = {
    'subscription.status': state.status,
    'subscription.cancelAtPeriodEnd': state.cancelAtPeriodEnd,
  };
  if (subscriptionCode) set['subscription.paystackSubscriptionCode'] = subscriptionCode;
  if (data.email_token) set['subscription.paystackEmailToken'] = data.email_token;
  if (eventType === 'subscription.create' && data.next_payment_date) {
    set['subscription.currentPeriodEnd'] = new Date(data.next_payment_date);
  }
  await Business.updateOne({ _id: business._id }, { $set: set });
}

export async function handleLegacyPaymentEvent(event) {
  const data = event?.data || {};
  switch (event?.event) {
    case 'charge.success':
      return handleLegacyChargeSuccess(data);
    case 'subscription.create':
    case 'subscription.not_renew':
    case 'subscription.disable':
    case 'invoice.payment_failed':
      return handleLegacySubscriptionEvent(event.event, data);
    default:
      return undefined;
  }
}

export function verifyKoraSignature(data, signature, secret) {
  if (!data || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest();
  let given;
  try {
    given = Buffer.from(String(signature), 'hex');
  } catch {
    return false;
  }
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

async function handleKoraChargeSuccess(data) {
  const providerReference = typeof data.reference === 'string' ? data.reference : '';
  if (!providerReference) {
    logger.warn('Kora charge ignored: missing transaction reference');
    return;
  }

  const verifiedResponse = await kora('get', `charges/${encodeURIComponent(providerReference)}`);
  const verified = verifiedResponse.data || {};
  if (verified.status !== 'success' || (data.transaction_status && data.transaction_status !== 'success')) {
    logger.warn('Kora charge ignored: transaction is not successful', { reference: providerReference });
    return;
  }

  const currency = String(verified.currency || '').toUpperCase();
  const amountPaid = Number(verified.amount_paid ?? data.amount ?? verified.amount);
  const amountExpected = Number(verified.amount_expected ?? data.amount_expected ?? verified.amount);
  if (
    currency !== config.kora.defaultCurrency
    || !Number.isFinite(amountPaid)
    || !Number.isFinite(amountExpected)
    || amountExpected <= 0
    || amountPaid < amountExpected
  ) {
    logger.warn('Kora charge ignored: amount or currency did not match', {
      reference: providerReference, amountPaid, amountExpected, currency,
    });
    return;
  }

  const metadata = verified.metadata || data.metadata || {};
  const plan = metadata.purpose ? planById(metadata.plan) : null;
  if (!plan) {
    logger.warn('Kora charge ignored: missing or invalid plan metadata', { reference: providerReference });
    return;
  }

  const paymentReference = String(data.payment_reference || providerReference);
  const customerEmail = String(verified.customer?.email || data.customer?.email || '').toLowerCase();
  const transactionDate = verified.transaction_date || data.transaction_date;
  const parsedPaidAt = transactionDate ? new Date(transactionDate) : new Date();
  const paidAt = Number.isNaN(parsedPaidAt.getTime()) ? new Date() : parsedPaidAt;
  let business = null;
  if (mongoose.Types.ObjectId.isValid(metadata.businessId)) {
    business = await Business.findById(metadata.businessId);
  }
  if (!business && customerEmail) {
    const owner = await User.findByEmail(customerEmail);
    if (owner) business = await Business.findOne({ owner: owner._id });
  }

  if (!business) {
    if (metadata.purpose !== 'signup' || !customerEmail) {
      logger.warn('Kora payment for an unknown business', { reference: paymentReference });
      return;
    }
    const { user, business: created } = await authService.createPaidAccount({
      email: customerEmail,
      firstName: metadata.firstName,
      lastName: metadata.lastName,
      businessName: metadata.businessName || customerEmail,
      plan: plan.id,
      paymentProvider: 'kora',
      paymentReference,
      paidAt,
      periodEnd: addMonths(paidAt, 1),
      limits: planLimits(plan),
    });
    emailService
      .sendAccountReadyEmail(user.email, user.firstName, created.name, user.passwordResetToken)
      .catch((err) => logger.error('Account-ready email failed:', err));
    logger.info(`New Kora paid account created: ${user.email} (${plan.id})`);
    return;
  }

  const oldCode = business.subscription?.paystackSubscriptionCode;
  const oldToken = business.subscription?.paystackEmailToken;
  const currentEnd = new Date(business.subscription?.currentPeriodEnd || 0);
  const periodStart = business.subscription?.paymentProvider === 'kora' && currentEnd > paidAt
    ? currentEnd
    : paidAt;
  const set = {
    'subscription.plan': plan.id,
    'subscription.status': 'active',
    'subscription.paymentProvider': 'kora',
    'subscription.lastPaymentReference': paymentReference,
    'subscription.currentPeriodStart': periodStart,
    'subscription.currentPeriodEnd': addMonths(periodStart, 1),
    'subscription.cancelAtPeriodEnd': false,
    limits: planLimits(plan),
    'usage.messagesThisMonth': 0,
    'usage.apiCallsThisMonth': 0,
    'usage.aiCostThisMonth': 0,
    'usage.lastResetAt': new Date(),
  };
  const update = await Business.updateOne(
    { _id: business._id, 'subscription.lastPaymentReference': { $ne: paymentReference } },
    { $set: set },
  );
  if (!update.modifiedCount) return;

  if (oldCode && oldToken) {
    try {
      await legacyPaymentRequest('post', 'subscription/disable', { code: oldCode, token: oldToken });
      await Business.updateOne({ _id: business._id }, { $unset: {
        'subscription.paystackSubscriptionCode': '',
        'subscription.paystackEmailToken': '',
        'subscription.paystackCustomerCode': '',
      } });
    } catch (error) {
      logger.error('Could not cancel the previous automatic subscription after Kora payment:', error.message);
    }
  }
}

export async function handleKoraEvent(event) {
  if (event?.event === 'charge.success' && event.data?.status === 'success') {
    return handleKoraChargeSuccess(event.data);
  }
  return undefined;
}
