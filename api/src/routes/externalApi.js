import express from 'express';
import { Conversation, Contact, KnowledgeBase } from '../models/index.js';
import { authenticateApiKey, requireApiKeyPermission } from '../middleware/auth.js';
import engineRegistry from '../core/tenant/EngineRegistry.js';
import logger from '../utils/logger.js';
import { dispatchBusinessWebhook } from '../services/webhookService.js';

const router = express.Router();
const OBJECT_ID = /^[a-f\d]{24}$/i;
const CATEGORIES = ['general', 'products', 'pricing', 'policies', 'faq', 'support', 'other'];

router.use(authenticateApiKey);

router.get('/conversations', requireApiKeyPermission('conversations:read'), async (req, res) => {
  try {
    const { status, handoff } = req.query;
    const query = { businessId: req.businessId };
    if (status && ['active', 'resolved', 'escalated', 'abandoned'].includes(status)) query.status = status;
    if (handoff && ['ai', 'human'].includes(handoff)) query.handoffMode = handoff;

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .select('-messages')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Conversation.countDocuments(query),
    ]);

    res.json({
      success: true,
      conversations: conversations.map((conversation) => ({
        id: conversation._id,
        phoneNumber: conversation.phoneNumber,
        status: conversation.status,
        handoffMode: conversation.handoffMode,
        assignedDepartment: conversation.assignedDepartment || '',
        intent: conversation.context?.intent,
        startedAt: conversation.startedAt,
        updatedAt: conversation.updatedAt,
      })),
      total,
      page,
      pageSize: limit,
    });
  } catch (error) {
    logger.error('External API conversation list failed:', error);
    res.status(500).json({ success: false, error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:conversationId', requireApiKeyPermission('conversations:read'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      businessId: req.businessId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const contact = await Contact.findOne({ _id: conversation.userId, businessId: req.businessId });
    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        phoneNumber: conversation.phoneNumber,
        contact: contact ? { name: contact.name, phoneNumber: contact.phoneNumber } : null,
        status: conversation.status,
        handoffMode: conversation.handoffMode,
        assignedDepartment: conversation.assignedDepartment || '',
        transferNote: conversation.transferNote,
        context: conversation.context,
        startedAt: conversation.startedAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    logger.error('External API conversation lookup failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

router.get('/conversations/:conversationId/messages', requireApiKeyPermission('messages:read'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      businessId: req.businessId,
    }).select('messages');
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    res.json({
      success: true,
      messages: conversation.messages.slice(-limit),
    });
  } catch (error) {
    logger.error('External API message list failed:', error);
    res.status(500).json({ success: false, error: 'Failed to list messages' });
  }
});

router.post('/conversations/:conversationId/messages', requireApiKeyPermission('messages:send'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.conversationId)) {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID' });
    }
    const { message } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
      return res.status(400).json({ success: false, error: 'message is required (max 4000 characters)' });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      businessId: req.businessId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.handoffMode !== 'human') {
      return res.status(409).json({ success: false, error: 'Transfer this conversation to a human first' });
    }

    const content = message.trim();
    const jid = `${conversation.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    try {
      const { default: sessionRegistry } = await import('../core/whatsapp/SessionRegistry.js');
      await sessionRegistry.sendMessage('business', req.businessId, jid, content);
    } catch (error) {
      if (error.message?.startsWith('No active WhatsApp session')) {
        return res.status(503).json({ success: false, error: 'The business WhatsApp session is unavailable' });
      }
      throw error;
    }

    conversation.addMessage('assistant', content, 'text', {
      sentBy: 'api',
      apiKeyId: req.apiKeyId,
    });
    await conversation.save();
    dispatchBusinessWebhook(req.businessId, 'message.sent', {
      conversationId: String(conversation._id),
      phoneNumber: conversation.phoneNumber,
      content,
      source: 'external-api',
    }).catch((error) => logger.error('External API message webhook dispatch failed:', error));

    res.status(201).json({ success: true, message: 'Message sent' });
  } catch (error) {
    logger.error('External API message send failed:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.get('/knowledge/search', requireApiKeyPermission('knowledge:read'), async (req, res) => {
  try {
    const { query } = req.query;
    if (typeof query !== 'string' || !query.trim() || query.length > 500) {
      return res.status(400).json({ success: false, error: 'query is required (max 500 characters)' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const results = await knowledgeBase.search(query.trim(), limit);
    res.json({ success: true, results });
  } catch (error) {
    logger.error('External API knowledge search failed:', error);
    res.status(500).json({ success: false, error: 'Failed to search knowledge base' });
  }
});

router.get('/knowledge', requireApiKeyPermission('knowledge:read'), async (req, res) => {
  try {
    const query = { businessId: req.businessId, status: 'published' };
    if (typeof req.query.category === 'string') query.category = req.query.category;
    const documents = await KnowledgeBase.find(query).sort({ createdAt: -1 }).limit(200);
    res.json({
      success: true,
      documents: documents.map((document) => ({
        id: document._id,
        title: document.title,
        category: document.category,
        subcategory: document.subcategory,
        tags: document.tags,
        createdAt: document.createdAt,
      })),
    });
  } catch (error) {
    logger.error('External API knowledge list failed:', error);
    res.status(500).json({ success: false, error: 'Failed to list knowledge base' });
  }
});

router.get('/knowledge/:documentId', requireApiKeyPermission('knowledge:read'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.documentId)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const document = await knowledgeBase.getDocument(req.params.documentId);
    if (!document || document.status !== 'published') {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, document });
  } catch (error) {
    logger.error('External API knowledge lookup failed:', error);
    res.status(500).json({ success: false, error: 'Failed to get document' });
  }
});

router.post('/knowledge', requireApiKeyPermission('knowledge:write'), async (req, res) => {
  try {
    const { title, content, category, subcategory, tags } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.length > 200) {
      return res.status(400).json({ success: false, error: 'title is required (max 200 characters)' });
    }
    if (typeof content !== 'string' || !content.trim() || content.length > 50000) {
      return res.status(400).json({ success: false, error: 'content is required (max 50,000 characters)' });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: `category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (subcategory !== undefined && (typeof subcategory !== 'string' || subcategory.length > 100)) {
      return res.status(400).json({ success: false, error: 'subcategory must be a string (max 100 characters)' });
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string') || tags.length > 20)) {
      return res.status(400).json({ success: false, error: 'tags must be an array of up to 20 strings' });
    }

    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const document = await knowledgeBase.addDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      subcategory: subcategory || '',
      tags: tags || [],
      source: { type: 'api' },
    });
    res.status(201).json({
      success: true,
      document: { id: document._id, title: document.title, category: document.category },
    });
  } catch (error) {
    logger.error('External API knowledge create failed:', error);
    res.status(500).json({ success: false, error: 'Failed to add document' });
  }
});

