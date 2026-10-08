import express from 'express';
import { Conversation, Contact, User, Business } from '../models/index.js';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import handoffService from '../core/handoff/HandoffService.js';
import logger from '../utils/logger.js';
import { dispatchBusinessWebhook } from '../services/webhookService.js';

// Mounted under /api/business (see app.js).
const router = express.Router();

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * @route   GET /api/business/:id/conversations
 * @desc    List conversations, newest first. Filter with ?status= and ?handoff=
 * @access  Private (any role)
 */
router.get('/:id/conversations', authenticate, requireBusiness, async (req, res) => {
  try {
    const { status, handoff, limit = 50, page = 1 } = req.query;
    const query = { businessId: req.businessId };

    if (status && ['active', 'resolved', 'escalated', 'abandoned'].includes(status)) {
      query.status = status;
    }
    if (handoff && ['ai', 'human'].includes(handoff)) {
      query.handoffMode = handoff;
    }

    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .select('-messages') // list view: summary only, not the full transcript
        .sort({ updatedAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize),
      Conversation.countDocuments(query),
    ]);

    const contactIds = conversations.map((c) => c.userId).filter(Boolean);
    const contacts = await Contact.find({ _id: { $in: contactIds } });
    const contactById = new Map(contacts.map((c) => [String(c._id), c]));

    const agentIds = conversations.map((c) => c.assignedAgent).filter(Boolean);
    const agents = agentIds.length ? await User.find({ _id: { $in: agentIds } }) : [];
    const agentById = new Map(agents.map((a) => [String(a._id), a]));

    const list = conversations.map((c) => {
      const contact = contactById.get(String(c.userId));
      const agent = c.assignedAgent ? agentById.get(String(c.assignedAgent)) : null;
      return {
        id: c._id,
        phoneNumber: c.phoneNumber,
        contactName: contact?.name || '',
        status: c.status,
        handoffMode: c.handoffMode,
        assignedAgent: agent ? { id: agent._id, name: `${agent.firstName} ${agent.lastName}` } : null,
        assignedDepartment: c.assignedDepartment || '',
        intent: c.context?.intent,
        startedAt: c.startedAt,
        updatedAt: c.updatedAt,
      };
    });

    res.json({ success: true, conversations: list, total, page: pageNum, pageSize });
  } catch (error) {
    logger.error('Error listing conversations:', error);
    res.status(500).json({ success: false, error: 'Failed to list conversations' });
  }
});

/**
 * @route   GET /api/business/:id/conversations/:conversationId
 * @desc    Full transcript for one conversation
 * @access  Private (any role)
 */
