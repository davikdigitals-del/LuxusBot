import express from 'express';
import QRCode from 'qrcode';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import sessionRegistry from '../core/whatsapp/SessionRegistry.js';
import logger from '../utils/logger.js';

// Mounted under /api/business (see app.js) - every path here is relative to that.
const router = express.Router();

/** QR rendered server-side as a data: URL so the frontend just <img src={qr}>'s it. */
const statusPayload = async (ownerType, ownerId) => {
  const status = await sessionRegistry.getStatus(ownerType, ownerId);
  const qrDataUrl = status.qr ? await QRCode.toDataURL(status.qr).catch(() => null) : null;
  return {
    status: status.status,
    phoneNumber: status.phoneNumber,
    connectedAt: status.connectedAt,
    qr: qrDataUrl,
  };
};

/**
 * @route   POST /api/business/:id/whatsapp/connect
 * @desc    Start (or resume) connecting the business's assistant WhatsApp number.
 *          Poll GET status right after - the QR arrives asynchronously.
 * @access  Private (admin, owner)
 */
router.post('/:id/whatsapp/connect', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    if (req.body?.refresh === true) {
      await sessionRegistry.refreshQr('business', req.businessId);
    } else {
      await sessionRegistry.connect('business', req.businessId);
    }
    res.json({ success: true, ...(await statusPayload('business', req.businessId)) });
  } catch (error) {
    if (error.message === 'A QR code can only be refreshed while waiting to scan it') {
      return res.status(409).json({ success: false, error: error.message });
    }
    logger.error('Error connecting business WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to start WhatsApp connection' });
  }
});

/**
 * @route   GET /api/business/:id/whatsapp/status
 * @access  Private (any role)
 */
router.get('/:id/whatsapp/status', authenticate, requireBusiness, async (req, res) => {
  try {
    res.json({ success: true, ...(await statusPayload('business', req.businessId)) });
  } catch (error) {
    logger.error('Error getting business WhatsApp status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * @route   DELETE /api/business/:id/whatsapp
 * @desc    Unlink the business's assistant WhatsApp number (requires re-scanning to reconnect)
 * @access  Private (admin, owner)
 */
router.delete('/:id/whatsapp', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    await sessionRegistry.disconnect('business', req.businessId);
    res.json({ success: true, message: 'WhatsApp disconnected' });
  } catch (error) {
    logger.error('Error disconnecting business WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

export default router;
export { statusPayload };
