import { Conversation, User, Business, Contact } from '../../models/index.js';
import sessionRegistry from '../whatsapp/SessionRegistry.js';
import logger from '../../utils/logger.js';
import { dispatchBusinessWebhook } from '../../services/webhookService.js';

const END_COMMANDS = ['/end', '/resolve', '/close'];
const departmentDispatches = new Set();

/**
 * Moves a conversation between AI-handled and human-handled, and relays
 * messages in both directions once an agent takes over:
 *
 *   customer -> business WhatsApp session -> (handoffMode === 'human') ->
 *   agent's own "Message Yourself" WhatsApp thread -> agent types a reply
 *   there -> relayed back out through the business session -> customer.
 *
 * The dashboard can also send/receive on a human-assigned conversation
 * (not wired here - that's a normal authenticated route, see conversations.js);
 * this service only owns the WhatsApp-side relay.
 */
class HandoffService {
  /**
   * Hand a conversation to a specific team member. Requires that member to
   * already be an active member of the business (role check is the route's
   * job, same as every other business.:id sub-resource).
   */
  async transferConversation({ businessId, conversationId, agentId, transferredBy, note = '', department = '', queuedDepartment = '' }) {
    const agent = await User.findById(agentId);
    const isMember = agent?.memberships?.some(
      (m) => String(m.businessId) === String(businessId) && m.status === 'active'
    );
    if (!agent || !isMember) {
      throw new Error('That person is not an active member of this business');
    }

    let conversation;
    if (queuedDepartment) {
      conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          businessId,
          handoffMode: 'human',
          assignedAgent: null,
          assignedDepartment: queuedDepartment,
          status: { $ne: 'resolved' },
        },
        {
          $set: {
            assignedAgent: agentId,
            transferredBy: transferredBy || null,
            transferredAt: new Date(),
            transferNote: note,
            status: 'escalated',
          },
        },
        { new: true }
      );
      if (!conversation) return null;
    } else {
      conversation = await Conversation.findOne({ _id: conversationId, businessId });
      if (!conversation) throw new Error('Conversation not found');
      conversation.handoffMode = 'human';
      conversation.assignedAgent = agentId;
      conversation.assignedDepartment = department;
      conversation.transferredBy = transferredBy || null;
      conversation.transferredAt = new Date();
      conversation.transferNote = note;
      conversation.status = 'escalated';
      await conversation.save();
    }
    await dispatchBusinessWebhook(businessId, 'conversation.transferred', { conversationId: String(conversation._id), agentId: String(agentId), note }).catch(() => {});

    logger.info(`Conversation ${conversationId} transferred to agent ${agentId}`);

    await this.notifyAgentOfTransfer(conversation, agent, note);

    return conversation;
  }

  async queueConversationForDepartment({ businessId, conversationId, department, transferredBy, note = '' }) {
    const normalizedDepartment = String(department || '').trim().toLowerCase();
    if (!normalizedDepartment) throw new Error('A department is required');

    const conversation = await Conversation.findOne({ _id: conversationId, businessId });
    if (!conversation) throw new Error('Conversation not found');
    const business = await Business.findById(businessId);
    if (!business?.departments?.includes(normalizedDepartment)) {
      throw new Error('That department does not exist');
    }

    const agent = await (await import('../../services/routingService.js')).pickAgent(businessId, null, normalizedDepartment);
    if (agent) {
      const assigned = await this.transferConversation({
        businessId,
        conversationId,
        agentId: agent._id,
        transferredBy,
        note,
        department: normalizedDepartment,
      });
      return { conversation: assigned, queued: false, agent };
    }

    conversation.handoffMode = 'human';
    conversation.assignedAgent = null;
    conversation.assignedDepartment = normalizedDepartment;
    conversation.transferredBy = transferredBy || null;
    conversation.transferredAt = new Date();
    conversation.transferNote = note || `Waiting for an online teammate in ${normalizedDepartment}`;
    conversation.status = 'escalated';
    await conversation.save();
    await dispatchBusinessWebhook(businessId, 'conversation.transferred', {
      conversationId: String(conversation._id),
      department: normalizedDepartment,
      queued: true,
      note: conversation.transferNote,
    }).catch(() => {});
    const newlyOnline = await (await import('../../services/routingService.js')).pickAgent(businessId, null, normalizedDepartment);
    if (newlyOnline) {
      const assigned = await this.transferConversation({
        businessId,
        conversationId,
        agentId: newlyOnline._id,
        transferredBy,
        note,
        department: normalizedDepartment,
        queuedDepartment: normalizedDepartment,
      });
      if (assigned) return { conversation: assigned, queued: false, agent: newlyOnline };
      const current = await Conversation.findOne({ _id: conversationId, businessId });
      if (current?.assignedAgent) return { conversation: current, queued: false, agent: null };
    }
    return { conversation, queued: true, agent: null };
  }

  async dispatchQueuedConversations(agentUserId) {
    const agent = await User.findById(agentUserId);
    if (!agent) return;

    for (const membership of agent.memberships || []) {
      if (membership.status !== 'active' || !['agent', 'admin', 'owner'].includes(membership.role)) continue;
      for (const department of membership.departments || []) {
        const businessId = String(membership.businessId);
        const lockKey = `${businessId}:${department}`;
        if (departmentDispatches.has(lockKey)) continue;
        departmentDispatches.add(lockKey);
        try {
          const waiting = await Conversation.find({
            businessId: membership.businessId,
            handoffMode: 'human',
            assignedAgent: null,
            assignedDepartment: department,
            status: { $ne: 'resolved' },
          });
          waiting.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          for (const conversation of waiting) {
            const onlineAgent = await (await import('../../services/routingService.js')).pickAgent(
              membership.businessId,
              null,
              department
            );
            if (!onlineAgent) break;
            const assigned = await this.transferConversation({
              businessId: membership.businessId,
              conversationId: conversation._id,
              agentId: onlineAgent._id,
              transferredBy: null,
              note: `Queued conversation assigned when ${department} became available`,
              department,
              queuedDepartment: department,
            });
            if (!assigned) continue;
            await this.sendCustomerUpdate(
              assigned,
              `A member of our ${department} team is now available and will help you shortly.`
            );
          }
        } finally {
          departmentDispatches.delete(lockKey);
        }
      }
    }
  }

  async requeueDisconnectedAgent(agentUserId) {
    const assigned = await Conversation.find({
      assignedAgent: agentUserId,
      handoffMode: 'human',
      status: { $ne: 'resolved' },
    });
    const requeued = [];
    for (const conversation of assigned) {
      if (!conversation.assignedDepartment) continue;
      conversation.assignedAgent = null;
      conversation.status = 'escalated';
      conversation.transferNote = `Waiting for an online teammate in ${conversation.assignedDepartment}`;
      await conversation.save();
      requeued.push(conversation);
    }

    await this.dispatchQueuedConversations(agentUserId);
    for (const conversation of requeued) {
      const latest = await Conversation.findOne({ _id: conversation._id, businessId: conversation.businessId });
      if (latest?.assignedAgent) continue;
      const business = await Business.findById(conversation.businessId);
      const notice = business?.routing?.customerUnavailableNotice?.trim() ||
        'Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible.';
      await this.sendCustomerUpdate(latest || conversation, notice);
    }
  }

  async sendCustomerUpdate(conversation, text) {
    const jid = `${String(conversation.phoneNumber).replace(/\D/g, '')}@s.whatsapp.net`;
    await sessionRegistry.sendMessage('business', conversation.businessId, jid, text);
    conversation.addMessage('assistant', text, 'text', { sentBy: 'system', department: conversation.assignedDepartment });
    await conversation.save();
  }

  /**
   * Hand a conversation back to the AI. Either the agent (via /end in their
   * WhatsApp thread) or anyone with dashboard access can call this.
   */
  async returnToAI(conversation, { resolved = true } = {}) {
    conversation.handoffMode = 'ai';
    conversation.assignedAgent = null;
    conversation.assignedDepartment = '';
    conversation.status = resolved ? 'resolved' : 'active';
    if (resolved) {
      conversation.resolution = { ...(conversation.resolution || {}), resolved: true, resolvedAt: new Date() };
    }
    await conversation.save();
    await dispatchBusinessWebhook(conversation.businessId, resolved ? 'conversation.ended' : 'conversation.returned_to_ai', { conversationId: String(conversation._id), resolved }).catch(() => {});
    logger.info(`Conversation ${conversation._id} returned to AI`);
    return conversation;
  }

  /**
   * Tell the agent a conversation is now theirs. If their own WhatsApp is
   * linked and connected, this doubles as the first relayed message in
   * their "Message Yourself" thread; otherwise it's dashboard-only (no
   * WhatsApp notification goes out - there's nothing to send it from/to
   * without the agent's own session, and sending FROM the business number
   * TO the agent's personal number would put a stranger-looking message in
   * the agent's regular inbox instead of a clearly-labeled relay thread).
   */
  async notifyAgentOfTransfer(conversation, agent, note) {
    if (!sessionRegistry.isConnected('agent', agent._id)) {
      logger.info(`Agent ${agent._id} has no connected WhatsApp - dashboard-only handoff`);
      return false;
    }

    const contact = await Contact.findById(conversation.userId);
    const business = await Business.findById(conversation.businessId);
    const customerLabel = contact ? `${contact.name || 'Customer'} (${contact.phoneNumber})` : 'A customer';

    const recent = conversation.messages.slice(-6)
      .map((m) => `${m.role === 'user' ? customerLabel.split(' (')[0] : 'Bot'}: ${m.content}`)
      .join('\n');

    const text = [
      `🔔 *Conversation transferred to you* (${business?.name || 'Luxus'})`,
      `From: ${customerLabel}`,
      note ? `Note: ${note}` : null,
      '',
      recent ? `Recent messages:\n${recent}` : null,
      '',
      '↩️ Reply in *this* chat to respond to the customer.',
      'Type /transfer Teammate Name or /transfer department Department Name to pass this conversation on.',
      `Type ${END_COMMANDS[0]} when you're done to hand the conversation back to the AI.`,
    ].filter(Boolean).join('\n');

    try {
      await sessionRegistry.sendSelfMessage('agent', agent._id, text);
      return true;
    } catch (error) {
      logger.error(`Could not notify agent ${agent._id} on WhatsApp for conversation ${conversation._id}:`, error);
      conversation.transferNote = 'WhatsApp notification failed; review this assigned conversation in the dashboard';
      try {
        await conversation.save();
      } catch (saveError) {
        logger.error(`Could not record WhatsApp notification failure for conversation ${conversation._id}:`, saveError);
      }
      return false;
    }
  }

  /**
   * Called for every message that arrives on a customer-facing (business)
   * WhatsApp session. If that conversation is human-assigned, relay the
   * customer's message into the agent's own thread instead of the AI, and
   * report back whether it was consumed (caller should skip AI generation).
   */
  async relayCustomerMessageIfHandedOff({ businessId, conversation, fromName, text }) {
    if (!conversation || conversation.handoffMode !== 'human') {
      return false;
    }
    if (!conversation.assignedAgent) return Boolean(conversation.assignedDepartment);

    const agent = await User.findById(conversation.assignedAgent);
    if (!agent) return false;

    if (!sessionRegistry.isConnected('agent', agent._id)) {
      if (conversation.assignedDepartment) {
        conversation.assignedAgent = null;
        conversation.status = 'escalated';
        conversation.transferNote = `Waiting for an online teammate in ${conversation.assignedDepartment}`;
        await conversation.save();
        return true;
      }
      // Agent's phone is offline - fall back to AI rather than silently dropping the message
      logger.warn(`Agent ${agent._id} WhatsApp disconnected mid-handoff, returning conversation ${conversation._id} to AI`);
      await this.returnToAI(conversation, { resolved: false });
      return false;
    }

    try {
      await sessionRegistry.sendSelfMessage('agent', agent._id, `💬 ${fromName}: ${text}`);
    } catch (error) {
      logger.error(`Could not relay customer message to agent ${agent._id} for conversation ${conversation._id}:`, error);
      conversation.transferNote = 'WhatsApp notification failed; message remains available in the dashboard';
      try {
        await conversation.save();
      } catch (saveError) {
        logger.error(`Could not record failed WhatsApp relay for conversation ${conversation._id}:`, saveError);
      }
    }
    return true;
  }

  /**
   * Called for every self-chat message an agent's own WhatsApp session
   * sees (fromMe === true, sent to their own number). Finds that agent's
   * one active handed-off conversation and relays the text to the customer.
   *
   * With more than one conversation active for the same agent at once, the
   * agent must prefix a reply with the short id shown in the dashboard
   * (#<last 6 of conversationId>) to disambiguate - anything else is
   * treated as a note-to-self and ignored.
   */
  async handleAgentSelfMessage({ agentUserId, text }) {
    const trimmed = text.trim();

    if (END_COMMANDS.some((cmd) => trimmed.toLowerCase().startsWith(cmd))) {
      const active = await Conversation.find({ assignedAgent: agentUserId, handoffMode: 'human' });
      for (const conversation of active) {
        await this.returnToAI(conversation);
        await sessionRegistry.sendSelfMessage('agent', agentUserId, '✅ Conversation handed back to the AI.').catch(() => {});
      }
      return;
    }

    const active = await Conversation.find({ assignedAgent: agentUserId, handoffMode: 'human' });
    if (active.length === 0) return; // nothing to relay - agent is just noting something to themselves

    const transferMatch = trimmed.match(/^(?:#([a-f0-9]{6})\s+)?\/transfer(?:\s+(.+))?$/i);
    if (transferMatch) {
      let target = active[0];
      if (active.length > 1) {
        const conversationTag = transferMatch[1]?.toLowerCase();
        target = active.find((conversation) => String(conversation._id).endsWith(conversationTag || ''));
        if (!conversationTag || !target) {
          await sessionRegistry.sendSelfMessage(
            'agent',
            agentUserId,
            `Choose a conversation with #${String(active[0]._id).slice(-6)} /transfer Teammate Name.`
          ).catch(() => {});
          return;
        }
      }

      const teammateName = transferMatch[2]?.trim();
      if (!teammateName) {
        await sessionRegistry.sendSelfMessage('agent', agentUserId, 'Use /transfer Teammate Name or /transfer department Department Name.').catch(() => {});
        return;
      }

      const members = await User.find({ 'memberships.businessId': target.businessId, status: { $ne: 'deleted' } });
      const sender = members.find((member) => String(member._id) === String(agentUserId));
      const senderMembership = sender?.memberships?.find(
        (item) => String(item.businessId) === String(target.businessId) && item.status === 'active'
      );
      if (!senderMembership || !['agent', 'admin', 'owner'].includes(senderMembership.role)) {
        await sessionRegistry.sendSelfMessage('agent', agentUserId, 'You no longer have permission to transfer this conversation.').catch(() => {});
        return;
      }

      const departmentMatch = teammateName.match(/^department\s+(.+)$/i);
      if (departmentMatch) {
        const department = departmentMatch[1].trim().toLowerCase();
        const result = await this.queueConversationForDepartment({
          businessId: target.businessId,
          conversationId: target._id,
          department,
          transferredBy: agentUserId,
          note: `Transferred to ${department} department from WhatsApp`,
        });
        if (result.queued) {
          const business = await Business.findById(target.businessId);
          const notice = business?.routing?.customerUnavailableNotice?.trim() ||
            'Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible.';
          await this.sendCustomerUpdate(target, notice);
          await sessionRegistry.sendSelfMessage('agent', agentUserId, `✅ Conversation queued for the ${department} department. The customer has been notified.`).catch(() => {});
        } else {
          await this.sendCustomerUpdate(target, `I'm connecting you with our ${department} team. Someone will reply here shortly.`);
          await sessionRegistry.sendSelfMessage('agent', agentUserId, `✅ Conversation transferred to the ${department} department.`).catch(() => {});
        }
        return;
      }

      const normalizedName = teammateName.replace(/\s+/g, ' ').toLowerCase();
      const matches = members.filter((member) => {
        const membership = member.memberships?.find(
          (item) => String(item.businessId) === String(target.businessId) && item.status === 'active'
        );
        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim().replace(/\s+/g, ' ').toLowerCase();
        return membership && String(member._id) !== String(agentUserId) &&
          (fullName === normalizedName || member.email?.toLowerCase() === normalizedName);
      });

      if (matches.length !== 1) {
        const names = members
          .filter((member) => member.memberships?.some(
            (item) => String(item.businessId) === String(target.businessId) && item.status === 'active'
          ))
          .map((member) => `${member.firstName || ''} ${member.lastName || ''}`.trim())
          .filter(Boolean);
        const message = matches.length > 1
          ? 'That name matches more than one teammate. Use their email address with /transfer.'
          : `I couldn't find that active teammate. Available: ${names.join(', ') || 'none'}.`;
        await sessionRegistry.sendSelfMessage('agent', agentUserId, message).catch(() => {});
        return;
      }

      await this.transferConversation({
        businessId: target.businessId,
        conversationId: target._id,
        agentId: matches[0]._id,
        transferredBy: agentUserId,
      });
      await sessionRegistry.sendSelfMessage('agent', agentUserId, `✅ Conversation transferred to ${matches[0].firstName} ${matches[0].lastName}.`).catch(() => {});
      return;
    }

    let target = active[0];
    let reply = trimmed;

    const tagMatch = trimmed.match(/^#([a-f0-9]{6})\s+([\s\S]+)$/i);
    if (active.length > 1) {
      if (!tagMatch) {
        await sessionRegistry.sendSelfMessage(
          'agent',
          agentUserId,
          `You have ${active.length} active handoffs. Prefix your reply, e.g. "#${String(active[0]._id).slice(-6)} your message".`
        ).catch(() => {});
        return;
      }
      target = active.find((c) => String(c._id).endsWith(tagMatch[1].toLowerCase()));
      reply = tagMatch[2];
      if (!target) return;
    } else if (tagMatch) {
      reply = tagMatch[2];
    }

    const contact = await Contact.findById(target.userId);
    if (!contact) return;

    const customerJid = `${contact.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    await sessionRegistry.sendMessage('business', target.businessId, customerJid, reply);

    target.addMessage('assistant', reply, 'text', { sentBy: 'agent', agentId: String(agentUserId) });
    await target.save();
  }
}

export default new HandoffService();
export { HandoffService };
