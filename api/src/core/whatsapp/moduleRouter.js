import logger from '../../utils/logger.js';
import { parseIntent } from '../../utils/helpers.js';

class ModuleRouter {
  constructor() {
    this.modules = {
      'customer-service': {
        keywords: ['help', 'support', 'problem', 'issue', 'complaint', 'not working', 'error', 'question'],
        priority: 2,
      },
      'sales': {
        keywords: ['buy', 'purchase', 'price', 'cost', 'product', 'order', 'payment', 'checkout'],
        priority: 3,
      },
      'hr': {
        keywords: ['leave', 'vacation', 'holiday', 'salary', 'payroll', 'hr', 'employee', 'benefits'],
        priority: 1,
      },
      'scheduling': {
        keywords: ['appointment', 'meeting', 'schedule', 'book', 'calendar', 'availability'],
        priority: 2,
      },
    };
  }

  /**
   * Route message to appropriate module
   */
  async route(message, session) {
    try {
      const lowerMessage = message.toLowerCase();
      const intent = parseIntent(message);

      // Check session context for ongoing conversation
      if (session.context && session.context.assignedModule) {
        // Check if user is trying to switch topics
        if (this.isTopicSwitch(lowerMessage)) {
          logger.info('Topic switch detected, re-routing...');
        } else {
          logger.info(`Continuing with module: ${session.context.assignedModule}`);
          return session.context.assignedModule;
        }
      }

      // Calculate module scores
      const scores = this.calculateModuleScores(lowerMessage, intent);

      // Get best matching module
      let bestModule = 'general';
      let bestScore = 0;

      for (const [module, score] of Object.entries(scores)) {
        if (score > bestScore) {
          bestScore = score;
          bestModule = module;
        }
      }

      // Use general module if no strong match
      if (bestScore < 0.3) {
        bestModule = 'general';
      }

      logger.info(`Routed to module: ${bestModule} (score: ${bestScore.toFixed(2)})`);
      return bestModule;
    } catch (error) {
      logger.error('Error routing message:', error);
      return 'general';
    }
  }

  /**
   * Calculate module scores based on message content
   */
  calculateModuleScores(message, intent) {
    const scores = {};

    for (const [moduleName, moduleConfig] of Object.entries(this.modules)) {
      let score = 0;

      // Check keyword matches
      for (const keyword of moduleConfig.keywords) {
        if (message.includes(keyword)) {
          score += 0.5;
        }
      }

      // Intent-based routing
      if (intent === 'help' || intent === 'complaint') {
        if (moduleName === 'customer-service') score += 0.7;
      } else if (intent === 'product' || intent === 'order') {
        if (moduleName === 'sales') score += 0.7;
      } else if (intent === 'appointment') {
        if (moduleName === 'scheduling') score += 0.7;
      } else if (intent === 'hr') {
        if (moduleName === 'hr') score += 0.7;
      }

      // Apply priority multiplier
      score *= moduleConfig.priority;

      scores[moduleName] = Math.min(score, 1.0);
    }

    return scores;
  }

  /**
   * Check if user is trying to switch topics
   */
  isTopicSwitch(message) {
    const switchPhrases = [
      'actually',
      'wait',
      'instead',
      'change',
      'different',
      'another',
      'new topic',
      'something else',
    ];

    return switchPhrases.some(phrase => message.includes(phrase));
  }

  /**
   * Get module description
   */
  getModuleDescription(moduleName) {
    const descriptions = {
      'customer-service': 'Customer support and problem resolution',
      'sales': 'Product information and purchase assistance',
      'hr': 'Employee services and HR inquiries',
      'scheduling': 'Appointment and meeting management',
      'general': 'General assistance',
    };

    return descriptions[moduleName] || 'General assistance';
  }

  /**
   * Get available modules
   */
  getAvailableModules() {
    return Object.keys(this.modules);
  }
}

export default ModuleRouter;