router.put('/knowledge/:documentId', requireApiKeyPermission('knowledge:write'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.documentId)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }
    const { title, content, category, subcategory, tags } = req.body || {};
    const updates = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim() || title.length > 200) {
        return res.status(400).json({ success: false, error: 'title must be 1-200 characters' });
      }
      updates.title = title.trim();
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim() || content.length > 50000) {
        return res.status(400).json({ success: false, error: 'content must be 1-50,000 characters' });
      }
      updates.content = content.trim();
    }
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, error: `category must be one of: ${CATEGORIES.join(', ')}` });
      }
      updates.category = category;
    }
    if (subcategory !== undefined) {
      if (typeof subcategory !== 'string' || subcategory.length > 100) {
        return res.status(400).json({ success: false, error: 'subcategory must be a string (max 100 characters)' });
      }
      updates.subcategory = subcategory;
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string') || tags.length > 20)) {
      return res.status(400).json({ success: false, error: 'tags must be an array of up to 20 strings' });
    }
    if (tags !== undefined) updates.tags = tags;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'At least one document field must be provided' });
    }

    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const document = await knowledgeBase.updateDocument(req.params.documentId, updates);
    res.json({
      success: true,
      document: { id: document._id, title: document.title, category: document.category },
    });
  } catch (error) {
    logger.error('External API knowledge update failed:', error);
    const status = error.message === 'Document not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: status === 404 ? error.message : 'Failed to update document',
    });
  }
});

export default router;
