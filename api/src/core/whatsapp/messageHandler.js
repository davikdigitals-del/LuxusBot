import logger from '../../utils/logger.js';
import { conversationLogger } from '../../utils/logger.js';
import { sanitizeInput, parseIntent, sleep } from '../../utils/helpers.js';
import config from '../../config/index.js';
import engineRegistry from '../tenant/EngineRegistry.js';
import handoffService from '../handoff/HandoffService.js';
import sessionRegistry from './SessionRegistry.js';
import { Conversation } from '../../models/index.js';
import { dispatchBusinessWebhook } from '../../services/webhookService.js';
import { routeIfNeeded, handOffBecauseAiDown } from '../../services/routingService.js';
import { consumeAiMessage, recordAiCost, refundAiMessage } from '../../services/usageService.js';

/** Bare phone number -> WhatsApp individual-chat JID. Idempotent (already-a-JID passes through). */
const toJid = (number) => (String(number).includes('@') ? number : `${String(number).replace(/\D/g, '')}@s.whatsapp.net`);

class MessageHandler {
  /**
   * @param {object} whatsappClient - the session this handler sends replies through
   * @param {object} memoryManager - tenant-scoped SessionManager instance
   * @param {object} moduleRouter
   *
   * Unlike the single-tenant version, aiEngine is NOT fixed at construction:
   * each message resolves its own tenant's AIEngine + KnowledgeBase via
   * EngineRegistry, keyed by messageData.businessId. That id must be attached
   * to every incoming message by whatever routes it here (the per-business
   * session registry that replaces the legacy single-tenant WhatsApp client).
   */
  constructor(memoryManager, moduleRouter) {
    this.memoryManager = memoryManager;
    this.moduleRouter = moduleRouter;
    this.processingQueue = new Map();
    // Messages that arrive while a reply is still being prepared (replies take ~20s now)
    this.pendingMessages = new Map();
  }

