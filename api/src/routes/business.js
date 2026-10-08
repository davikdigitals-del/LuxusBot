import express from 'express';
import moment from 'moment-timezone';
import { Business, User } from '../models/index.js';
import { authenticate, requireBusiness, requireRole, requireOwner } from '../middleware/auth.js';
import crypto from 'crypto';
import authService from '../services/authService.js';
import { encrypt } from '../utils/crypto.js';
import { isSafeOutboundUrl } from '../utils/urlSafety.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   GET /api/business
 * @desc    Get all businesses for current user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const businessIds = req.user.memberships
      .filter(m => m.status === 'active')
      .map(m => m.businessId);
    
    const businesses = await Business.find({
      _id: { $in: businessIds },
      status: 'active'
    });
    
    // Add user's role to each business
    const businessesWithRole = businesses.map(business => {
      const sanitized = authService.sanitizeBusiness(business);
      sanitized.userRole = req.user.getRoleInBusiness(business._id);
      return sanitized;
    });
    
    res.json({
      success: true,
      businesses: businessesWithRole
    });
  } catch (error) {
    logger.error('Get businesses endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get businesses'
    });
  }
});

/**
 * @route   GET /api/business/:id
 * @desc    Get single business
 * @access  Private
 */
router.get('/:id', authenticate, requireBusiness, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business || business.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    const sanitized = authService.sanitizeBusiness(business);
    sanitized.userRole = req.userRole;
    
    res.json({
      success: true,
      business: sanitized
    });
  } catch (error) {
    logger.error('Get business endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get business'
    });
  }
});

/**
 * @route   PUT /api/business/:id
 * @desc    Update business
 * @access  Private (Admin or Owner)
 */
router.put('/:id', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    // Update allowed fields (limits, usage, subscription, apiKeys, webhooks are NOT editable here)
    const scalarFields = ['name', 'logo', 'primaryColor', 'timezone'];
    const objectFields = ['contact', 'assistant', 'businessHours', 'notifications'];
    const body = req.body || {};

    const invalid = (message) => res.status(400).json({ success: false, error: message });

    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100)) {
      return invalid('Name must be 1-100 characters');
    }
    if (body.primaryColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(body.primaryColor)) {
      return invalid('primaryColor must be a hex color like #3B82F6');
    }
    if (body.logo !== undefined && body.logo !== null && !isSafeOutboundUrl(body.logo)) {
      return invalid('logo must be a public https URL');
    }
    if (body.assistant?.systemPrompt !== undefined && String(body.assistant.systemPrompt).length > 4000) {
      return invalid('systemPrompt is limited to 4000 characters');
    }
    if (body.businessHours?.timezone !== undefined && (
      typeof body.businessHours.timezone !== 'string' || !moment.tz.zone(body.businessHours.timezone)
    )) {
      return invalid('businessHours.timezone must be a valid IANA timezone');
    }
    if (body.notifications?.slack?.webhookUrl && !isSafeOutboundUrl(body.notifications.slack.webhookUrl)) {
      return invalid('Slack webhook URL must be a public https URL');
    }

    scalarFields.forEach((key) => {
      if (body[key] !== undefined) business.set(key, body[key]);
    });

    // Merge nested settings key by key so unspecified settings keep their values
    objectFields.forEach((key) => {
      const value = body[key];
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subKey === '__proto__' || subKey === 'constructor' || subKey === 'prototype') return;
        business.set(`${key}.${subKey}`, subValue);
      });
    });

    await business.save();
    
    res.json({
      success: true,
      business: authService.sanitizeBusiness(business),
      message: 'Business updated successfully'
    });
  } catch (error) {
    logger.error('Update business endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update business'
    });
  }
});

/**
 * @route   PUT /api/business/:id/ai-config
 * @desc    Update AI configuration
 * @access  Private (Admin or Owner)
 */
