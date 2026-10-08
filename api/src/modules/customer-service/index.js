import logger from '../../utils/logger.js';

class CustomerServiceModule {
  constructor(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.name = 'customer-service';
  }

  /**
   * Handle customer service inquiry
   */
  async handle(message, context, user) {
    try {
      logger.info('Handling customer service inquiry');

      const intent = this.detectIntent(message);
      const response = {
        module: this.name,
        intent,
        suggestions: [],
        actions: [],
      };

      switch (intent) {
        case 'complaint':
          response.suggestions.push(
            'I understand your concern and I apologize for the inconvenience.',
            'Let me help resolve this issue for you.',
          );
          response.actions.push({
            type: 'create_ticket',
            priority: 'high',
            category: 'complaint',
          });
          break;

        case 'product_issue':
          response.suggestions.push(
            'I can help troubleshoot the issue with you.',
            'Could you provide more details about the problem?',
          );
          break;

        case 'return_refund':
          response.suggestions.push(
            'I can help you with returns and refunds.',
            'Please provide your order number.',
          );
          response.actions.push({
            type: 'request_order_number',
          });
          break;

        case 'general_inquiry':
          // Search knowledge base for relevant information
          if (this.knowledgeBase && this.knowledgeBase.isReady()) {
            const knowledge = await this.knowledgeBase.search(message, 3);
            if (knowledge.length > 0) {
              response.suggestions.push(
                'I found some information that might help:',
                ...knowledge.map(k => `• ${k.title}`),
              );
            }
          }
          break;

        default:
          response.suggestions.push(
            'How can I assist you today?',
            'I\'m here to help with any questions or concerns.',
          );
      }

      return response;
    } catch (error) {
      logger.error('Error in customer service module:', error);
      return { module: this.name, suggestions: [], actions: [] };
    }
  }

  /**
   * Detect specific intent
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.match(/complain|complaint|unhappy|disappointed|angry|frustrated|terrible|worst/)) {
      return 'complaint';
    }

    if (lowerMessage.match(/not working|broken|defective|error|bug|issue|problem/)) {
      return 'product_issue';
    }

    if (lowerMessage.match(/return|refund|money back|cancel order/)) {
      return 'return_refund';
    }

    if (lowerMessage.match(/how to|how do i|can you|help me|question about/)) {
      return 'general_inquiry';
    }

    return 'general';
  }

  /**
   * Get module context
   */
  getContext() {
    return {
      module: this.name,
      description: 'Customer support and problem resolution',
      capabilities: [
        'Handle complaints and issues',
        'Provide troubleshooting assistance',
        'Process returns and refunds',
        'Answer general inquiries',
        'Create support tickets',
      ],
    };
  }
}

export default CustomerServiceModule;
