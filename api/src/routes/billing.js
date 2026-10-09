import express from 'express';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import { authLimiters } from '../middleware/rateLimit.js';
import {
  createCheckoutSession, createPortalSession, getPublicPlans, startSignupCheckout,
  verifyLegacyWebhookSignature, handleLegacyPaymentEvent, verifyKoraSignature, handleKoraEvent,
} from '../services/billingService.js';
import googleAuthService from '../services/googleAuthService.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Public: what the website shows
router.get('/plans', async (req, res) => {
  try {
    res.json({ success: true, plans: await getPublicPlans() });
  } catch (error) {
    logger.error('Plans error:', error);
    res.status(500).json({ success: false, error: 'Could not load plans' });
  }
});

// Public: the website's "Get started" form. Creates NO account - it only returns a Kora
// checkout link. The account is created by the webhook once the payment succeeds.
router.post('/signup', authLimiters.register, async (req, res) => {
  try {
    const { email, firstName, lastName, businessName, plan } = req.body || {};
    const strings = [email, firstName, lastName, businessName, plan];
    if (!strings.every((v) => typeof v === 'string' && v.length > 0)) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    const { url } = await startSignupCheckout({ email, firstName, lastName, businessName, plan });
    res.json({ success: true, url });
  } catch (error) {
    logger.warn('Signup checkout error:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Could not start checkout' });
  }
});

router.post('/google-signup', authLimiters.register, async (req, res) => {
  try {
    const { credential, firstName, lastName, businessName, plan } = req.body || {};
    if (![credential, businessName, plan].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ success: false, error: 'Google sign-in, business name, and plan are required' });
    }

    const profile = await googleAuthService.verifyCredential(credential);
    const checkout = await startSignupCheckout({
      email: profile.email,
      firstName: typeof firstName === 'string' && firstName.trim() ? firstName : profile.firstName,
      lastName: typeof lastName === 'string' && lastName.trim() ? lastName : profile.lastName,
      businessName,
      plan,
    });
    res.json({ success: true, url: checkout.url });
  } catch (error) {
    logger.warn('Google signup checkout error:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Could not start checkout' });
  }
});

// Existing account whose subscription lapsed
router.post('/:id/checkout', authenticate, requireBusiness, requireRole('owner', 'admin'), async (req, res) => {
  try {
    res.json({ success: true, ...(await createCheckoutSession({ businessId: req.businessId, user: req.user, plan: req.body?.plan })) });
  } catch (error) {
    logger.error('Billing checkout error:', error);
    res.status(400).json({ success: false, error: error.message || 'Could not create checkout session' });
  }
});

// Manage a subscription created before Kora checkout was introduced.
router.post('/:id/portal', authenticate, requireBusiness, requireRole('owner', 'admin'), async (req, res) => {
  try {
    res.json({ success: true, ...(await createPortalSession(req.businessId)) });
  } catch (error) {
    logger.error('Billing portal error:', error);
    res.status(400).json({ success: false, error: error.message || 'Could not open billing page' });
  }
});

export const legacyWebhookHandler = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (!verifyLegacyWebhookSignature(rawBody, req.headers['x-paystack-signature'], config.legacyBilling.secretKey)) {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }
    await handleLegacyPaymentEvent(JSON.parse(rawBody.toString('utf8')));
    res.sendStatus(200);
  } catch (error) {
    // Returning a failure lets the provider retry; payment updates are idempotent.
    logger.error('Legacy payment webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
};

export const koraWebhookHandler = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const event = JSON.parse(rawBody.toString('utf8'));
    if (!verifyKoraSignature(event.data, req.headers['x-korapay-signature'], config.kora.secretKey)) {
      return res.status(400).json({ success: false, error: 'Invalid Kora signature' });
    }
    await handleKoraEvent(event);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Kora webhook error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
};

export default router;
