import logger from '../../utils/logger.js';
import { Conversation, User } from '../../models/index.js';
import { generateId } from '../../utils/helpers.js';

/**
 * Long-term memory system for massive conversation storage (2TB+)
 * Stores and retrieves historical conversations with semantic search
 */
class LongTermMemory {
  constructor(vectorStore) {
    this.vectorStore = vectorStore;
    this.compressionEnabled = true;
    this.archivalThreshold = 90; // Days before archiving old conversations
    this.memoryStats = {
      totalConversations: 0,
      totalMessages: 0,
      storageUsed: 0,
      oldestConversation: null,
      newestConversation: null,
    };
  }

  /**
   * Initialize long-term memory
   */
  async initialize() {
    try {
      logger.info('Initializing long-term memory system...');
      
      // Calculate current memory statistics
      await this.updateMemoryStats();
      
      logger.info('✅ Long-term memory initialized', {
        conversations: this.memoryStats.totalConversations,
        messages: this.memoryStats.totalMessages,
        storageGB: (this.memoryStats.storageUsed / (1024 * 1024 * 1024)).toFixed(2),
      });

      return true;
    } catch (error) {
      logger.error('Error initializing long-term memory:', error);
      return false;
    }
  }

  /**
   * Store conversation in long-term memory
   */
  async storeConversation(sessionId, metadata = {}) {
    try {
      const conversation = await Conversation.findOne({ sessionId });
      
      if (!conversation) {
        logger.warn(`Conversation not found: ${sessionId}`);
        return false;
      }

      // Generate conversation summary for better retrieval
      const summary = await this.generateConversationSummary(conversation);

      // Store in vector database for semantic search
      if (this.vectorStore && this.vectorStore.isReady()) {
        const vectorId = `conv-${conversation._id}`;
        await this.vectorStore.addDocument(vectorId, summary, {
          conversationId: conversation._id.toString(),
          userId: conversation.userId.toString(),
          phoneNumber: conversation.phoneNumber,
          sessionId: conversation.sessionId,
          intent: conversation.context.intent,
          module: conversation.assignedModule,
          messageCount: conversation.messages.length,
          sentiment: conversation.context.sentiment.label,
          timestamp: conversation.startedAt.toISOString(),
          ...metadata,
        });

        logger.info(`Stored conversation in long-term memory: ${sessionId}`);
      }

      // Update statistics
      await this.updateMemoryStats();

      return true;
    } catch (error) {
      logger.error('Error storing conversation:', error);
      return false;
    }
  }

  /**
   * Retrieve similar past conversations (semantic search)
   */
  async retrieveSimilarConversations(query, userId, limit = 5) {
    try {
      if (!this.vectorStore || !this.vectorStore.isReady()) {
        // Fallback to database search
        return await this.retrieveConversationsFromDB(query, userId, limit);
      }

      // Search vector store for semantically similar conversations
      const results = await this.vectorStore.search(query, limit * 2);

      // Filter by user and enrich with full conversation data
      const conversations = [];
      
      for (const result of results) {
        if (result.metadata.userId === userId || !userId) {
          const conversation = await Conversation.findById(result.metadata.conversationId);
          
          if (conversation) {
            conversations.push({
              id: conversation._id,
              sessionId: conversation.sessionId,
              summary: result.text,
              similarity: result.score,
              intent: conversation.context.intent,
              module: conversation.assignedModule,
              messageCount: conversation.messages.length,
              startedAt: conversation.startedAt,
              resolved: conversation.resolution.resolved,
              satisfaction: conversation.resolution.satisfaction,
            });
          }
        }

        if (conversations.length >= limit) break;
      }

      logger.info(`Retrieved ${conversations.length} similar conversations for query`);
      return conversations;
    } catch (error) {
      logger.error('Error retrieving similar conversations:', error);
      return [];
    }
  }

  /**
   * Retrieve full conversation history for a user
   */
  async getUserConversationHistory(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        startDate = null,
        endDate = null,
        intent = null,
        module = null,
        includeMessages = false,
      } = options;

      const query = { userId };

      // Date range filter
      if (startDate || endDate) {
        query.startedAt = {};
        if (startDate) query.startedAt.$gte = new Date(startDate);
        if (endDate) query.startedAt.$lte = new Date(endDate);
      }

      // Intent filter
      if (intent) {
        query['context.intent'] = intent;
      }

      // Module filter
      if (module) {
        query.assignedModule = module;
      }

