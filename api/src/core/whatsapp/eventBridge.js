import sessionRegistry from './SessionRegistry.js';
import handoffService from '../handoff/HandoffService.js';
import logger from '../../utils/logger.js';

/**
 * Wires SessionRegistry's raw Baileys events to the rest of the engine:
 *   - business sessions' incoming (non-self) messages -> MessageHandler
 *   - agent sessions' own "Message Yourself" messages -> HandoffService
 *
 * Call wireEventBridge(messageHandler) once at startup, after both
 * MessageHandler and SessionRegistry exist.
 */
export function wireEventBridge(messageHandler) {
  sessionRegistry.events.on('message', async (evt) => {
    try {
      if (evt.ownerType === 'business') {
        if (evt.remoteJid?.endsWith('@g.us')) return; // Exclude group chats from conversations and dashboard counts.
        if (evt.fromMe) return; // the assistant's own outgoing messages, not customer input
        await messageHandler.processMessage({
          from: evt.from,
          body: evt.text,
          type: 'text',
          contact: { number: evt.from, name: evt.pushName || '', isMyContact: false },
          businessId: evt.ownerId,
          messageKey: evt.messageKey,
        });
        return;
      }

      if (evt.ownerType === 'agent') {
        if (!evt.fromMe || !evt.isSelfChat) return; // only the agent's own "Message Yourself" thread counts as a reply
        if (sessionRegistry.consumeOwnSelfMessage(evt.ownerId, evt.text)) return; // our own relay/notice echoing back, not the agent typing
        await handoffService.handleAgentSelfMessage({ agentUserId: evt.ownerId, text: evt.text });
      }
    } catch (error) {
      logger.error(`Error handling WhatsApp event for ${evt.ownerType}:${evt.ownerId}:`, error);
    }
  });

  sessionRegistry.events.on('connected', ({ ownerType, ownerId, phoneNumber }) => {
    logger.info(`WhatsApp session connected: ${ownerType}:${ownerId} (${phoneNumber})`);
    if (ownerType === 'agent') {
      handoffService.dispatchQueuedConversations(ownerId).catch((error) => {
        logger.error(`Could not assign queued department conversations for agent ${ownerId}:`, error);
      });
    }
  });

  sessionRegistry.events.on('disconnected', ({ ownerType, ownerId, loggedOut }) => {
    logger.info(`WhatsApp session disconnected: ${ownerType}:${ownerId} (loggedOut=${loggedOut})`);
    if (ownerType === 'agent') {
      handoffService.requeueDisconnectedAgent(ownerId).catch((error) => {
        logger.error(`Could not requeue department conversations for agent ${ownerId}:`, error);
      });
    }
  });
}

export default wireEventBridge;
