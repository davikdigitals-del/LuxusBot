import mongoose from 'mongoose';
import logger from './utils/logger.js';
import config from './config/index.js';

// Core imports
import { MessageHandler } from './core/whatsapp/index.js';
import sessionRegistry from './core/whatsapp/SessionRegistry.js';
import { wireEventBridge } from './core/whatsapp/eventBridge.js';
import { SessionManager } from './core/memory/index.js';
import ModuleRouter from './core/whatsapp/moduleRouter.js';
import { createApp, attachErrorHandlers } from './app.js';

class WhatsAppAssistant {
  constructor() {
    this.app = createApp();
    this.sessionManager = null;
    this.messageHandler = null;
  }

  /**
   * Initialize application
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing WhatsApp Company Assistant...');
      logger.info(`Environment: ${config.node_env}`);
      logger.info(`Company: ${config.company.name}`);

      // Connect to MongoDB
      await this.connectDatabase();

      // Initialize components
      await this.initializeComponents();

      // Setup Express server
      this.setupExpress();

      // Multi-tenant WhatsApp: MessageHandler resolves each business's own
      // AIEngine/KnowledgeBase per message (see EngineRegistry), so ONE
      // handler instance serves every tenant - there's no per-business
      // object to construct here, unlike the old single-tenant client.
      this.messageHandler = new MessageHandler(this.sessionManager, this.moduleRouter);
      wireEventBridge(this.messageHandler);

      // Reconnect any business/agent WhatsApp sessions that were connected
      // before this process last stopped.
      await sessionRegistry.resumeAll();

      // Expire idle conversation sessions on a timer (see cleanExpiredSessions)
      this.startSessionCleanup();

      logger.info('🤖 Assistant is ready to receive messages!');

      // Must come after every route is mounted
      attachErrorHandlers(this.app);

      logger.info('✅ WhatsApp Company Assistant initialized successfully');
      logger.info(`🌐 Server running on port ${config.port}`);

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize application:', error);
      process.exit(1);
    }
  }

  /**
   * Connect to MongoDB
   */
  async connectDatabase() {
    try {
      logger.info('Connecting to MongoDB...');
      
      await mongoose.connect(config.database.mongoUri, {
        dbName: config.database.dbName,
      });

      logger.info('✅ Connected to MongoDB');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Initialize core components
   */
  async initializeComponents() {
    try {
      // Initialize Session Manager
      logger.info('Initializing Session Manager...');
      this.sessionManager = new SessionManager();
      await this.sessionManager.initialize();

      // AI engines and knowledge bases are constructed per business in EngineRegistry.
      this.moduleRouter = new ModuleRouter();

      logger.info('✅ Shared runtime components initialized');
    } catch (error) {
      logger.error('Failed to initialize components:', error);
      throw error;
    }
  }

  /**
   * Setup Express server
   */
  setupExpress() {
    // Middleware and routes live in src/app.js. Legacy single-tenant endpoints
    // (/api/stats, /api/knowledge*) were removed: they were unauthenticated and
    // wrote to a global knowledge base. They return as tenant-scoped routes.

    // Start server
    const server = this.app.listen(config.port, () => {
      logger.info(`Express server listening on port ${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        this.shutdown();
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        this.shutdown();
      });
    });
  }

  /**
   * Start session cleanup job
   */
  startSessionCleanup() {
    // Clean expired sessions every 5 minutes
    setInterval(async () => {
      try {
        await this.sessionManager.cleanExpiredSessions();
      } catch (error) {
        logger.error('Error cleaning sessions:', error);
      }
    }, 5 * 60 * 1000);

    logger.info('Session cleanup job started');
  }

  /**
   * Shutdown application
   */
  async shutdown() {
    try {
      logger.info('Shutting down application...');

      // Close WhatsApp sockets WITHOUT invalidating sessions (soft close),
      // so every business/agent doesn't need to re-scan a QR after a restart.
      await sessionRegistry.closeAll();

      // Disconnect session manager
      if (this.sessionManager) {
        await this.sessionManager.disconnect();
      }

      // Disconnect MongoDB
      await mongoose.disconnect();

      logger.info('✅ Application shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start application
const app = new WhatsAppAssistant();

app.initialize().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default app;
