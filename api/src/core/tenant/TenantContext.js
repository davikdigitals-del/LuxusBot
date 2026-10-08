import { decrypt } from '../../utils/crypto.js';
import logger from '../../utils/logger.js';

/**
 * Wraps a Business document and exposes exactly what the engine (AI, prompts,
 * knowledge base, sessions) needs, in one place, so nothing downstream reads
 * the Business schema or decrypts keys directly.
 *
 * One instance per request/message is cheap; AIEngineFactory caches the
 * heavier AIEngine built from it, keyed by businessId + aiConfig version.
 */
class TenantContext {
  constructor(business) {
    if (!business || !business._id) {
      throw new Error('TenantContext requires a loaded Business document');
    }
    this.business = business;
    this.businessId = String(business._id);
  }

  get companyInfo() {
    const b = this.business;
    return {
      name: b.name,
      industry: b.contact?.industry || '',
      description: b.contact?.description || '',
      website: b.contact?.website || '',
      email: b.contact?.email || '',
      phone: b.contact?.phone || '',
      address: b.contact?.address || '',
    };
  }

  get assistantInfo() {
    const a = this.business.assistant || {};
    return {
      name: a.name || 'Assistant',
      personality: a.personality || 'professional, helpful, friendly',
      systemPrompt: a.systemPrompt || '',
    };
  }

  /**
   * Matches the real Business.businessHours schema: enabled + per-day
   * schedule ({ monday: { start, end, enabled }, ... }), not a flat
   * start/end/days shape. See utils/helpers.js isBusinessHours() and
   * ai/promptBuilder.js for how this is consumed.
   */
  get businessHours() {
    const h = this.business.businessHours || {};
    return {
      enabled: !!h.enabled,
      timezone: h.timezone || this.business.timezone || 'UTC',
      schedule: h.schedule || {},
      outOfHoursMessage: h.outOfHoursMessage || '',
    };
  }

  /**
   * Decrypted AI provider config for this tenant. Never log or return this
   * object as-is to a client - keys come back in plaintext here.
   */
  getAIConfig() {
    const ai = this.business.aiConfig || {};
    const safeDecrypt = (value, label) => {
      if (!value) return undefined;
      try {
        return decrypt(value);
      } catch (error) {
        logger.error(`Failed to decrypt ${label} for business ${this.businessId}:`, error.message);
        return undefined;
      }
    };

    return {
      anthropicKey: ai.anthropicKeySet ? safeDecrypt(ai.anthropicKey, 'anthropicKey') : undefined,
      temperature: ai.temperature ?? 0.7,
      maxTokens: ai.maxTokens ?? 1000,
    };
  }

  /**
   * The Mongo document's aiConfig has select:false key fields, so callers
   * must load with .select('+aiConfig.anthropicKey')
   * before building a TenantContext that will call getAIConfig().
   */
  static requiredSelect() {
    return '+aiConfig.anthropicKey';
  }

  /** Namespace for this tenant's vector store collection / KB queries. */
  getKnowledgeCollectionName() {
    return `kb_${this.businessId}`;
  }

  /** A version string that changes whenever aiConfig changes, for cache busting. */
  getAIConfigVersion() {
    const ai = this.business.aiConfig || {};
    return [
      ai.anthropicKeySet ? '1' : '0',
      ai.temperature,
      ai.maxTokens,
    ].join(':');
  }
}

export default TenantContext;
