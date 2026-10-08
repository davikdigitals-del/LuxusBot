import express from 'express';
import { authenticate } from '../middleware/auth.js';
import sessionRegistry from '../core/whatsapp/SessionRegistry.js';
import { statusPayload } from './whatsapp.js';
import logger from '../utils/logger.js';

// Mounted under /api/agent (see app.js). Agents link their OWN personal
// WhatsApp, scoped to the logged-in user rather than to any one business -
// the same linked number is reused across every business they're a member of.
const router = express.Router();

/**
 * @route   POST /api/agent/whatsapp/connect
 * @access  Private (any authenticated user)
 */
router.post('/whatsapp/connect', authenticate, async (req, res) => {
  try {
    await sessionRegistry.connect('agent', req.userId);
    res.json({ success: true, ...(await statusPayload('agent', req.userId)) });
  } catch (error) {
    logger.error('Error connecting agent WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to start WhatsApp connection' });
  }
});

/**
 * @route   GET /api/agent/whatsapp/status
 * @access  Private
 */
router.get('/whatsapp/status', authenticate, async (req, res) => {
  try {
    res.json({ success: true, ...(await statusPayload('agent', req.userId)) });
  } catch (error) {
    logger.error('Error getting agent WhatsApp status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * @route   DELETE /api/agent/whatsapp
 * @access  Private
 */
router.delete('/whatsapp', authenticate, async (req, res) => {
  try {
    await sessionRegistry.disconnect('agent', req.userId);
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (error) {
    logger.error('Error disconnecting agent WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

export default router;
