import TenantContext from './TenantContext.js';
import AIEngine from '../ai/aiEngine.js';
import KnowledgeBase from '../knowledge/knowledgeBase.js';
import { Business } from '../../models/index.js';
import logger from '../../utils/logger.js';

/**
 * Per-business cache of the (expensive to build) AIEngine + KnowledgeBase
 * pair, so a busy tenant doesn't reconnect to ChromaDB / rebuild provider
 * clients on every single incoming WhatsApp message.
 *
 * Rebuilt automatically when a tenant's aiConfig changes (detected via
 * TenantContext#getAIConfigVersion, a cheap string comparison) - no manual
 * cache-busting wired into the business routes is required, at the cost of
 * one extra Business lookup per message. That's an acceptable trade for a
 * platform this size; swap for an explicit invalidate() call from the
 * ai-config route if per-message lookups become a bottleneck.
 */
class EngineRegistry {
  constructor() {
    this.entries = new Map(); // businessId -> { tenantContext, aiEngine, knowledgeBase, aiConfigVersion }
  }

  /**
   * @param {string} businessId
   * @returns {Promise<{tenantContext: TenantContext, aiEngine: AIEngine, knowledgeBase: KnowledgeBase}>}
   */
  async getForBusiness(businessId) {
    const id = String(businessId);

    const business = await Business.findOne({ _id: id, status: 'active' })
      .select(TenantContext.requiredSelect());

    if (!business) {
      throw new Error(`No active business found for id ${id}`);
    }

    const tenantContext = new TenantContext(business);
    const version = tenantContext.getAIConfigVersion();

    const existing = this.entries.get(id);
    if (existing && existing.aiConfigVersion === version) {
      // Company/assistant/business-hours info can change without touching
      // aiConfig - refresh the lightweight TenantContext even on a cache hit.
      existing.tenantContext = tenantContext;
      existing.aiEngine.tenantContext = tenantContext;
      return existing;
    }

    if (existing) {
      logger.info(`AI config changed for business ${id}, rebuilding engine`);
    } else {
      logger.info(`Building engine for business ${id}`);
    }

    const knowledgeBase = new KnowledgeBase(null, id); // aiEngine set just below, then re-linked
    const aiEngine = new AIEngine({ tenantContext, knowledgeBase });
    knowledgeBase.aiEngine = aiEngine;
    knowledgeBase.vectorStore.aiEngine = aiEngine;

    await knowledgeBase.initialize();

    const entry = { tenantContext, aiEngine, knowledgeBase, aiConfigVersion: version };
    this.entries.set(id, entry);
    return entry;
  }

  /** Force a rebuild on the next getForBusiness call, e.g. after a key rotation. */
  invalidate(businessId) {
    this.entries.delete(String(businessId));
  }

  size() {
    return this.entries.size;
  }
}

export default new EngineRegistry();
export { EngineRegistry };