      // Query conversations
      let conversationsQuery = Conversation.find(query)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit);

      // Optionally exclude messages for lighter response
      if (!includeMessages) {
        conversationsQuery = conversationsQuery.select('-messages');
      }

      const conversations = await conversationsQuery;

      logger.info(`Retrieved ${conversations.length} conversations for user ${userId}`);
      return conversations;
    } catch (error) {
      logger.error('Error retrieving user conversation history:', error);
      return [];
    }
  }

  /**
   * Get conversation insights for a user
   */
  async getUserInsights(userId) {
    try {
      const insights = await Conversation.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            avgMessagesPerConversation: { $avg: { $size: '$messages' } },
            avgDuration: { $avg: '$metrics.duration' },
            resolvedCount: {
              $sum: { $cond: ['$resolution.resolved', 1, 0] }
            },
            avgSatisfaction: {
              $avg: {
                $cond: [
                  { $ifNull: ['$resolution.satisfaction', false] },
                  '$resolution.satisfaction',
                  0
                ]
              }
            },
            moduleDistribution: {
              $push: '$assignedModule'
            },
            intentDistribution: {
              $push: '$context.intent'
            },
            sentimentDistribution: {
              $push: '$context.sentiment.label'
            },
          }
        }
      ]);

      if (insights.length === 0) {
        return null;
      }

      const insight = insights[0];

      // Calculate distributions
      insight.moduleBreakdown = this.calculateDistribution(insight.moduleDistribution);
      insight.intentBreakdown = this.calculateDistribution(insight.intentDistribution);
      insight.sentimentBreakdown = this.calculateDistribution(insight.sentimentDistribution);

      // Clean up
      delete insight.moduleDistribution;
      delete insight.intentDistribution;
      delete insight.sentimentDistribution;
      delete insight._id;

      // Calculate resolution rate
      insight.resolutionRate = (insight.resolvedCount / insight.totalConversations) * 100;

      logger.info(`Generated insights for user ${userId}`);
      return insight;
    } catch (error) {
      logger.error('Error getting user insights:', error);
      return null;
    }
  }

  /**
   * Search conversations by content
   */
  async searchConversations(searchQuery, options = {}) {
    try {
      const {
        userId = null,
        startDate = null,
        endDate = null,
        limit = 20,
      } = options;

      const query = {
        $text: { $search: searchQuery },
      };

      if (userId) {
        query.userId = userId;
      }

      if (startDate || endDate) {
        query.startedAt = {};
        if (startDate) query.startedAt.$gte = new Date(startDate);
        if (endDate) query.startedAt.$lte = new Date(endDate);
      }

      const conversations = await Conversation
        .find(query, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);

      logger.info(`Found ${conversations.length} conversations matching search`);
      return conversations;
    } catch (error) {
      logger.error('Error searching conversations:', error);
      return [];
    }
  }

  /**
   * Archive old conversations (for 2TB management)
   */
  async archiveOldConversations(daysOld = null) {
    try {
      const threshold = daysOld || this.archivalThreshold;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - threshold);

      logger.info(`Archiving conversations older than ${threshold} days...`);

      // Find old conversations
      const oldConversations = await Conversation.find({
        startedAt: { $lt: cutoffDate },
        status: { $in: ['resolved', 'abandoned'] },
      });

      let archived = 0;

      for (const conversation of oldConversations) {
        try {
          // Store summary in long-term memory first
          await this.storeConversation(conversation.sessionId, { archived: true });

          // Compress messages (keep only summary)
          if (this.compressionEnabled) {
            const summary = await this.generateConversationSummary(conversation);
            conversation.messages = [{
              role: 'system',
              content: `[ARCHIVED] Summary: ${summary}`,
              timestamp: conversation.startedAt,
            }];
            await conversation.save();
          }

          archived++;
        } catch (error) {
          logger.error(`Error archiving conversation ${conversation._id}:`, error);
        }
      }

      logger.info(`Archived ${archived} conversations`);
      await this.updateMemoryStats();

      return {
        archived,
        cutoffDate,
        threshold,
      };
    } catch (error) {
      logger.error('Error archiving conversations:', error);
      return { archived: 0 };
    }
  }

  /**
   * Get memory statistics (for 2TB monitoring)
   */
  async getMemoryStatistics() {
    try {
      await this.updateMemoryStats();
      
      // Get storage breakdown
      const stats = await Conversation.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgMessages: { $avg: { $size: '$messages' } },
          }
        }
      ]);

      // Get user statistics
      const userCount = await User.countDocuments();

      // Get module distribution
      const moduleStats = await Conversation.aggregate([
        {
          $group: {
            _id: '$assignedModule',
            count: { $sum: 1 },
          }
        }
      ]);

      return {
        overview: this.memoryStats,
        storageGB: (this.memoryStats.storageUsed / (1024 * 1024 * 1024)).toFixed(2),
        storagePercentage: ((this.memoryStats.storageUsed / (2 * 1024 * 1024 * 1024 * 1024)) * 100).toFixed(2), // Out of 2TB
        statusBreakdown: stats,
        moduleBreakdown: moduleStats,
        totalUsers: userCount,
        avgMessagesPerUser: userCount > 0 ? (this.memoryStats.totalMessages / userCount).toFixed(2) : 0,
      };
    } catch (error) {
      logger.error('Error getting memory statistics:', error);
      return null;
    }
  }

  /**
   * Generate conversation summary using AI
   */
  async generateConversationSummary(conversation) {
    try {
      const messages = conversation.messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Simple extractive summary (can be enhanced with AI)
      const summary = `
Intent: ${conversation.context.intent}
Module: ${conversation.assignedModule}
Messages: ${conversation.messages.length}
Status: ${conversation.status}
Sentiment: ${conversation.context.sentiment.label}
Key topics: ${conversation.context.topic || 'general'}
Resolution: ${conversation.resolution.resolved ? 'Resolved' : 'Unresolved'}
      `.trim();

      return summary;
    } catch (error) {
      logger.error('Error generating conversation summary:', error);
      return 'Conversation summary unavailable';
    }
  }

  /**
   * Update memory statistics
   */
  async updateMemoryStats() {
    try {
      const stats = await Conversation.aggregate([
        {
          $group: {
            _id: null,
            totalConversations: { $sum: 1 },
            totalMessages: { $sum: { $size: '$messages' } },
            oldestConversation: { $min: '$startedAt' },
            newestConversation: { $max: '$startedAt' },
          }
        }
      ]);

      if (stats.length > 0) {
        this.memoryStats = {
          totalConversations: stats[0].totalConversations,
          totalMessages: stats[0].totalMessages,
          storageUsed: await this.estimateStorageUsed(),
          oldestConversation: stats[0].oldestConversation,
          newestConversation: stats[0].newestConversation,
        };
      }
    } catch (error) {
      logger.error('Error updating memory stats:', error);
    }
  }

  /**
   * Estimate storage used (approximate)
   */
  async estimateStorageUsed() {
    try {
      // Get collection stats from MongoDB
      const db = Conversation.db;
      const stats = await db.collection('conversations').stats();
      return stats.storageSize || 0;
    } catch (error) {
      logger.error('Error estimating storage:', error);
      return 0;
    }
  }

  /**
   * Calculate distribution helper
   */
  calculateDistribution(items) {
    const distribution = {};
    items.forEach(item => {
      distribution[item] = (distribution[item] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Fallback: Retrieve from database
   */
  async retrieveConversationsFromDB(query, userId, limit) {
    try {
      const conversations = await Conversation
        .find({
          userId,
          $text: { $search: query },
        })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .select('-messages');

      return conversations.map(conv => ({
        id: conv._id,
        sessionId: conv.sessionId,
        intent: conv.context.intent,
        module: conv.assignedModule,
        startedAt: conv.startedAt,
        resolved: conv.resolution.resolved,
      }));
    } catch (error) {
      logger.error('Error retrieving from DB:', error);
      return [];
    }
  }

  /**
   * Export conversation data (for backup)
   */
  async exportConversations(options = {}) {
    try {
      const {
        userId = null,
        startDate = null,
        endDate = null,
        format = 'json',
      } = options;

      const query = {};
      if (userId) query.userId = userId;
      if (startDate || endDate) {
        query.startedAt = {};
        if (startDate) query.startedAt.$gte = new Date(startDate);
        if (endDate) query.startedAt.$lte = new Date(endDate);
      }

      const conversations = await Conversation.find(query);

      logger.info(`Exported ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      logger.error('Error exporting conversations:', error);
      return [];
    }
  }

  /**
   * Clean up deleted users' data (GDPR compliance)
   */
  async cleanupUserData(userId) {
    try {
      logger.info(`Cleaning up data for user: ${userId}`);

      // Delete all conversations
      const result = await Conversation.deleteMany({ userId });

      // Delete vector embeddings if available
      if (this.vectorStore && this.vectorStore.isReady()) {
        const conversations = await Conversation.find({ userId });
        for (const conv of conversations) {
          await this.vectorStore.deleteDocument(`conv-${conv._id}`);
        }
      }

      logger.info(`Deleted ${result.deletedCount} conversations for user ${userId}`);
      await this.updateMemoryStats();

      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up user data:', error);
      return 0;
    }
  }
}

export default LongTermMemory;