router.get('/:id/conversations/:conversationId', authenticate, requireBusiness, async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.conversationId, businessId: req.businessId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const contact = await Contact.findById(conversation.userId);
    const agent = conversation.assignedAgent ? await User.findById(conversation.assignedAgent) : null;

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        phoneNumber: conversation.phoneNumber,
        contact: contact ? { name: contact.name, phoneNumber: contact.phoneNumber } : null,
        status: conversation.status,
        handoffMode: conversation.handoffMode,
        assignedAgent: agent ? { id: agent._id, name: `${agent.firstName} ${agent.lastName}` } : null,
        assignedDepartment: conversation.assignedDepartment || '',
        transferNote: conversation.transferNote,
        messages: conversation.messages,
        context: conversation.context,
        startedAt: conversation.startedAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error getting conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

/**
 * @route   POST /api/business/:id/conversations/:conversationId/transfer
 * @desc    Hand a conversation to a team member. If that agent has their own
 *          WhatsApp linked and connected, they're notified there; otherwise
 *          it's dashboard-only until they reply from the dashboard.
 * @access  Private (agent, admin, owner - an agent can transfer to a peer)
 */
router.post('/:id/conversations/:conversationId/transfer', authenticate, requireBusiness, requireRole('agent', 'admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const { agentId, department, note } = req.body || {};
    const hasAgent = typeof agentId === 'string' && OBJECT_ID.test(agentId);
    const normalizedDepartment = typeof department === 'string' ? department.trim().toLowerCase() : '';
    if ((agentId !== undefined && !hasAgent) || (hasAgent && normalizedDepartment) || (!hasAgent && !normalizedDepartment)) {
      return res.status(400).json({ success: false, error: 'Choose either a valid agentId or a department' });
    }
    if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
      return res.status(400).json({ success: false, error: 'note must be a string under 500 characters' });
    }

    let conversation;
    let queued = false;
    if (normalizedDepartment) {
      const result = await handoffService.queueConversationForDepartment({
        businessId: req.businessId,
        conversationId: req.params.conversationId,
        department: normalizedDepartment,
        transferredBy: req.userId,
        note: note || '',
      });
      conversation = result.conversation;
      queued = result.queued;
      const business = await Business.findById(req.businessId);
      const customerNotice = queued
        ? (business?.routing?.customerUnavailableNotice?.trim() || 'Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible.')
        : `I'm connecting you with our ${normalizedDepartment} team. Someone will reply here shortly.`;
      await handoffService.sendCustomerUpdate(conversation, customerNotice);
    } else {
      conversation = await handoffService.transferConversation({
        businessId: req.businessId,
        conversationId: req.params.conversationId,
        agentId,
        transferredBy: req.userId,
        note: note || '',
      });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        handoffMode: conversation.handoffMode,
        assignedAgent: conversation.assignedAgent,
        assignedDepartment: conversation.assignedDepartment || '',
        status: conversation.status,
        queued,
      },
    });
  } catch (error) {
    logger.error('Error transferring conversation:', error);
    const clientErrors = ['Conversation not found', 'That person is not an active member of this business', 'That department does not exist', 'A department is required'];
    const status = clientErrors.includes(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: status === 400 ? error.message : 'Failed to transfer conversation' });
  }
});

/**
 * @route   POST /api/business/:id/conversations/:conversationId/return-to-ai
 * @desc    Hand a human-assigned conversation back to the AI
 * @access  Private (agent, admin, owner)
 */
router.post('/:id/conversations/:conversationId/return-to-ai', authenticate, requireBusiness, requireRole('agent', 'admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.conversationId, businessId: req.businessId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    await handoffService.returnToAI(conversation, { resolved: false });
    res.json({ success: true, message: 'Conversation returned to AI' });
  } catch (error) {
    logger.error('Error returning conversation to AI:', error);
    res.status(500).json({ success: false, error: 'Failed to return conversation to AI' });
  }
});

/**
 * @route   POST /api/business/:id/conversations/:conversationId/reply
 * @desc    Dashboard-side reply for a human-assigned conversation (the
 *          non-WhatsApp path - an agent without a linked phone can still
 *          answer from here). Sends via the business's own WhatsApp session.
 * @access  Private (agent, admin, owner)
 */
router.post('/:id/conversations/:conversationId/reply', authenticate, requireBusiness, requireRole('agent', 'admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const { message } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return res.status(400).json({ success: false, error: 'message is required (max 4000 characters)' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.conversationId, businessId: req.businessId });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.handoffMode !== 'human') {
      return res.status(400).json({ success: false, error: 'Transfer this conversation to a human first' });
    }

    const { default: sessionRegistry } = await import('../core/whatsapp/SessionRegistry.js');
    const jid = `${conversation.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    await sessionRegistry.sendMessage('business', req.businessId, jid, message.trim());

    conversation.addMessage('assistant', message.trim(), 'text', { sentBy: 'agent', agentId: String(req.userId) });
    await conversation.save();
    await dispatchBusinessWebhook(req.businessId, 'message.sent', { conversationId: String(conversation._id), phoneNumber: conversation.phoneNumber, content: message.trim(), source: 'dashboard-agent' }).catch(() => {});

    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    logger.error('Error sending dashboard reply:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

export default router;
