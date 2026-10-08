import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { authenticate, requireBusiness, requireRole } from '../middleware/auth.js';
import engineRegistry from '../core/tenant/EngineRegistry.js';
import { Business } from '../models/index.js';
import logger from '../utils/logger.js';

const router = express.Router();
const allowed = new Set(['.txt','.md','.pdf','.docx','.json']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.post('/:id/knowledge/upload', authenticate, requireBusiness, requireRole('agent','admin','owner'), upload.single('file'), async (req, res) => {
  let tempPath;
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'file is required' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowed.has(ext)) return res.status(400).json({ success: false, error: 'Supported files: PDF, DOCX, TXT, MD, JSON' });

    const business = await Business.findById(req.businessId).select('limits usage');
    const limitBytes = (business?.limits?.maxKnowledgeBaseMB || 10) * 1024 * 1024;
    const currentBytes = (business?.usage?.knowledgeBaseSizeMB || 0) * 1024 * 1024;
    if (currentBytes + req.file.size > limitBytes) return res.status(413).json({ success: false, error: 'Knowledge base storage limit reached' });

    tempPath = path.join(os.tmpdir(), `luxus-${crypto.randomUUID()}${ext}`);
    await fs.writeFile(tempPath, req.file.buffer);
    const category = typeof req.body?.category === 'string' ? req.body.category : 'general';
    const tags = typeof req.body?.tags === 'string' ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0,20) : [];
    const { knowledgeBase } = await engineRegistry.getForBusiness(req.businessId);
    const doc = await knowledgeBase.addFromFile(tempPath, category, req.body?.subcategory || '', tags);
    await Business.findByIdAndUpdate(req.businessId, { $inc: { 'usage.knowledgeBaseSizeMB': req.file.size / (1024 * 1024) }, $set: { 'onboarding.steps.knowledgeBaseAdded': true } });
    res.status(201).json({ success: true, document: { id: doc._id, title: doc.title, category: doc.category, filename: req.file.originalname } });
  } catch (error) {
    logger.error('Knowledge upload error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to process upload' });
  } finally {
    if (tempPath) await fs.rm(tempPath, { force: true }).catch(() => {});
  }
});

export default router;