  /**
   * Process incoming message
   */
  async processMessage(messageData) {
    const { from, body, type, contact, businessId } = messageData;

    if (!businessId) {
      logger.error('processMessage called without businessId - message dropped', { from });
      return;
    }

    // Queue key includes businessId: two different businesses' contacts
    // sharing a phone number (rare, but the Contact model allows it) must
    // not block each other.
    const queueKey = `${businessId}:${from}`;
    // Hoisted so the catch block below can pass it to sendErrorResponse even
    // if the failure happens after the engine is resolved.
    let tenantContext = null;
    let aiEngine = null;

    try {
      // Check if already processing a message from this user
      if (this.processingQueue.has(queueKey)) {
        // Replies are deliberately slow, so customers often send several messages in a row.
        // Keep them and answer them together once the current reply has gone out.
        logger.debug(`Already processing message from ${from} (business ${businessId}), buffering...`);
        const pending = this.pendingMessages.get(queueKey) || [];
        if (pending.length < 10) pending.push(messageData);
        this.pendingMessages.set(queueKey, pending);
        return;
      }

      this.processingQueue.set(queueKey, true);

      // Log conversation
      conversationLogger.info('Incoming message', {
        from: contact.number,
        name: contact.name,
        message: body,
        type,
        timestamp: new Date().toISOString(),
      });

      // Blue ticks straight away (like a person opening the chat); the reply follows after a human-like pause
      sessionRegistry.markRead('business', businessId, messageData.messageKey).catch(() => {});

      // Handle different message types
      let processedMessage = body;
      let messageType = 'text';

      if (type === 'image' && messageData.media) {
        processedMessage = await this.handleImageMessage(messageData);
        messageType = 'image';
      } else if (type === 'document' && messageData.media) {
        processedMessage = await this.handleDocumentMessage(messageData);
        messageType = 'document';
      } else if (type === 'ptt' || type === 'audio') {
        processedMessage = await this.handleVoiceMessage(messageData);
        messageType = 'voice';
      } else if (type !== 'text' && type !== 'chat') {
        // Unsupported message type
        await this.sendResponse(businessId, from, contact.name,
          "I can currently handle text, images, and documents. Please send your message in one of these formats.");
        return;
      }

      // Sanitize input
      processedMessage = sanitizeInput(processedMessage);

      if (!processedMessage || processedMessage.trim().length === 0) {
        await this.sendResponse(businessId, from, contact.name,
          "I didn't receive any message. Please try again.");
        return;
      }

      // Get or create session
      const session = await this.memoryManager.getOrCreateSession(businessId, contact.number, {
        name: contact.name,
        isMyContact: contact.isMyContact,
      });

      // Add message to conversation history
      await this.memoryManager.addMessage(session.sessionId, 'user', processedMessage, messageType);
      await dispatchBusinessWebhook(businessId, 'message.received', { phoneNumber: contact.number, name: contact.name, content: processedMessage, messageType }).catch(() => {});

      // Persist the inbound message before resolving tenant AI resources. A
      // provider or knowledge-base setup failure must not hide received chats.
      try {
        const engine = await engineRegistry.getForBusiness(businessId);
        // knowledgeBase is already wired into aiEngine for RAG search.
        aiEngine = engine.aiEngine;
        tenantContext = engine.tenantContext;
      } catch (error) {
        logger.error(`Could not resolve engine for business ${businessId}:`, error.message);
      }

      // If this conversation has been handed off to a human agent, relay to
      // their WhatsApp instead of generating an AI reply. Falls through to
      // the normal AI path if the agent's session turns out to be offline.
      const activeConversation = await Conversation.findOne({ sessionId: session.sessionId, status: { $ne: 'resolved' } });
      const wasRelayed = await handoffService.relayCustomerMessageIfHandedOff({
        businessId,
        conversation: activeConversation,
        fromName: contact.name || contact.number,
        text: processedMessage,
      });
      if (wasRelayed) {
        return; // finally block below still clears queueKey
      }

      // Auto-route to the right team member (keyword rules / "I want a human").
      // If nobody suitable is online this does nothing and the AI answers as usual.
      const routing = await routeIfNeeded({ businessId, conversation: activeConversation, text: processedMessage });
      if (routing.routed) {
        if (routing.notice) {
          await this.memoryManager.addMessage(session.sessionId, 'assistant', routing.notice);
          await this.sendResponse(businessId, from, contact.name, routing.notice);
        }
        return;
      }

      // Parse intent
      const intent = parseIntent(processedMessage);
      await this.memoryManager.updateContext(session.sessionId, { intent });

      // Check for special commands
      if (await this.handleSpecialCommands(businessId, from, contact.name, processedMessage, session, tenantContext)) {
        return;
      }

      if (!aiEngine) return;

      // Route to appropriate module
      const module = await this.moduleRouter.route(processedMessage, session);
      logger.info(`Routing to module: ${module}`);

      // Get context and conversation history
      const context = await this.memoryManager.getContext(session.sessionId);
      const conversationHistory = await this.memoryManager.getConversationHistory(session.sessionId);

      // If the AI can't answer, pass the chat to a live agent instead of leaving the customer hanging
      const failOver = async (reason) => {
        const result = await handOffBecauseAiDown({ businessId, conversation: activeConversation, reason });
        await this.memoryManager.addMessage(session.sessionId, 'assistant', result.notice);
        await this.sendResponse(businessId, from, contact.name, result.notice);
      };

      // Plan quota: each AI reply is counted; when it's used up the AI is not called (no cost incurred)
      const quota = await consumeAiMessage(businessId, { graceDays: config.billing.graceDays });
      if (!quota.allowed) {
        logger.warn('No active plan or AI budget used up - passing to a live agent', { businessId: String(businessId) });
        await failOver('plan inactive or AI budget reached');
        return;
      }

      // Typing indicator for the whole wait; the reply goes out ~20s after the question
      // (AI time counts towards that wait) so the number behaves like a person, not a bot.
      const aiResponse = await this.withHumanDelay(businessId, from, () => aiEngine.generateResponse({
        message: processedMessage,
        context,
        history: conversationHistory,
        module,
        user: {
          name: contact.name,
          phone: contact.number,
        },
      }));

      // The engine returns provider 'fallback' when Anthropic failed (no credits, outage, bad key...)
      if (aiResponse.provider === 'fallback') {
        await refundAiMessage(businessId).catch(() => {});
        await failOver('AI provider error');
        return;
      }

      // Add this reply's real cost (from Anthropic's token counts) to the month's AI spend
      await recordAiCost(businessId, aiResponse.cost).catch((err) => logger.error('Could not record AI cost:', err));

      // Add AI response to conversation history
      await this.memoryManager.addMessage(session.sessionId, 'assistant', aiResponse.text);
      await dispatchBusinessWebhook(businessId, 'message.sent', { phoneNumber: contact.number, content: aiResponse.text, messageType: 'text', source: 'ai' }).catch(() => {});

      // The human-like wait already happened above
      await this.sendResponse(businessId, from, contact.name, aiResponse.text, { delayMs: 0 });

      // Update session last activity
      await this.memoryManager.updateSessionActivity(session.sessionId);

      // Log conversation
      conversationLogger.info('Outgoing message', {
        to: contact.number,
        name: contact.name,
        message: aiResponse.text,
        module,
        intent,
        timestamp: new Date().toISOString(),
      });

      // Execute any follow-up actions
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        await this.executeActions(businessId, from, aiResponse.actions, session);
      }

    } catch (error) {
      logger.error('Error processing message:', error);
      await this.sendErrorResponse(businessId, from, contact.name, tenantContext);
    } finally {
      this.processingQueue.delete(queueKey);
      this.processBuffered(queueKey);
    }
  }

  /** Answer messages that arrived during the previous reply as one combined message. */
  processBuffered(queueKey) {
    const pending = this.pendingMessages.get(queueKey);
    if (!pending?.length) return;
    this.pendingMessages.delete(queueKey);
    const merged = {
      ...pending[pending.length - 1],
      type: 'text',
      body: pending.map((m) => m.body).filter(Boolean).join('\n'),
    };
    this.processMessage(merged).catch((error) => logger.error('Error processing buffered messages:', error));
  }

  /**
   * Runs `work` (e.g. the AI call) while showing "typing..." and makes sure at least
   * ~config.assistant.responseDelay ms (+/-15%, so it is never the same twice) pass before returning.
   * Typing is shown for the whole time and cleared afterwards, even if `work` fails.
   */
  async withHumanDelay(businessId, to, work, base = config.assistant.responseDelay) {
    if (!(base > 0)) return work();

    const total = Math.round(base * (0.85 + Math.random() * 0.3));
    const startedAt = Date.now();
    const jid = toJid(to);
    const typing = async () => sessionRegistry.sendPresence('business', businessId, jid, 'composing').catch(() => {});

    await typing();
    // WhatsApp hides "typing..." after a few seconds, so keep renewing it
    const timer = setInterval(typing, 7000);
    try {
      const result = await work();
      const remaining = total - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      return result;
    } finally {
      clearInterval(timer);
      sessionRegistry.sendPresence('business', businessId, jid, 'paused').catch(() => {});
    }
  }

  /**
   * Handle image messages
   */
  async handleImageMessage(messageData) {
    if (!config.features.imageAnalysis) {
      return "I received your image, but image analysis is currently disabled. Please describe what you need help with.";
    }

    try {
      // Future: Implement image analysis using GPT-4 Vision or similar
      const caption = messageData.body || '';
      return `[Image received] ${caption}. I can see you sent an image. How can I help you with it?`;
    } catch (error) {
      logger.error('Error handling image:', error);
      return "I received your image but couldn't process it. Please try again or describe what you need.";
    }
  }

  /**
   * Handle document messages
   */
  async handleDocumentMessage(messageData) {
    if (!config.features.documentProcessing) {
      return "I received your document, but document processing is currently disabled.";
    }

    try {
      const filename = messageData.media?.filename || 'document';
      return `[Document received: ${filename}] I received your document. How can I help you with it?`;
    } catch (error) {
      logger.error('Error handling document:', error);
      return "I received your document but couldn't process it. Please try again.";
    }
  }

  /**
   * Handle voice messages
   */
  async handleVoiceMessage(messageData) {
    if (!config.features.voiceMessages) {
      return "I received your voice message, but voice processing is currently disabled. Please send a text message.";
    }

    try {
      // Future: Implement voice-to-text using Whisper or similar
      return "I received your voice message. Voice processing will be available soon. Please send a text message for now.";
    } catch (error) {
      logger.error('Error handling voice message:', error);
      return "I received your voice message but couldn't process it. Please send a text message instead.";
    }
  }

  /**
   * Handle special commands
   */
  async handleSpecialCommands(businessId, from, name, message, session, tenantContext) {
    const lowerMessage = message.toLowerCase().trim();

    // Help command
    if (lowerMessage === '/help' || lowerMessage === 'help') {
      const helpMessage = this.getHelpMessage(tenantContext);
      await this.memoryManager.addMessage(session.sessionId, 'assistant', helpMessage);
      await this.sendResponse(businessId, from, name, helpMessage);
      return true;
    }

    // Reset command
    if (lowerMessage === '/reset' || lowerMessage === 'reset conversation') {
      await this.memoryManager.clearSession(session.sessionId);
      const resetMessage = "Conversation reset! Let's start fresh. How can I help you today?";
      await this.memoryManager.addMessage(session.sessionId, 'assistant', resetMessage);
      await this.sendResponse(businessId, from, name, resetMessage);
      return true;
    }

    // Status command
    if (lowerMessage === '/status') {
      const status = await this.getStatusMessage(session);
      await this.memoryManager.addMessage(session.sessionId, 'assistant', status);
      await this.sendResponse(businessId, from, name, status);
      return true;
    }

    // Feedback command
    if (lowerMessage.startsWith('/feedback') || lowerMessage.startsWith('feedback:')) {
      const feedback = message.substring(message.indexOf(':') + 1).trim();
      await this.handleFeedback(session, feedback);
      const reply = "Thank you for your feedback! We appreciate your input.";
      await this.memoryManager.addMessage(session.sessionId, 'assistant', reply);
      await this.sendResponse(businessId, from, name, reply);
      return true;
    }

    return false;
  }

  /**
   * Get help message
   */
  getHelpMessage(tenantContext) {
    const companyName = tenantContext ? tenantContext.companyInfo.name : config.company.name;
    return `👋 *Welcome to ${companyName} Assistant!*

I'm here to help you with:
🛒 Product information and purchases
📦 Order tracking and delivery
📅 Appointment scheduling
💬 Customer support
👥 HR inquiries (for employees)

*Commands:*
• /help - Show this help message
• /reset - Start a new conversation
• /status - Check conversation status
• /feedback: [your feedback] - Send feedback

Just send me a message and I'll assist you! 😊`;
  }

  /**
   * Get status message
   */
  async getStatusMessage(session) {
    const context = await this.memoryManager.getContext(session.sessionId);
    const messageCount = context.messageCount || 0;

    return `📊 *Conversation Status*

Messages: ${messageCount}
Intent: ${context.intent || 'general'}
Session: Active
Duration: ${this.getSessionDuration(session)}

Type /help for available commands.`;
  }

  /**
   * Get session duration
   */
  getSessionDuration(session) {
    const startTime = session.startedAt || new Date();
    const duration = Date.now() - startTime.getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  /**
   * Handle feedback
   */
  async handleFeedback(session, feedback) {
    logger.info('User feedback received:', {
      sessionId: session.sessionId,
      feedback,
    });
    // Future: Store feedback in database
  }

  /**
   * Send response with typing simulation
   */
  async sendResponse(businessId, to, name, message, { delayMs } = {}) {
    try {
      // Default: the same human-like "typing..." pause as AI replies. Callers that already
      // waited (the AI path) pass delayMs: 0.
      const wait = delayMs === undefined ? config.assistant.responseDelay : delayMs;
      if (wait > 0) await this.withHumanDelay(businessId, to, async () => {}, wait);
      await sessionRegistry.sendMessage('business', businessId, toJid(to), message);
    } catch (error) {
      logger.error('Error sending response:', error);
      throw error;
    }
  }

  /**
   * Send error response
   */
  async sendErrorResponse(businessId, from, name, tenantContext) {
    const supportEmail = tenantContext ? tenantContext.companyInfo.email : config.company.email;
    const errorMessage = supportEmail
      ? `Sorry, I encountered an error while processing your message. Please try again or contact support at ${supportEmail}.`
      : 'Sorry, I encountered an error while processing your message. Please try again.';
    try {
      await sessionRegistry.sendMessage('business', businessId, toJid(from), errorMessage);
      const phoneNumber = String(from).replace(/\D/g, '');
      const conversation = await Conversation.findOne({
        businessId,
        phoneNumber,
        status: 'active',
      });
      if (conversation) {
        conversation.addMessage('assistant', errorMessage);
        await conversation.save();
      }
    } catch (error) {
      logger.error('Error sending error response:', error);
    }
  }

  /**
   * Execute follow-up actions
   */
  async executeActions(businessId, from, actions, session) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_message':
            await sleep(1000);
            await this.sendResponse(businessId, from, session.userName, action.message, { delayMs: 4000 });
            break;
          case 'send_media':
            // TODO: media relay (sock.sendMessage(jid, { image: { url }, caption }))
            // isn't wired through SessionRegistry yet - log rather than
            // silently drop or crash on the removed whatsapp-web.js call.
            logger.warn('send_media action requested but media relay is not yet implemented', { businessId, media: action.media });
            break;
          case 'create_ticket':
            // Future: Create support ticket
            logger.info('Creating ticket:', action);
            break;
          case 'schedule_appointment':
            // Future: Schedule appointment
            logger.info('Scheduling appointment:', action);
            break;
          default:
            logger.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        logger.error('Error executing action:', error);
      }
    }
  }
}

export default MessageHandler;
