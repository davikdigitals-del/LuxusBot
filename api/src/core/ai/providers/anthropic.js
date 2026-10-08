import Anthropic from '@anthropic-ai/sdk';
import logger from '../../../utils/logger.js';
import config from '../../../config/index.js';

class AnthropicProvider {
  /**
   * @param {object} [overrides] - per-tenant apiKey/model/temperature/maxTokens.
   *   Falls back to the platform-level config when omitted (legacy single-tenant mode).
   */
  constructor(overrides = {}) {
    const apiKey = overrides.apiKey || config.ai.anthropic.apiKey;

    if (!apiKey) {
      logger.warn('Anthropic API key not configured');
      this.client = null;
      return;
    }

    this.client = new Anthropic({
      // The 0.9.x SDK line has no Messages API; require 0.20+ (any 0.2x/0.3x/0.4x release works)
      apiKey,
    });
    this.model = overrides.model || config.ai.anthropic.model;
    this.temperature = overrides.temperature ?? config.ai.anthropic.temperature;
    this.maxTokens = overrides.maxTokens ?? config.ai.anthropic.maxTokens;
  }

  /**
   * Generate completion
   */
  async generateCompletion(messages, options = {}) {
    if (!this.client) {
      throw new Error('Anthropic client not initialized');
    }

    try {
      const startTime = Date.now();

      // Convert messages format (OpenAI to Anthropic)
      const { system, anthropicMessages } = this.convertMessages(messages);

      const response = await this.client.messages.create({
        model: options.model || this.model,
        system: system,
        messages: anthropicMessages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature ?? this.temperature,
        top_p: options.topP || 1,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        text: response.content[0].text,
        role: response.role,
        finishReason: response.stop_reason,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        provider: 'anthropic',
        duration,
        cost: this.calculateCost(response.usage, response.model),
      };

      logger.debug('Anthropic completion generated', {
        tokens: result.usage.totalTokens,
        duration: `${duration}ms`,
        cost: `$${result.cost.toFixed(4)}`,
      });

      return result;
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  /**
   * Convert OpenAI message format to Anthropic format
   */
  convertMessages(messages) {
    let system = '';
    const anthropicMessages = [];

    for (const message of messages) {
      if (message.role === 'system') {
        system += (system ? '\n\n' : '') + message.content;
      } else {
        anthropicMessages.push({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        });
      }
    }

    return { system, anthropicMessages };
  }

  /**
   * Calculate API cost
   */
  calculateCost(usage, model) {
    // USD per 1K tokens. Verify at https://docs.claude.com/en/docs/about-claude/pricing before launch.
    const pricing = {
      'claude-opus-4-5': { input: 0.005, output: 0.025 },
      'claude-sonnet-4-5': { input: 0.003, output: 0.015 },
      'claude-haiku-4-5': { input: 0.001, output: 0.005 },
    };

    const modelPricing = pricing[model] || pricing['claude-sonnet-4-5'];
    
    const inputCost = (usage.input_tokens / 1000) * modelPricing.input;
    const outputCost = (usage.output_tokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Check if provider is available
   */
  async isAvailable() {
    if (!this.client) {
      return false;
    }

    try {
      // Simple API check
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      logger.error('Anthropic availability check failed:', error);
      return false;
    }
  }

  /**
   * Get provider name
   */
  getName() {
    return 'anthropic';
  }

  /**
   * Get model name
   */
  getModel() {
    return this.model;
  }
}

export default AnthropicProvider;
