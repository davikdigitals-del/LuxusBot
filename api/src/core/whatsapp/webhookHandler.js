import express from 'express';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

class WebhookHandler {
  constructor(messageHandler) {
    this.messageHandler = messageHandler;
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Setup webhook routes
   */
  setupRoutes() {
    // Webhook verification (for WhatsApp Business API)
    this.router.get('/webhook', this.verifyWebhook.bind(this));

    // Webhook for receiving messages
    this.router.post('/webhook', this.handleWebhook.bind(this));

    // Health check
    this.router.get('/health', this.healthCheck.bind(this));
  }

  /**
   * Verify webhook (WhatsApp Business API)
   */
  verifyWebhook(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token) {
        if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
          logger.info('Webhook verified successfully');
          res.status(200).send(challenge);
        } else {
          logger.warn('Webhook verification failed: Invalid token');
          res.sendStatus(403);
        }
      } else {
        logger.warn('Webhook verification failed: Missing parameters');
        res.sendStatus(400);
      }
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      res.sendStatus(500);
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(req, res) {
    try {
      const body = req.body;

      // Respond quickly to avoid timeout
      res.sendStatus(200);

      // Process webhook asynchronously
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (value?.messages) {
          for (const message of value.messages) {
            await this.processWebhookMessage(message, value);
          }
        }

        if (value?.statuses) {
          for (const status of value.statuses) {
            this.processMessageStatus(status);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
    }
  }

  /**
   * Process webhook message
   */
  async processWebhookMessage(message, value) {
    try {
      const phoneNumber = message.from;
      const contact = value.contacts?.[0];

      const messageData = {
        id: message.id,
        from: phoneNumber,
        timestamp: message.timestamp,
        type: message.type,
        body: '',
        contact: {
          name: contact?.profile?.name || 'Unknown',
          number: phoneNumber,
        },
      };

      // Extract message content based on type
      switch (message.type) {
        case 'text':
          messageData.body = message.text?.body || '';
          break;
        case 'image':
          messageData.media = {
            id: message.image?.id,
            caption: message.image?.caption || '',
          };
          messageData.body = message.image?.caption || '[Image]';
          break;
        case 'document':
          messageData.media = {
            id: message.document?.id,
            filename: message.document?.filename || 'document',
          };
          messageData.body = `[Document: ${message.document?.filename}]`;
          break;
        case 'audio':
          messageData.media = {
            id: message.audio?.id,
          };
          messageData.body = '[Voice message]';
          break;
        case 'video':
          messageData.media = {
            id: message.video?.id,
            caption: message.video?.caption || '',
          };
          messageData.body = message.video?.caption || '[Video]';
          break;
        case 'location':
          messageData.location = {
            latitude: message.location?.latitude,
            longitude: message.location?.longitude,
            name: message.location?.name,
            address: message.location?.address,
          };
          messageData.body = `[Location: ${message.location?.name || 'Shared location'}]`;
          break;
        default:
          logger.warn('Unsupported message type:', message.type);
          return;
      }

      // Process message
      await this.messageHandler.processMessage(messageData);
    } catch (error) {
      logger.error('Error processing webhook message:', error);
    }
  }

  /**
   * Process message status
   */
  processMessageStatus(status) {
    logger.debug('Message status update:', {
      id: status.id,
      status: status.status,
      timestamp: status.timestamp,
    });

    // Future: Update message delivery status in database
  }

  /**
   * Health check endpoint
   */
  healthCheck(req, res) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'WhatsApp Company Assistant',
      version: '1.0.0',
    });
  }

  /**
   * Get router
   */
  getRouter() {
    return this.router;
  }
}

export default WebhookHandler;
