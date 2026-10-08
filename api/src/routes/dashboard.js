import express from 'express';
import { Business, Conversation, KnowledgeBase, Contact, User } from '../models/index.js';
import { authenticate, requireBusiness } from '../middleware/auth.js';
import sessionRegistry from '../core/whatsapp/SessionRegistry.js';
import logger from '../utils/logger.js';

// Mounted under /api/business (see app.js).
const router = express.Router();

/**
 * @route   GET /api/business/:id/dashboard
 * @desc    Overview numbers for the dashboard home page. Conversation counts
 *          count individual-chat records by startedAt; message counts include
 *          incoming and outgoing messages in individual chats.
 * @access  Private (any role)
 */
router.get('/:id/dashboard', authenticate, requireBusiness, async (req, res) => {
  try {
    const businessId = req.businessId;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [messageCounts, conversationCounts] = await Promise.all([
      Conversation.aggregate([
        {
          $match: {
            businessId,
            phoneNumber: { $not: /@g\.us$/i },
            messages: {
              $elemMatch: {
                role: { $in: ['user', 'assistant'] },
                timestamp: { $gte: startOfMonth },
              },
            },
          },
        },
        { $unwind: '$messages' },
        {
          $match: {
            'messages.role': { $in: ['user', 'assistant'] },
            'messages.timestamp': { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            messagesThisMonth: { $sum: 1 },
            messagesToday: {
              $sum: { $cond: [{ $gte: ['$messages.timestamp', startOfToday] }, 1, 0] },
            },
          },
        },
      ]),
      Conversation.aggregate([
        {
          $match: {
            businessId,
            phoneNumber: { $not: /@g\.us$/i },
            startedAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            conversationsThisMonth: { $sum: 1 },
            conversationsToday: {
              $sum: { $cond: [{ $gte: ['$startedAt', startOfToday] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const [
      business,
      activeHandoffs,
      totalContacts,
      knowledgeDocCount,
      teamCount,
      whatsappStatus,
    ] = await Promise.all([
      Business.findById(businessId),
      Conversation.countDocuments({ businessId, handoffMode: 'human', status: { $ne: 'resolved' } }),
      Contact.countDocuments({ businessId }),
      KnowledgeBase.countDocuments({ businessId, status: 'published' }),
      User.countDocuments({ 'memberships.businessId': businessId, status: { $ne: 'deleted' } }),
      sessionRegistry.getStatus('business', businessId),
    ]);

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({
      success: true,
      overview: {
        plan: business.subscription?.plan || 'none',
        subscriptionStatus: business.subscription?.status || 'none',
        aiCostThisMonth: business.usage?.aiCostThisMonth || 0,
        aiBudgetUsd: business.limits?.aiBudgetUsd || 0,
        messagesUsed: business.usage?.messagesThisMonth || 0,
        messagesLimit: business.limits?.messagesPerMonth || 0,
        conversationsToday: conversationCounts[0]?.conversationsToday || 0,
        conversationsThisMonth: conversationCounts[0]?.conversationsThisMonth || 0,
        messagesToday: messageCounts[0]?.messagesToday || 0,
        messagesThisMonth: messageCounts[0]?.messagesThisMonth || 0,
        activeHandoffs,
        totalContacts,
        knowledgeDocCount,
        teamCount,
        teamLimit: business.limits?.maxTeamMembers || 0,
        whatsapp: { status: whatsappStatus.status, phoneNumber: whatsappStatus.phoneNumber },
      },
    });
  } catch (error) {
    logger.error('Error getting dashboard overview:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard overview' });
  }
});

/**
 * @route   GET /api/business/:id/dashboard/activity
 * @desc    Recent conversation activity, for a lightweight activity feed
 * @access  Private (any role)
 */
router.get('/:id/dashboard/activity', authenticate, requireBusiness, async (req, res) => {
  try {
    const recent = await Conversation.find({ businessId: req.businessId })
      .select('phoneNumber status handoffMode updatedAt context.intent')
      .sort({ updatedAt: -1 })
      .limit(10);

    const contactIds = recent.map((c) => c.userId).filter(Boolean);
    const contacts = await Contact.find({ _id: { $in: contactIds } });
    const contactById = new Map(contacts.map((c) => [String(c._id), c]));

    res.json({
      success: true,
      activity: recent.map((c) => ({
        id: c._id,
        contactName: contactById.get(String(c.userId))?.name || c.phoneNumber,
        status: c.status,
        handoffMode: c.handoffMode,
        intent: c.context?.intent,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error getting dashboard activity:', error);
    res.status(500).json({ success: false, error: 'Failed to get activity' });
  }
});

export default router;
