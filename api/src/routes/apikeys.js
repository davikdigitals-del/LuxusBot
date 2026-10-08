import express from 'express';
import { Business } from '../models/index.js';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import { generateApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { isSubscriptionActive } from '../utils/subscriptionState.js';

// Mounted under /api/business (see app.js).
const router = express.Router();

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ALLOWED_PERMISSIONS = ['messages:read', 'messages:send', 'conversations:read', 'knowledge:read', 'knowledge:write'];

/**
 * @route   GET /api/business/:id/api-keys
 * @desc    List this business's API keys (never returns the raw key or its hash)
 * @access  Private (admin, owner)
 */
router.get('/:id/api-keys', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);
    const keys = business.apiKeys.map((k) => ({
      id: k._id,
      name: k.name,
      prefix: k.prefix,
      permissions: k.permissions,
      enabled: k.enabled,
      lastUsed: k.lastUsed,
      createdAt: k.createdAt,
    }));
    res.json({ success: true, apiKeys: keys, availablePermissions: ALLOWED_PERMISSIONS });
  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to list API keys' });
  }
});

/**
 * @route   POST /api/business/:id/api-keys
 * @desc    Create an API key. The raw key is returned ONCE, here only - only
 *          its hash and a display prefix are stored, so it can never be
 *          shown again after this response.
 * @access  Private (admin, owner) - and requires a paid plan, same as using the key does
 */
router.post('/:id/api-keys', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const business = await Business.findById(req.businessId);

    if (!isSubscriptionActive(business.subscription, Date.now(), config.billing.graceDays)) {
      return res.status(403).json({ success: false, error: 'API access requires a paid plan' });
    }

    const { name, permissions } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ success: false, error: 'name is required (max 100 characters)' });
    }
    if (!Array.isArray(permissions) || permissions.length === 0 || !permissions.every((p) => ALLOWED_PERMISSIONS.includes(p))) {
      return res.status(400).json({ success: false, error: `permissions must be a non-empty array from: ${ALLOWED_PERMISSIONS.join(', ')}` });
    }
    if (business.apiKeys.length >= 10) {
      return res.status(400).json({ success: false, error: 'API key limit reached (10 per business)' });
    }

    const env = 'live'; // a future "test mode" would branch here
    const { key, prefix, keyHash } = generateApiKey(env);

    business.apiKeys.push({
      name: name.trim(),
      keyHash,
      prefix,
      permissions,
      enabled: true,
      createdAt: new Date(),
    });
    await business.save();

    const created = business.apiKeys[business.apiKeys.length - 1];

    res.status(201).json({
      success: true,
      apiKey: key, // shown once - the client must copy this now
      details: { id: created._id, name: created.name, prefix: created.prefix, permissions: created.permissions },
      message: 'Save this key now - it will not be shown again.',
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to create API key' });
  }
});

/**
 * @route   PUT /api/business/:id/api-keys/:keyId
 * @desc    Enable/disable a key without deleting it
 * @access  Private (admin, owner)
 */
router.put('/:id/api-keys/:keyId', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.keyId)) {
      return res.status(400).json({ success: false, error: 'Invalid key ID' });
    }
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be true or false' });
    }

    const business = await Business.findById(req.businessId);
    const key = business.apiKeys.id(req.params.keyId);
    if (!key) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    key.enabled = enabled;
    await business.save();

    res.json({ success: true, apiKey: { id: key._id, enabled: key.enabled } });
  } catch (error) {
    logger.error('Error updating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to update API key' });
  }
});

/**
 * @route   DELETE /api/business/:id/api-keys/:keyId
 * @access  Private (admin, owner)
 */
router.delete('/:id/api-keys/:keyId', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.keyId)) {
      return res.status(400).json({ success: false, error: 'Invalid key ID' });
    }

    const business = await Business.findById(req.businessId);
    const key = business.apiKeys.id(req.params.keyId);
    if (!key) {
      return res.status(404).json({ success: false, error: 'API key not found' });
    }

    key.deleteOne();
    await business.save();

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

export default router;
