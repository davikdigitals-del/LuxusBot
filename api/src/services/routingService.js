import { Business, Conversation, User } from '../models/index.js';
import sessionRegistry from '../core/whatsapp/SessionRegistry.js';
import handoffService from '../core/handoff/HandoffService.js';
import logger from '../utils/logger.js';
import { classifyMessage } from '../utils/routingRules.js';

const HANDLER_ROLES = ['owner', 'admin', 'agent'];
const DEFAULT_UNAVAILABLE_NOTICE = 'Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible.';

async function openChatCount(userId) {
  return Conversation.countDocuments({ assignedAgent: userId, handoffMode: 'human', status: { $ne: 'resolved' } });
}

async function leastLoaded(candidates) {
  const loads = await Promise.all(candidates.map(async (u) => ({ u, n: await openChatCount(u._id) })));
  loads.sort((a, b) => a.n - b.n);
  return loads[0].u;
}

/** Any online team member (owner/admin/agent) with the fewest open chats, else null. */
export async function pickAnyAgent(businessId) {
  const users = await User.find({ memberships: { $elemMatch: { businessId, status: 'active' } } });
  const candidates = users.filter((u) => {
    const m = u.memberships.find((x) => String(x.businessId) === String(businessId));
    return m && HANDLER_ROLES.includes(m.role) && sessionRegistry.isConnected('agent', u._id);
  });
  return candidates.length ? leastLoaded(candidates) : null;
}

/** Online member of the department with the fewest open chats, else the online fallback person, else null. */
export async function pickAgent(businessId, routing, department) {
  let candidates = [];
  if (department) {
    const users = await User.find({
      memberships: { $elemMatch: { businessId, status: 'active', departments: department } },
    });
    candidates = users.filter((u) => {
      const m = u.memberships.find((x) => String(x.businessId) === String(businessId));
      return m && HANDLER_ROLES.includes(m.role) && sessionRegistry.isConnected('agent', u._id);
    });
  }

  if (candidates.length === 0 && !department && routing?.fallbackAgentId) {
    const fb = await User.findById(routing.fallbackAgentId);
    const m = fb?.memberships.find((x) => String(x.businessId) === String(businessId) && x.status === 'active');
    if (fb && m && sessionRegistry.isConnected('agent', fb._id)) candidates = [fb];
  }
  if (candidates.length === 0) return null;

  return leastLoaded(candidates);
}

/**
 * Called for each customer message on an AI-handled conversation.
 * Returns { routed: false } or { routed: true, agentId, department, notice }.
 * Never throws - on any problem the AI simply keeps handling the chat.
 */
export async function routeIfNeeded({ businessId, conversation, text }) {
  try {
    if (!conversation || conversation.handoffMode === 'human') return { routed: false };
    const business = await Business.findById(businessId).select('routing');
    const routing = business?.routing;
    if (!routing?.enabled) return { routed: false };

    const match = classifyMessage(routing, text);
    if (!match) return { routed: false };

    const agent = await pickAgent(businessId, routing, match.department);
    if (!agent) {
      const notice = routing.customerUnavailableNotice?.trim() || DEFAULT_UNAVAILABLE_NOTICE;
      if (conversation && match.department) {
        await handoffService.queueConversationForDepartment({
          businessId,
          conversationId: conversation._id,
          department: match.department,
          transferredBy: null,
          note: `Waiting for an online teammate in ${match.department}`,
        });
      } else if (conversation) {
        conversation.status = 'escalated';
        conversation.transferNote = 'No online teammate available';
        await conversation.save();
      }
      logger.info(`Routing: no online agent for "${match.department || 'any'}" (${match.reason}); notifying customer`, { businessId: String(businessId) });
      return { routed: true, unavailable: true, agentId: null, department: match.department, notice };
    }

    await handoffService.transferConversation({
      businessId,
      conversationId: conversation._id,
      agentId: agent._id,
      transferredBy: null,
      note: `Auto-routed${match.department ? ` to ${match.department}` : ''} (${match.reason})`,
      department: match.department || '',
    });
    logger.info(`Routing: conversation ${conversation._id} -> agent ${agent._id} (${match.department || 'fallback'})`);
    return { routed: true, agentId: String(agent._id), department: match.department, notice: routing.customerNotice };
  } catch (error) {
    logger.error('Routing error (AI keeps the chat):', error);
    return { routed: false };
  }
}

export const AI_DOWN_HANDOFF_NOTICE = "Our automatic assistant is unavailable right now, so I've passed your chat to a team member. They'll reply here shortly.";
export const AI_DOWN_NO_AGENT_NOTICE = "Thanks for your message. Our automatic assistant is unavailable right now and our team has been notified. We'll reply here as soon as we can.";

/**
 * Used when the AI cannot answer (Anthropic credits/outage, plan quota used up).
 * Hands the chat to an online team member. If nobody is online the chat is still
 * flagged as escalated so it shows up in the dashboard, and the AI stays in charge
 * so it can pick the conversation up again as soon as it works.
 * Returns { handedOff, notice }. Never throws.
 */
export async function handOffBecauseAiDown({ businessId, conversation, reason }) {
  try {
    if (!conversation) return { handedOff: false, notice: AI_DOWN_NO_AGENT_NOTICE };

    const business = await Business.findById(businessId).select('routing');
    const department = business?.routing?.humanRequestDepartment;
    if (department) {
      const result = await handoffService.queueConversationForDepartment({
        businessId,
        conversationId: conversation._id,
        department,
        transferredBy: null,
        note: `AI unavailable (${reason}) - routed to ${department}`,
      });
      const notice = result.queued
        ? (business.routing.customerUnavailableNotice?.trim() || AI_DOWN_NO_AGENT_NOTICE)
        : AI_DOWN_HANDOFF_NOTICE;
      logger.warn(`AI down (${reason}): conversation ${conversation._id} routed to ${department}`, { businessId: String(businessId) });
      return { handedOff: !result.queued, queued: result.queued, notice, department };
    }

    const agent = await pickAnyAgent(businessId);
    if (agent) {
      await handoffService.transferConversation({
        businessId,
        conversationId: conversation._id,
        agentId: agent._id,
        transferredBy: null,
        note: `AI unavailable (${reason}) - passed to a live agent`,
      });
      logger.warn(`AI down (${reason}): conversation ${conversation._id} -> agent ${agent._id}`, { businessId: String(businessId) });
      return { handedOff: true, notice: AI_DOWN_HANDOFF_NOTICE };
    }

    conversation.status = 'escalated';
    conversation.transferNote = `AI unavailable (${reason}) - no team member online`;
    await conversation.save();
    logger.warn(`AI down (${reason}) and no agent online: conversation ${conversation._id} flagged`, { businessId: String(businessId) });
    return { handedOff: false, notice: AI_DOWN_NO_AGENT_NOTICE };
  } catch (error) {
    logger.error('AI failover error:', error);
    return { handedOff: false, notice: AI_DOWN_NO_AGENT_NOTICE };
  }
}

export { classifyMessage };
export default { classifyMessage, pickAgent, pickAnyAgent, routeIfNeeded, handOffBecauseAiDown };
