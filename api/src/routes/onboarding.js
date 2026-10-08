import express from 'express';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import { Business } from '../models/index.js';

const router = express.Router();
const STEPS = ['businessInfo','whatsappConnected','assistantCustomized','knowledgeBaseAdded','planSelected'];

router.get('/:id/onboarding', authenticate, requireBusiness, async (req, res) => {
  const business = await Business.findById(req.businessId).select('onboarding name contact assistant whatsapp subscription');
  if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
  res.json({ success: true, onboarding: business.onboarding, business: { name: business.name, contact: business.contact, assistant: business.assistant, whatsapp: { status: business.whatsapp?.status }, plan: business.subscription?.plan } });
});

router.put('/:id/onboarding', authenticate, requireBusiness, requireRole('owner','admin'), async (req, res) => {
  const updates = {};
  for (const step of STEPS) if (typeof req.body?.[step] === 'boolean') updates[`onboarding.steps.${step}`] = req.body[step];
  const business = await Business.findByIdAndUpdate(req.businessId, { $set: updates }, { new: true }).select('onboarding');
  if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
  const completed = STEPS.every((step) => business.onboarding?.steps?.[step]);
  if (completed !== business.onboarding.completed) {
    business.onboarding.completed = completed;
    await business.save();
  }
  res.json({ success: true, onboarding: business.onboarding });
});

export default router;