router.put('/:id/ai-config', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    const { anthropicKey, temperature, maxTokens } = req.body || {};
    const invalid = (message) => res.status(400).json({ success: false, error: message });

    // The Anthropic key is stored encrypted. Send "" or null to remove it.
    const applyKey = (field, flag, value) => {
      if (value === undefined) return true;
      if (value === null || value === '') {
        business.aiConfig[field] = undefined;
        business.aiConfig[flag] = false;
        return true;
      }
      if (typeof value !== 'string' || value.trim().length < 8 || value.length > 300) return false;
      business.aiConfig[field] = encrypt(value.trim());
      business.aiConfig[flag] = true;
      return true;
    };

    if (!applyKey('anthropicKey', 'anthropicKeySet', anthropicKey)) return invalid('Invalid Anthropic key');

    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 1) {
        return invalid('temperature must be a number between 0 and 1');
      }
      business.aiConfig.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4000) {
        return invalid('maxTokens must be an integer between 1 and 4000');
      }
      business.aiConfig.maxTokens = maxTokens;
    }

    await business.save();
    
    res.json({
      success: true,
      aiConfig: {
        anthropicKeySet: business.aiConfig.anthropicKeySet,
        temperature: business.aiConfig.temperature,
        maxTokens: business.aiConfig.maxTokens
      },
      message: 'AI configuration updated successfully'
    });
  } catch (error) {
    logger.error('Update AI config endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update AI configuration'
    });
  }
});

/**
 * @route   GET /api/business/:id/usage
 * @desc    Get business usage and limits
 * @access  Private
 */
router.get('/:id/usage', authenticate, requireBusiness, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    res.json({
      success: true,
      usage: business.usage,
      limits: business.limits,
      plan: business.subscription.plan
    });
  } catch (error) {
    logger.error('Get usage endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage data'
    });
  }
});

/**
 * @route   DELETE /api/business/:id
 * @desc    Delete business (soft delete)
 * @access  Private (Owner only)
 */
router.delete('/:id', authenticate, requireBusiness, requireOwner, async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    business.status = 'deleted';
    await business.save();
    
    res.json({
      success: true,
      message: 'Business deleted successfully'
    });
  } catch (error) {
    logger.error('Delete business endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete business'
    });
  }
});

/**
 * @route   POST /api/business/:id/webhooks
 * @desc    Add webhook
 * @access  Private (Admin or Owner)
 */
router.post('/:id/webhooks', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    const { name, url, events } = req.body || {};
    const ALLOWED_EVENTS = ['message.received', 'message.sent', 'conversation.started', 'conversation.ended', 'conversation.transferred', 'conversation.returned_to_ai'];

    if (typeof name !== 'string' || !name.trim() || name.length > 100 || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name, URL, and events are required'
      });
    }

    if (!isSafeOutboundUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Webhook URL must be a public https URL'
      });
    }

    if (!events.every(e => ALLOWED_EVENTS.includes(e))) {
      return res.status(400).json({
        success: false,
        error: `Events must be from: ${ALLOWED_EVENTS.join(', ')}`
      });
    }

    if (business.webhooks.length >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Webhook limit reached (10)'
      });
    }

    // The signing secret is always generated server-side and shown once
    business.webhooks.push({
      name: name.trim(),
      url,
      events,
      secret: crypto.randomBytes(32).toString('hex'),
      enabled: true,
      createdAt: new Date()
    });

    await business.save();
    
    res.json({
      success: true,
      webhook: business.webhooks[business.webhooks.length - 1],
      message: 'Webhook added successfully'
    });
  } catch (error) {
    logger.error('Add webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add webhook'
    });
  }
});

/**
 * @route   DELETE /api/business/:id/webhooks/:webhookId
 * @desc    Delete webhook
 * @access  Private (Admin or Owner)
 */
router.delete('/:id/webhooks/:webhookId', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }
    
    business.webhooks = business.webhooks.filter(
      w => w._id.toString() !== req.params.webhookId
    );
    
    await business.save();
    
    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    logger.error('Delete webhook endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete webhook'
    });
  }
});

export default router;
