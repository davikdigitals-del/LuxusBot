import express from 'express';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import engineRegistry from '../core/tenant/EngineRegistry.js';
import logger from '../utils/logger.js';

// Mounted under /api/business (see app.js).
const router = express.Router();

const OBJECT_ID = /^[a-f\d]{24}$/i;
const CATEGORIES = ['general', 'products', 'pricing', 'policies', 'faq', 'support', 'other'];

/**
 * @route   GET /api/business/:id/knowledge
 * @desc    List this business's knowledge base documents, optionally by category
 * @access  Private (any role)
 */
router.get('/:id/knowledge', authenticate, requireBusiness, async (req, res) => {
  try {
    const { category } = req.query;
    const { KnowledgeBase: KnowledgeBaseModel } = await import('../models/index.js');

    const query = { businessId: req.businessId, status: 'published' };
    if (category) query.category = category;

    const docs = await KnowledgeBaseModel.find(query).sort({ createdAt: -1 }).limit(200);

    res.json({
      success: true,
      documents: docs.map((d) => ({
        id: d._id,
        title: d.title,
        category: d.category,
        subcategory: d.subcategory,
        tags: d.tags,
        usageCount: d.usageCount,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error listing knowledge base:', error);
    res.status(500).json({ success: false, error: 'Failed to list knowledge base' });
  }
});

/**
 * @route   GET /api/business/:id/knowledge/categories
 * @access  Private (any role)
 */
router.get('/:id/knowledge/categories', authenticate, requireBusiness, async (req, res) => {
  try {
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const categories = await knowledgeBase.getCategories();
    res.json({ success: true, categories, availableCategories: CATEGORIES });
  } catch (error) {
    logger.error('Error listing knowledge base categories:', error);
    res.status(500).json({ success: false, error: 'Failed to list categories' });
  }
});

/**
 * @route   GET /api/business/:id/knowledge/:docId
 * @access  Private (any role)
 */
router.get('/:id/knowledge/:docId', authenticate, requireBusiness, async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.docId)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const doc = await knowledgeBase.getDocument(req.params.docId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, document: doc });
  } catch (error) {
    logger.error('Error getting knowledge base document:', error);
    res.status(500).json({ success: false, error: 'Failed to get document' });
  }
});

/**
 * @route   POST /api/business/:id/knowledge
 * @desc    Add a document (plain text - file upload comes later via the pdf/docx skill path)
 * @access  Private (agent, admin, owner)
 */
router.post('/:id/knowledge', authenticate, requireBusiness, requireRole('agent', 'admin', 'owner'), async (req, res) => {
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
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string') || tags.length > 20)) {
      return res.status(400).json({ success: false, error: 'tags must be an array of up to 20 strings' });
    }

    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const doc = await knowledgeBase.addDocument({
      title: title.trim(),
      content: content.trim(),
      category,
      subcategory: subcategory || '',
      tags: tags || [],
      source: { type: 'manual' },
    });

    res.status(201).json({ success: true, document: { id: doc._id, title: doc.title, category: doc.category } });
  } catch (error) {
    logger.error('Error adding knowledge base document:', error);
    res.status(500).json({ success: false, error: 'Failed to add document' });
  }
});

/**
 * @route   PUT /api/business/:id/knowledge/:docId
 * @access  Private (agent, admin, owner)
 */
router.put('/:id/knowledge/:docId', authenticate, requireBusiness, requireRole('agent', 'admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.docId)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }

    const { title, content, category, subcategory, tags, status } = req.body || {};
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
    if (subcategory !== undefined) updates.subcategory = String(subcategory).slice(0, 100);
    if (tags !== undefined) {
      if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string') || tags.length > 20) {
        return res.status(400).json({ success: false, error: 'tags must be an array of up to 20 strings' });
      }
      updates.tags = tags;
    }
    if (status !== undefined) {
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, error: 'status must be draft, published, or archived' });
      }
      updates.status = status;
    }

    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const doc = await knowledgeBase.updateDocument(req.params.docId, updates);
    res.json({ success: true, document: { id: doc._id, title: doc.title, category: doc.category, status: doc.status } });
  } catch (error) {
    logger.error('Error updating knowledge base document:', error);
    const status = error.message === 'Document not found' ? 404 : 500;
    res.status(status).json({ success: false, error: status === 404 ? error.message : 'Failed to update document' });
  }
});

/**
 * @route   DELETE /api/business/:id/knowledge/:docId
 * @access  Private (admin, owner)
 */
router.delete('/:id/knowledge/:docId', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    if (!OBJECT_ID.test(req.params.docId)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    await knowledgeBase.deleteDocument(req.params.docId);
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    logger.error('Error deleting knowledge base document:', error);
    const status = error.message === 'Document not found' ? 404 : 500;
    res.status(status).json({ success: false, error: status === 404 ? error.message : 'Failed to delete document' });
  }
});

/**
 * @route   POST /api/business/:id/knowledge/search
 * @desc    Test what the assistant would retrieve for a given query
 * @access  Private (any role)
 */
router.post('/:id/knowledge/search', authenticate, requireBusiness, async (req, res) => {
  try {
    const { query, limit } = req.body || {};
    if (typeof query !== 'string' || !query.trim() || query.length > 500) {
      return res.status(400).json({ success: false, error: 'query is required (max 500 characters)' });
    }
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const results = await knowledgeBase.search(query.trim(), Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20));
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error searching knowledge base:', error);
    res.status(500).json({ success: false, error: 'Failed to search knowledge base' });
  }
});

export default router;
