import express from 'express';
import { authenticate, requireBusiness } from '../middleware/auth.js';
import { Conversation, Contact, Analytics } from '../models/index.js';
import logger from '../utils/logger.js';

const router = express.Router();
const PERIODS = { '7d': 7, '30d': 30, '90d': 90 };

function startDate(period) {
  const days = PERIODS[period] || 30;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1)); return d;
}

router.get('/:id/analytics/dashboard', authenticate, requireBusiness, async (req, res) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : '30d';
    const start = startDate(period);
    const businessId = req.businessId;
    const rows = await Conversation.aggregate([
      { $match: { businessId: req.businessId, startedAt: { $gte: start } } },
      { $project: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } }, status: 1, handoffMode: 1, messageCount: '$metrics.messageCount', duration: '$metrics.duration', responseTime: '$metrics.responseTime', satisfaction: '$resolution.satisfaction', intent: '$context.intent', module: '$assignedModule', messages: 1 } },
      { $group: { _id: '$day', conversations: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }, escalated: { $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] } }, messages: { $sum: '$messageCount' }, avgDuration: { $avg: '$duration' }, avgResponseTime: { $avg: '$responseTime' }, avgSatisfaction: { $avg: '$satisfaction' } } },
      { $sort: { _id: 1 } },
    ]);
    const [totals] = await Conversation.aggregate([
      { $match: { businessId: req.businessId, startedAt: { $gte: start } } },
      { $group: { _id: null, conversations: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }, escalated: { $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] } }, messages: { $sum: '$metrics.messageCount' }, avgResponseTime: { $avg: '$metrics.responseTime' }, avgDuration: { $avg: '$metrics.duration' }, avgSatisfaction: { $avg: '$resolution.satisfaction' } } },
    ]);
    const intents = await Conversation.aggregate([{ $match: { businessId, startedAt: { $gte: start } } }, { $group: { _id: '$context.intent', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]);
    const modules = await Conversation.aggregate([{ $match: { businessId, startedAt: { $gte: start } } }, { $group: { _id: '$assignedModule', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
    const newContacts = await Contact.countDocuments({ businessId, createdAt: { $gte: start } });
    const uniqueContacts = await Conversation.distinct('userId', { businessId, startedAt: { $gte: start } });
    res.json({ success: true, period, from: start, to: new Date(), totals: { ...(totals || { conversations: 0, resolved: 0, escalated: 0, messages: 0 }), resolutionRate: totals?.conversations ? (totals.resolved / totals.conversations) * 100 : 0, newContacts, uniqueContacts: uniqueContacts.length }, daily: rows, intents, modules });
  } catch (error) { logger.error('Analytics dashboard error:', error); res.status(500).json({ success: false, error: 'Failed to load analytics' }); }
});

router.get('/:id/analytics/export', authenticate, requireBusiness, async (req, res) => {
  try {
    const start = startDate(PERIODS[req.query.period] ? req.query.period : '30d');
    const rows = await Conversation.find({ businessId: req.businessId, startedAt: { $gte: start } }).select('startedAt phoneNumber status handoffMode assignedModule context.intent metrics.messageCount metrics.responseTime resolution.satisfaction').sort({ startedAt: 1 }).lean();
    const header = ['date','phoneNumber','status','handoffMode','module','intent','messages','responseTimeMs','satisfaction'];
    const csv = [header.join(','), ...rows.map((r) => [r.startedAt?.toISOString() || '', r.phoneNumber, r.status, r.handoffMode, r.assignedModule, r.context?.intent || '', r.metrics?.messageCount || 0, r.metrics?.responseTime || 0, r.resolution?.satisfaction || ''].map((v) => `"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');
    res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', `attachment; filename="luxus-analytics-${new Date().toISOString().slice(0,10)}.csv"`); res.send(csv);
  } catch (error) { logger.error('Analytics export error:', error); res.status(500).json({ success: false, error: 'Failed to export analytics' }); }
});

export default router;
