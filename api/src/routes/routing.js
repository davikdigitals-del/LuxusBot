import express from 'express';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import { Business, User } from '../models/index.js';
import logger from '../utils/logger.js';

const router = express.Router();
const DEPT = /^[a-z0-9][a-z0-9 _-]{0,29}$/;

router.get('/:id/routing', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  const business = await Business.findById(req.businessId).select('routing');
  if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
  res.json({ success: true, routing: business.routing });
});

router.put('/:id/routing', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const body = req.body || {};
    const set = {};
    const currentBusiness = await Business.findById(req.businessId);
    if (!currentBusiness) return res.status(404).json({ success: false, error: 'Business not found' });
    const departments = currentBusiness.departments || [];

    if (typeof body.enabled === 'boolean') set['routing.enabled'] = body.enabled;

    if (body.rules !== undefined) {
      if (!Array.isArray(body.rules) || body.rules.length > 20) {
        return res.status(400).json({ success: false, error: 'rules must be an array of up to 20 items' });
      }
      const rules = [];
      for (const r of body.rules) {
        const department = String(r?.department || '').trim().toLowerCase();
        const keywords = (Array.isArray(r?.keywords) ? r.keywords : [])
          .filter((k) => typeof k === 'string')
          .map((k) => k.trim().toLowerCase())
          .filter((k) => k.length >= 2 && k.length <= 60)
          .slice(0, 30);
        if (!DEPT.test(department) || keywords.length === 0) {
          return res.status(400).json({ success: false, error: 'Each rule needs a department name and at least one keyword' });
        }
        if (!departments.includes(department)) {
          return res.status(400).json({ success: false, error: `Create the ${department} department before using it in a routing rule` });
        }
        rules.push({ department, keywords });
      }
      set['routing.rules'] = rules;
    }

    if (body.humanRequestDepartment !== undefined) {
      const d = String(body.humanRequestDepartment || '').trim().toLowerCase();
      if (d && !DEPT.test(d)) return res.status(400).json({ success: false, error: 'Invalid department name' });
      if (d && !departments.includes(d)) {
        return res.status(400).json({ success: false, error: `Create the ${d} department before routing human requests to it` });
      }
      set['routing.humanRequestDepartment'] = d;
    }

    if (body.fallbackAgentId !== undefined) {
      if (body.fallbackAgentId) {
        const agent = await User.findById(body.fallbackAgentId);
        const ok = agent?.memberships.some((m) => String(m.businessId) === String(req.businessId) && m.status === 'active');
        if (!ok) return res.status(400).json({ success: false, error: 'Fallback person must be an active team member' });
      }
      set['routing.fallbackAgentId'] = body.fallbackAgentId || null;
    }

    if (body.customerNotice !== undefined) {
      if (typeof body.customerNotice !== 'string' || body.customerNotice.length > 300) {
        return res.status(400).json({ success: false, error: 'customerNotice must be text up to 300 characters' });
      }
      set['routing.customerNotice'] = body.customerNotice.trim();
    }

    if (body.customerUnavailableNotice !== undefined) {
      if (typeof body.customerUnavailableNotice !== 'string' || body.customerUnavailableNotice.length > 300) {
        return res.status(400).json({ success: false, error: 'customerUnavailableNotice must be text up to 300 characters' });
      }
      set['routing.customerUnavailableNotice'] = body.customerUnavailableNotice.trim();
    }

    const business = await Business.findByIdAndUpdate(req.businessId, { $set: set }, { new: true }).select('routing');
    res.json({ success: true, routing: business.routing });
  } catch (error) {
    logger.error('Routing settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to save routing settings' });
  }
});

export default router;
