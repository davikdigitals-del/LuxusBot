import logger from '../../utils/logger.js';

class HRModule {
  constructor(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.name = 'hr';
  }

  /**
   * Handle HR inquiry
   */
  async handle(message, context, user) {
    try {
      logger.info('Handling HR inquiry');

      const intent = this.detectIntent(message);
      const response = {
        module: this.name,
        intent,
        suggestions: [],
        actions: [],
      };

      switch (intent) {
        case 'leave_request':
          response.suggestions.push(
            'I can help you with your leave request.',
            'What type of leave would you like to request? (vacation, sick, personal)',
          );
          response.actions.push({
            type: 'initiate_leave_request',
          });
          break;

        case 'policy_question':
          response.suggestions.push(
            'I can help answer policy questions.',
          );
          
          // Search knowledge base for policy information
          if (this.knowledgeBase && this.knowledgeBase.isReady()) {
            const policies = await this.knowledgeBase.search(message, 3);
            if (policies.length > 0) {
              response.suggestions.push(
                '\nHere\'s what I found:',
                ...policies.map(p => `• ${p.title}`),
              );
            }
          }
          break;

        case 'benefits':
          response.suggestions.push(
            'I can provide information about employee benefits.',
            'What would you like to know about?',
          );
          break;

        case 'payroll':
          response.suggestions.push(
            'For payroll inquiries, I can provide general information.',
            'For specific questions about your pay, please contact HR directly.',
          );
          response.actions.push({
            type: 'escalate_to_hr',
            reason: 'payroll_inquiry',
          });
          break;

        case 'onboarding':
          response.suggestions.push(
            'Welcome! I can help with your onboarding process.',
            'What information do you need?',
          );
          break;

        default:
          response.suggestions.push(
            'How can I help you with HR matters?',
            'I can assist with leave requests, policies, and benefits.',
          );
      }

      return response;
    } catch (error) {
      logger.error('Error in HR module:', error);
      return { module: this.name, suggestions: [], actions: [] };
    }
  }

  /**
   * Detect specific intent
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.match(/leave|vacation|time off|pto|sick day|holiday/)) {
      return 'leave_request';
    }

    if (lowerMessage.match(/policy|policies|rule|regulation|handbook/)) {
      return 'policy_question';
    }

    if (lowerMessage.match(/benefit|insurance|health|dental|401k|retirement/)) {
      return 'benefits';
    }

    if (lowerMessage.match(/salary|payroll|paycheck|pay|wage|compensation/)) {
      return 'payroll';
    }

    if (lowerMessage.match(/onboard|new hire|first day|orientation|training/)) {
      return 'onboarding';
    }

    return 'general';
  }

  /**
   * Get module context
   */
  getContext() {
    return {
      module: this.name,
      description: 'Employee services and HR inquiries',
      capabilities: [
        'Process leave requests',
        'Answer policy questions',
        'Provide benefits information',
        'Assist with onboarding',
        'Handle general HR inquiries',
      ],
    };
  }
}

export default HRModule;
