import Redis from 'ioredis';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';
import { Contact, Conversation } from '../../models/index.js';
import { generateId } from '../../utils/helpers.js';

/**
 * Tenant-scoped session manager. Every session, contact lookup, and
 * conversation record is keyed by (businessId, phoneNumber) so two
 * businesses with an overlapping customer never share state.
 *
 * Session cache keys: session:<businessId>:<phoneNumber>
 * A secondary index (sessionIndex:<sessionId> -> cache key) lets
 * sessionId-only lookups (updateContext, addMessage, etc.) avoid scanning
 * every active session on every call.
 */
class SessionManager {
  constructor() {
    this.redis = null;
    this.sessionTimeout = config.assistant.sessionTimeout * 60 * 1000; // Convert to milliseconds
    this.useRedis = true;
    this.memoryCache = new Map(); // Fallback in-memory cache
  }

  /**
   * Initialize session manager
   */
  async initialize() {
    try {
      logger.info('Initializing session manager...');

      // Try to connect to Redis
      try {
        this.redis = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis connection failed, using in-memory cache');
              this.useRedis = false;
              return null;
            }
            return Math.min(times * 100, 2000);
          },
        });
        this.redis.on('error', (error) => {
          logger.debug('Redis client error:', error.message);
        });

        await this.redis.ping();
        logger.info('✅ Connected to Redis');
      } catch (error) {
        logger.warn('Redis not available, using in-memory cache:', error.message);
        this.useRedis = false;
        if (this.redis) {
          this.redis.disconnect();
          this.redis = null;
        }
      }

      logger.info('✅ Session manager initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing session manager:', error);
      this.useRedis = false;
      return false;
    }
  }

  sessionKey(businessId, phoneNumber) {
    return `session:${businessId}:${phoneNumber}`;
  }

  sessionIndexKey(sessionId) {
    return `sessionIndex:${sessionId}`;
  }

  /**
   * Get or create session, scoped to one business.
   */
  async getOrCreateSession(businessId, phoneNumber, userData = {}) {
    if (!businessId) {
      throw new Error('getOrCreateSession requires a businessId');
    }

    try {
      const sessionKey = this.sessionKey(businessId, phoneNumber);

      let session = await this.getFromCache(sessionKey);

      if (session) {
        logger.debug(`Retrieved existing session for ${phoneNumber} (business ${businessId})`);
        return session;
      }

      logger.info(`Creating new session for ${phoneNumber} (business ${businessId})`);

      const contact = await this.getOrCreateContact(businessId, phoneNumber, userData);

      session = {
        sessionId: generateId(),
        businessId: String(businessId),
        contactId: contact._id.toString(),
        phoneNumber,
        userName: userData.name || contact.name || 'Unknown',
        startedAt: new Date(),
        lastActivity: new Date(),
        context: {
          intent: 'general',
          topic: '',
          language: 'en',
          sentiment: { score: 0, label: 'neutral' },
          assignedModule: 'general',
          messageCount: 0,
        },
        metadata: {},
      };

      await this.saveToCache(sessionKey, session, this.sessionTimeout);
      // Lets updateContext/addMessage/etc. find this session by sessionId alone,
      // without scanning every session in the cache.
      await this.saveToCache(this.sessionIndexKey(session.sessionId), sessionKey, this.sessionTimeout);

      await this.createConversation(session, contact);

      return session;
    } catch (error) {
      logger.error('Error getting or creating session:', error);
      throw error;
    }
  }

  /**
   * Get or create the Contact record (a WhatsApp end-customer of this
   * business) - NOT the dashboard User model.
   */
  async getOrCreateContact(businessId, phoneNumber, userData = {}) {
    try {
      let contact = await Contact.findOne({ businessId, phoneNumber });

      if (!contact) {
        contact = new Contact({
          businessId,
          phoneNumber,
          name: userData.name || '',
          isMyContact: !!userData.isMyContact,
          status: 'active',
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
        await contact.save();
        logger.info(`Created new contact: ${phoneNumber} (business ${businessId})`);
      } else {
        contact.lastSeen = new Date();
        if (userData.name && !contact.name) contact.name = userData.name;
        await contact.save();
      }

      return contact;
    } catch (error) {
      logger.error('Error getting or creating contact:', error);
      throw error;
    }
  }

  /**
   * Create conversation record
   */
  async createConversation(session, contact) {
    try {
      const conversation = new Conversation({
        businessId: session.businessId,
        userId: contact._id, // see model comment: references Contact, not User
        phoneNumber: session.phoneNumber,
        sessionId: session.sessionId,
        context: session.context,
        status: 'active',
        startedAt: session.startedAt,
      });

      await conversation.save();
      logger.debug(`Created conversation record: ${conversation._id}`);

      return conversation;
    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get session, scoped to one business.
   */
  async getSession(businessId, phoneNumber) {
    return await this.getFromCache(this.sessionKey(businessId, phoneNumber));
  }

  /**
   * Resolve a session by sessionId alone (used by the sessionId-only methods
   * below), via the secondary index instead of scanning every session.
   */
  async getSessionBySessionId(sessionId) {
    try {
      const sessionKey = await this.getFromCache(this.sessionIndexKey(sessionId));
      if (!sessionKey) return null;
      const session = await this.getFromCache(sessionKey);
      return session ? { sessionKey, session } : null;
    } catch (error) {
      logger.error('Error resolving session by sessionId:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    try {
      const found = await this.getSessionBySessionId(sessionId);
      if (!found) return;

      found.session.lastActivity = new Date();
      await this.saveToCache(found.sessionKey, found.session, this.sessionTimeout);
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  /**
   * Update context
   */
  async updateContext(sessionId, contextUpdates) {
    try {
      const found = await this.getSessionBySessionId(sessionId);
      if (!found) return;

      found.session.context = {
        ...found.session.context,
        ...contextUpdates,
      };
      await this.saveToCache(found.sessionKey, found.session, this.sessionTimeout);

      await Conversation.findOneAndUpdate(
        { sessionId },
        { context: found.session.context },
        { new: true }
      );
    } catch (error) {
      logger.error('Error updating context:', error);
    }
  }

  /**
   * Get context
   */
  async getContext(sessionId) {
    try {
      const found = await this.getSessionBySessionId(sessionId);
      return found ? found.session.context : null;
    } catch (error) {
      logger.error('Error getting context:', error);
      return null;
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(sessionId, role, content, messageType = 'text', metadata = {}) {
    try {
      const conversation = await Conversation.findOne({ sessionId, status: { $ne: 'resolved' } });

      if (!conversation) {
        throw new Error(`No active conversation found for session ${sessionId}`);
      }

      conversation.addMessage(role, content, messageType, metadata);

      if (conversation.context) {
        conversation.context.messageCount = conversation.messages.length;
      }

      await conversation.save();
      await this.updateContext(sessionId, { messageCount: conversation.messages.length });
      return conversation;
    } catch (error) {
      logger.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId, limit = 10) {
    try {
      const conversation = await Conversation.findOne({ sessionId, status: 'active' });

      if (!conversation) {
        return [];
      }

      const messages = conversation.messages.slice(-limit);

      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        messageType: msg.messageType,
      }));
    } catch (error) {
      logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Clear session
   */
  async clearSession(sessionId) {
    try {
      const found = await this.getSessionBySessionId(sessionId);
      if (!found) return;

      await this.deleteFromCache(found.sessionKey);
      await this.deleteFromCache(this.sessionIndexKey(sessionId));
      logger.info(`Cleared session: ${sessionId}`);
    } catch (error) {
      logger.error('Error clearing session:', error);
    }
  }

  /**
   * End session
   */
  async endSession(sessionId, resolution = {}) {
    try {
      const conversation = await Conversation.findOne({ sessionId, status: 'active' });

      if (conversation) {
        if (resolution.satisfied) {
          conversation.markResolved(resolution.satisfaction, resolution.feedback);
        } else {
          conversation.status = 'abandoned';
          conversation.endedAt = new Date();
        }

        conversation.calculateDuration();
        await conversation.save();
      }

      await this.clearSession(sessionId);

      logger.info(`Ended session: ${sessionId}`);
    } catch (error) {
      logger.error('Error ending session:', error);
    }
  }

  /**
   * Get active sessions count (across all businesses)
   */
  async getActiveSessionsCount() {
    try {
      const sessions = await this.getAllSessions();
      return sessions.size;
    } catch (error) {
      logger.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  /**
   * Clean expired sessions. Still a full scan (session count is expected to
   * stay small relative to message volume), but this one runs on a timer,
   * not per-message, so it doesn't block the hot path the way the old
   * per-message full scans did.
   */
  async cleanExpiredSessions() {
    try {
      const sessions = await this.getAllSessions();
      const now = Date.now();
      let cleaned = 0;

      for (const [, session] of sessions) {
        const lastActivity = new Date(session.lastActivity).getTime();
        const elapsed = now - lastActivity;

        if (elapsed > this.sessionTimeout) {
          await this.endSession(session.sessionId, { satisfied: false });
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} expired sessions`);
      }
    } catch (error) {
      logger.error('Error cleaning expired sessions:', error);
    }
  }

  /**
   * Save to cache (Redis or memory)
   */
  async saveToCache(key, value, ttl) {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(value));
      } else {
        this.memoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttl,
        });
      }
    } catch (error) {
      logger.error('Error saving to cache:', error);
      this.memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttl,
      });
    }
  }

  /**
   * Get from cache (Redis or memory)
   */
  async getFromCache(key) {
    try {
      if (this.useRedis && this.redis) {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        const cached = this.memoryCache.get(key);
        if (cached) {
          if (Date.now() > cached.expiresAt) {
            this.memoryCache.delete(key);
            return null;
          }
          return cached.value;
        }
        return null;
      }
    } catch (error) {
      logger.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Delete from cache
   */
  async deleteFromCache(key) {
    try {
      if (this.useRedis && this.redis) {
        await this.redis.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.error('Error deleting from cache:', error);
    }
  }

  /**
   * Get all sessions (across all businesses). Used by cleanup and count
   * endpoints only - the hot per-message path never calls this anymore.
   */
  async getAllSessions() {
    try {
      const sessions = new Map();

      if (this.useRedis && this.redis) {
        const keys = await this.redis.keys('session:*');
        for (const key of keys) {
          const data = await this.redis.get(key);
          if (data) {
            sessions.set(key, JSON.parse(data));
          }
        }
      } else {
        const now = Date.now();
        for (const [key, cached] of this.memoryCache.entries()) {
          if (key.startsWith('session:')) {
            if (now <= cached.expiresAt) {
              sessions.set(key, cached.value);
            } else {
              this.memoryCache.delete(key);
            }
          }
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Error getting all sessions:', error);
      return new Map();
    }
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Disconnected from Redis');
    }
  }
}

export default SessionManager;
