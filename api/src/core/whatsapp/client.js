import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';
import EventEmitter from 'events';

class WhatsAppClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.qrGenerated = false;
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize() {
    try {
      logger.info('Initializing WhatsApp client...');

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'company-assistant',
          dataPath: config.whatsapp.sessionPath,
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
          ],
        },
      });

      this.setupEventHandlers();
      await this.client.initialize();

      return true;
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client:', error);
      throw error;
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // QR Code generation
    this.client.on('qr', (qr) => {
      if (!this.qrGenerated) {
        logger.info('QR Code received. Please scan with WhatsApp:');
        qrcode.generate(qr, { small: true });
        this.qrGenerated = true;
        this.emit('qr', qr);
      }
    });

    // Authentication success
    this.client.on('authenticated', () => {
      logger.info('✅ WhatsApp authenticated successfully');
      this.emit('authenticated');
    });

    // Authentication failure
    this.client.on('auth_failure', (error) => {
      logger.error('❌ WhatsApp authentication failed:', error);
      this.emit('auth_failure', error);
    });

    // Client ready
    this.client.on('ready', () => {
      this.isReady = true;
      logger.info('✅ WhatsApp client is ready!');
      this.emit('ready');
    });

    // Incoming message
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        logger.error('Error handling incoming message:', error);
      }
    });

    // Message acknowledgement
    this.client.on('message_ack', (message, ack) => {
      this.emit('message_ack', { message, ack });
    });

    // Disconnected
    this.client.on('disconnected', (reason) => {
      this.isReady = false;
      logger.warn('WhatsApp client disconnected:', reason);
      this.emit('disconnected', reason);
    });

    // Loading screen
    this.client.on('loading_screen', (percent, message) => {
      logger.debug(`Loading: ${percent}% - ${message}`);
    });

    // Group join
    this.client.on('group_join', (notification) => {
      this.emit('group_join', notification);
    });

    // Change state
    this.client.on('change_state', (state) => {
      logger.debug('State changed:', state);
    });
  }

  /**
   * Handle incoming message
   */
  async handleIncomingMessage(message) {
    // Ignore status updates
    if (message.isStatus) return;

    // Ignore group messages (optional - can be configured)
    if (message.from.includes('@g.us')) {
      logger.debug('Ignoring group message');
      return;
    }

    const messageData = await this.parseMessage(message);
    this.emit('message', messageData);
  }

  /**
   * Parse WhatsApp message
   */
  async parseMessage(message) {
    const contact = await message.getContact();
    const chat = await message.getChat();

    const messageData = {
      id: message.id._serialized,
      from: message.from,
      to: message.to,
      body: message.body,
      timestamp: message.timestamp,
      type: message.type,
      hasMedia: message.hasMedia,
      isForwarded: message.isForwarded,
      contact: {
        id: contact.id._serialized,
        name: contact.name || contact.pushname || 'Unknown',
        number: contact.number,
        isMyContact: contact.isMyContact,
      },
      chat: {
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
      },
    };

    // Handle media
    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        messageData.media = {
          mimetype: media.mimetype,
          data: media.data,
          filename: media.filename,
        };
      } catch (error) {
        logger.error('Error downloading media:', error);
      }
    }

    // Handle quoted message
    if (message.hasQuotedMsg) {
      const quotedMsg = await message.getQuotedMessage();
      messageData.quotedMessage = {
        body: quotedMsg.body,
        from: quotedMsg.from,
      };
    }

    return messageData;
  }

  /**
   * Send text message
   */
  async sendMessage(to, text, options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      logger.info(`Sending message to ${to}`);

      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
      const message = await this.client.sendMessage(chatId, text, options);

      logger.info(`Message sent successfully to ${to}`);
      return message;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send message with typing simulation
   */
  async sendMessageWithTyping(to, text, options = {}) {
    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
    const chat = await this.client.getChatById(chatId);

    // Simulate typing
    await chat.sendStateTyping();

    // Calculate typing duration based on message length
    const typingDuration = Math.min(Math.max(text.length * 30, 1000), 3000);
    await new Promise(resolve => setTimeout(resolve, typingDuration));

    // Send message
    return await this.sendMessage(to, text, options);
  }

  /**
   * Send media message
   */
  async sendMedia(to, media, caption = '', options = {}) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;

      let messageMedia;
      if (typeof media === 'string') {
        // Media is a file path or URL
        messageMedia = await MessageMedia.fromFilePath(media);
      } else if (media instanceof MessageMedia) {
        messageMedia = media;
      } else {
        throw new Error('Invalid media format');
      }

      const message = await this.client.sendMessage(chatId, messageMedia, {
        caption,
        ...options,
      });

      logger.info(`Media sent successfully to ${to}`);
      return message;
    } catch (error) {
      logger.error('Error sending media:', error);
      throw error;
    }
  }

  /**
   * Send location
   */
  async sendLocation(to, latitude, longitude, description = '') {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready');
      }

      const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
      const location = new pkg.Location(latitude, longitude, description);

      const message = await this.client.sendMessage(chatId, location);
      logger.info(`Location sent successfully to ${to}`);
      return message;
    } catch (error) {
      logger.error('Error sending location:', error);
      throw error;
    }
  }

  /**
   * Send buttons (if supported)
   */
  async sendButtons(to, text, buttons) {
    try {
      const buttonMessage = {
        body: text,
        buttons: buttons.map((btn, index) => ({
          id: `btn_${index}`,
          body: btn,
        })),
      };

      return await this.sendMessage(to, text);
    } catch (error) {
      logger.error('Error sending buttons:', error);
      // Fallback to regular message with numbered options
      const fallbackText = `${text}\n\n${buttons.map((btn, i) => `${i + 1}. ${btn}`).join('\n')}`;
      return await this.sendMessage(to, fallbackText);
    }
  }

  /**
   * Mark chat as read
   */
  async markAsRead(chatId) {
    try {
      const chat = await this.client.getChatById(chatId);
      await chat.sendSeen();
    } catch (error) {
      logger.error('Error marking chat as read:', error);
    }
  }

  /**
   * Get contact by phone number
   */
  async getContact(phoneNumber) {
    try {
      const contactId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      const contact = await this.client.getContactById(contactId);
      return contact;
    } catch (error) {
      logger.error('Error getting contact:', error);
      return null;
    }
  }

  /**
   * Get chat by ID
   */
  async getChat(chatId) {
    try {
      const chat = await this.client.getChatById(chatId);
      return chat;
    } catch (error) {
      logger.error('Error getting chat:', error);
      return null;
    }
  }

  /**
   * Get all chats
   */
  async getAllChats() {
    try {
      const chats = await this.client.getChats();
      return chats;
    } catch (error) {
      logger.error('Error getting chats:', error);
      return [];
    }
  }

  /**
   * Block contact
   */
  async blockContact(phoneNumber) {
    try {
      const contact = await this.getContact(phoneNumber);
      if (contact) {
        await contact.block();
        logger.info(`Blocked contact: ${phoneNumber}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error blocking contact:', error);
      return false;
    }
  }

  /**
   * Unblock contact
   */
  async unblockContact(phoneNumber) {
    try {
      const contact = await this.getContact(phoneNumber);
      if (contact) {
        await contact.unblock();
        logger.info(`Unblocked contact: ${phoneNumber}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error unblocking contact:', error);
      return false;
    }
  }

  /**
   * Logout and destroy session
   */
  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        await this.client.destroy();
        this.isReady = false;
        logger.info('WhatsApp client logged out successfully');
      }
    } catch (error) {
      logger.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Get client info
   */
  async getClientInfo() {
    try {
      if (!this.isReady) {
        return null;
      }
      const info = this.client.info;
      return {
        number: info.wid.user,
        platform: info.platform,
        pushname: info.pushname,
      };
    } catch (error) {
      logger.error('Error getting client info:', error);
      return null;
    }
  }

  /**
   * Check if client is ready
   */
  isClientReady() {
    return this.isReady;
  }
}

export default WhatsAppClient;
