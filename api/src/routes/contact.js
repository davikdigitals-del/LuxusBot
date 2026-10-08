import express from 'express';
import emailService from '../services/emailService.js';
import { authLimiters } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';

const router = express.Router();
const TOPICS = ['General questions and support', 'Enterprise and custom plans', 'Other'];

router.post('/', authLimiters.contact, async (req, res) => {
  const { name, email, topic, message, website } = req.body || {};

  if (typeof website === 'string' && website.trim()) {
    return res.json({ success: true, message: 'Your message has been sent.' });
  }
  if (
    typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.trim().length > 254 ||
    typeof topic !== 'string' || !TOPICS.includes(topic) ||
    typeof message !== 'string' || !message.trim() || message.trim().length > 5000
  ) {
    return res.status(400).json({ success: false, error: 'Enter a valid name, email, topic, and message (up to 5,000 characters).' });
  }

  try {
    await emailService.sendContactFormEmail({
      name: name.trim(),
      email: email.trim(),
      topic,
      message: message.trim(),
    });
    return res.json({ success: true, message: 'Your message has been sent.' });
  } catch (error) {
    logger.error('Contact form email failed:', error);
    return res.status(503).json({ success: false, error: 'We could not send your message right now. Please try again or email us directly.' });
  }
});

export default router;
