import logger from '../../utils/logger.js';

class SalesModule {
  constructor(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.name = 'sales';
  }

  /**
   * Handle sales inquiry
   */
  async handle(message, context, user) {
    try {
      logger.info('Handling sales inquiry');

      const intent = this.detectIntent(message);
      const response = {
        module: this.name,
        intent,
        suggestions: [],
        actions: [],
      };

      switch (intent) {
        case 'product_info':
          response.suggestions.push(
            'I can provide information about our products.',
            'What would you like to know?',
          );
          
          // Search knowledge base for product information
          if (this.knowledgeBase && this.knowledgeBase.isReady()) {
            const products = await this.knowledgeBase.search(message, 3);
            if (products.length > 0) {
              response.suggestions.push(
                '\nHere are our relevant products:',
                ...products.map(p => `• ${p.title}`),
              );
            }
          }
          break;

        case 'pricing':
          response.suggestions.push(
            'I can help you with pricing information.',
            'Which product are you interested in?',
          );
          response.actions.push({
            type: 'request_product_name',
          });
          break;

        case 'purchase':
          response.suggestions.push(
            'Great! I can help you complete your purchase.',
            'Would you like to proceed with ordering?',
          );
          response.actions.push({
            type: 'initiate_purchase',
          });
          break;

        case 'order_status':
          response.suggestions.push(
            'I can check your order status for you.',
            'Please provide your order number.',
          );
          response.actions.push({
            type: 'request_order_number',
          });
          break;

        case 'comparison':
          response.suggestions.push(
            'I can help compare our products.',
            'Which products would you like to compare?',
          );
          break;

        default:
          response.suggestions.push(
            'How can I help you today?',
            'I can assist with product information, pricing, and orders.',
          );
      }

      return response;
    } catch (error) {
      logger.error('Error in sales module:', error);
      return { module: this.name, suggestions: [], actions: [] };
    }
  }

  /**
   * Detect specific intent
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.match(/price|cost|how much|expensive|cheap|pricing/)) {
      return 'pricing';
    }

    if (lowerMessage.match(/buy|purchase|order|checkout|cart/)) {
      return 'purchase';
    }

    if (lowerMessage.match(/track|status|where is|delivery|shipping/)) {
      return 'order_status';
    }

    if (lowerMessage.match(/compare|difference|versus|vs|better than/)) {
      return 'comparison';
    }

    if (lowerMessage.match(/product|item|feature|specification|detail/)) {
      return 'product_info';
    }

    return 'general';
  }

  /**
   * Get module context
   */
  getContext() {
    return {
      module: this.name,
      description: 'Product information and purchase assistance',
      capabilities: [
        'Provide product information',
        'Answer pricing questions',
        'Assist with purchases',
        'Track orders',
        'Compare products',
      ],
    };
  }
}

export default SalesModule;
