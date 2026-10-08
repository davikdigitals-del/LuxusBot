import express from 'express';
import config from './config/index.js';
import logger from './utils/logger.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import businessRoutes from './routes/business.js';
import teamRoutes from './routes/team.js';
import whatsappRoutes from './routes/whatsapp.js';
import agentWhatsappRoutes from './routes/agentWhatsapp.js';
import conversationsRoutes from './routes/conversations.js';
import knowledgeRoutes from './routes/knowledge.js';
import dashboardRoutes from './routes/dashboard.js';
import apiKeysRoutes from './routes/apikeys.js';
import externalApiRoutes from './routes/externalApi.js';
import analyticsRoutes from './routes/analytics.js';
import onboardingRoutes from './routes/onboarding.js';
import knowledgeUploadRoutes from './routes/knowledgeUpload.js';
import routingRoutes from './routes/routing.js';
import { createCors } from './middleware/cors.js';
import billingRoutes, { koraWebhookHandler, legacyWebhookHandler } from './routes/billing.js';

/**
 * Builds the HTTP API (no database connection, no WhatsApp). Kept separate from
 * src/index.js so it can be tested and so new route groups are added in one place.
 */
export function createApp() {
  const app = express();

  // Needed for correct req.ip (rate limiting) when running behind nginx/a load balancer
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // The dashboard runs on a different origin than the API
  app.use(createCors((process.env.CORS_ORIGINS || config.appUrl || '').split(',')));

  // Legacy and Kora webhooks verify signatures over their raw request bodies.
  app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use('/api/billing/kora-webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: config.app_name,
      version: '1.0.0',
      uptime: process.uptime(),
    });
  });

  // Platform API
  app.use('/api/auth', authRoutes);
  app.use('/api/contact', contactRoutes);
  app.post('/api/billing/webhook', legacyWebhookHandler);
  app.post('/api/billing/kora-webhook', koraWebhookHandler);
  app.use('/api/billing', billingRoutes);
  app.use('/api/business', businessRoutes);
  // team.js, whatsapp.js, conversations.js all define :id-prefixed paths
  // (e.g. /:id/team) meant to sit under the same /api/business/:id namespace
  app.use('/api/business', teamRoutes);
  app.use('/api/business', whatsappRoutes);
  app.use('/api/business', conversationsRoutes);
  app.use('/api/business', knowledgeRoutes);
  app.use('/api/business', dashboardRoutes);
  app.use('/api/business', apiKeysRoutes);
  app.use('/api/v1', externalApiRoutes);
  app.use('/api/business', analyticsRoutes);
  app.use('/api/business', onboardingRoutes);
  app.use('/api/business', knowledgeUploadRoutes);
  app.use('/api/business', routingRoutes);
  app.use('/api/agent', agentWhatsappRoutes);

  return app;
}

/**
 * Call LAST, after every route has been mounted.
 */
export function attachErrorHandlers(app) {
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    // Malformed JSON body etc.
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: 'Request body too large' });
    }

    logger.error('Express error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(config.node_env !== 'production' && { message: error.message }),
    });
  });
}

export default createApp;
