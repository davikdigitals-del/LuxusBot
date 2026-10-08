import moment from 'moment-timezone';
import config from '../../config/index.js';
import { formatBusinessHours } from '../../utils/helpers.js';

class PromptBuilder {
  constructor() {
    this.maxHistoryMessages = config.assistant.maxContextMessages;
  }

  /**
   * Build messages array for AI
   */
  async buildMessages(params) {
    const { message, context, history, module, user, companyInfo, assistantInfo, businessHours } = params;

    const messages = [];

    // System prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(companyInfo, assistantInfo, module, businessHours),
    });

    // Context information
    if (context) {
      messages.push({
        role: 'system',
        content: this.buildContextPrompt(context, user),
      });
    }

    // Conversation history
    if (history && history.length > 0) {
      const recentHistory = history.slice(-this.maxHistoryMessages);
      for (const msg of recentHistory) {
        if (msg.role !== 'system') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    // Current message
    if (message) {
      messages.push({
        role: 'user',
        content: message,
      });
    }

    return messages;
  }

  /**
   * Build system prompt
   */
  buildSystemPrompt(companyInfo, assistantInfo, module, businessHours = config.businessHours) {
    const personality = assistantInfo.personality.split(',').join(', ');
    const currentTime = moment().tz(businessHours.timezone).format('YYYY-MM-DD HH:mm:ss z');

    let prompt = `You are ${assistantInfo.name}, an AI assistant for ${companyInfo.name}.

## Company Information
- Industry: ${companyInfo.industry}
- Description: ${companyInfo.description || 'A leading company in our industry'}
- Website: ${companyInfo.website || 'Not provided'}
- Contact: ${companyInfo.email || 'Not provided'}

## Your Role
You are assisting customers via WhatsApp. Your personality is: ${personality}.

## Current Context
- Current time: ${currentTime}
- Business hours: ${formatBusinessHours(businessHours)}
- Active module: ${module || 'general'}

${assistantInfo.systemPrompt ? `## Business-Specific Instructions\n${assistantInfo.systemPrompt}\n` : ''}
## Guidelines
1. **Be helpful and professional**: Provide accurate, relevant information
2. **Be concise**: Keep responses clear and to the point (2-3 paragraphs max for WhatsApp)
3. **Be conversational**: Use a natural, friendly tone
4. **Ask clarifying questions**: If you need more information to help
5. **Stay on topic**: Focus on the customer's needs
6. **Privacy**: Never ask for sensitive information like passwords or full credit card numbers
7. **Escalation**: If you cannot help, offer to connect them with a human agent
8. **Format**: Use WhatsApp-friendly formatting (*bold*, _italic_, but sparingly)

## Module-Specific Instructions
${this.getModuleInstructions(module)}

## Response Format
- Keep responses under 300 words when possible
- Use bullet points or numbered lists for clarity
- Add relevant emojis occasionally (but don't overuse)
- If providing steps, number them clearly
- For urgent issues, acknowledge urgency and provide timeline

Remember: You're representing ${companyInfo.name}. Be professional, helpful, and efficient.`;

    return prompt;
  }

  /**
   * Get module-specific instructions
   */
  getModuleInstructions(module) {
    const instructions = {
      'customer-service': `You're handling customer support. Focus on:
- Understanding the customer's issue clearly
- Providing solutions or troubleshooting steps
- Offering to escalate if needed
- Following up to ensure resolution`,

      'sales': `You're assisting with sales. Focus on:
- Understanding customer needs
- Providing product information
- Answering pricing questions
- Guiding through the purchase process
- Following up on orders`,

      'hr': `You're handling HR inquiries. Focus on:
- Answering policy questions
- Assisting with leave requests
- Providing benefits information
- Maintaining confidentiality
- Directing to HR team for sensitive matters`,

      'scheduling': `You're managing appointments. Focus on:
- Understanding availability needs
- Proposing time slots
- Confirming appointments
- Sending reminders
- Handling reschedules`,

      'general': `You're providing general assistance. Focus on:
- Understanding the customer's needs
- Routing to appropriate department if needed
- Providing helpful information
- Being welcoming and professional`,
    };

    return instructions[module] || instructions['general'];
  }

  /**
   * Build context prompt
   */
  buildContextPrompt(context, user) {
    let prompt = `## Current Conversation Context\n`;

    if (user) {
      prompt += `- User: ${user.name || 'Unknown'}\n`;
      prompt += `- Phone: ${user.phone}\n`;
    }

    if (context.intent) {
      prompt += `- Intent: ${context.intent}\n`;
    }

    if (context.topic) {
      prompt += `- Topic: ${context.topic}\n`;
    }

    if (context.language && context.language !== 'en') {
      prompt += `- Language: ${context.language}\n`;
      prompt += `- Note: Respond in ${context.language}\n`;
    }

    if (context.sentiment) {
      prompt += `- User sentiment: ${context.sentiment.label}\n`;
      
      if (context.sentiment.label.includes('negative')) {
        prompt += `- Note: User appears frustrated. Be extra empathetic and solution-focused.\n`;
      }
    }

    if (context.metadata) {
      prompt += `- Additional context: ${JSON.stringify(context.metadata)}\n`;
    }

    return prompt;
  }

  /**
   * Build RAG prompt with knowledge
   */
  buildRAGPrompt(query, relevantDocs) {
    let prompt = `Use the following information to answer the user's question:\n\n`;

    relevantDocs.forEach((doc, index) => {
      prompt += `[Document ${index + 1}]\n`;
      prompt += `Title: ${doc.title}\n`;
      prompt += `Content: ${doc.content}\n\n`;
    });

    prompt += `User Question: ${query}\n\n`;
    prompt += `Instructions: Answer based on the provided documents. If the documents don't contain relevant information, say so and provide general guidance.`;

    return prompt;
  }

  /**
   * Build function calling prompt
   */
  buildFunctionPrompt(availableFunctions) {
    let prompt = `You have access to the following functions:\n\n`;

    availableFunctions.forEach(func => {
      prompt += `- ${func.name}: ${func.description}\n`;
      prompt += `  Parameters: ${JSON.stringify(func.parameters)}\n\n`;
    });

    prompt += `Use these functions when appropriate to help the user.`;

    return prompt;
  }
}

export default PromptBuilder;
