# WhatsApp Company Assistant - Usage Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Managing Knowledge Base](#managing-knowledge-base)
5. [Module-Specific Features](#module-specific-features)
6. [API Reference](#api-reference)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### First Time Setup

1. **Complete Installation**
   ```bash
   npm install
   npm run setup
   ```

2. **Start the Assistant**
   ```bash
   npm run dev
   ```

3. **Connect WhatsApp**
   - Scan QR code with WhatsApp mobile app
   - Wait for "WhatsApp client is ready!" message

4. **Test the Assistant**
   - Send a message to the connected WhatsApp number
   - The assistant should respond automatically

## Basic Usage

### User Commands

Users can interact with the assistant using natural language. Special commands:

- `/help` - Show help message
- `/reset` - Start a new conversation
- `/status` - View conversation status
- `/feedback: <message>` - Send feedback

### Example Conversations

**Product Inquiry:**
```
User: Hi, I want to know about your products
Bot: Hello! I'd be happy to help you learn about our products. 
     We offer Product A for enterprise customers and Product B 
     for small businesses. Which would you like to know more about?
```

**Customer Support:**
```
User: I have a problem with my order
Bot: I'm sorry to hear you're having issues. I'm here to help!
     Could you please provide your order number so I can look into this?
```

**Appointment Scheduling:**
```
User: I need to schedule a meeting
Bot: I can help you schedule a meeting. Here are some available times:
     1. Monday, January 15 at 10:00 AM
     2. Monday, January 15 at 2:00 PM
     3. Tuesday, January 16 at 10:00 AM
```

## Advanced Features

### Multi-Language Support

The assistant can detect and respond in multiple languages:

```
User: Hola, necesito ayuda
Bot: ¡Hola! Estoy aquí para ayudarte...
```

### Sentiment Analysis

The system detects emotional tone and adjusts responses:

```
User: I'm really frustrated with this service!
Bot: I understand your frustration and I sincerely apologize for 
     the inconvenience. Let me help resolve this immediately...
```

### Context Awareness

The assistant remembers conversation history:

```
User: I want to buy Product A
Bot: Great choice! Product A is perfect for enterprise needs...

User: What's the pricing?
Bot: For Product A, we offer custom pricing based on your needs.
     I can connect you with our sales team to discuss specifics...
```

## Managing Knowledge Base

### Adding Documents

**Via File Upload:**

1. Place documents in `knowledge/` folder
2. Supported formats: PDF, DOCX, TXT, MD, JSON
3. Restart application to process new documents

**Via API:**

```bash
curl -X POST http://localhost:3000/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Return Policy",
    "content": "We offer 30-day returns...",
    "category": "policies",
    "subcategory": "returns",
    "tags": ["returns", "refunds", "policy"]
  }'
```

### Organizing Knowledge

**Categories:**
- `products` - Product information
- `policies` - Company policies
- `support` - Support documentation
- `faq` - Frequently asked questions
- `hr` - HR policies (for employees)

**Best Practices:**
- Use clear, descriptive titles
- Add relevant tags for better search
- Keep content concise and well-structured
- Update regularly
- Remove outdated information

### Searching Knowledge Base

```bash
curl "http://localhost:3000/api/knowledge/search?q=return%20policy&limit=5"
```

## Module-Specific Features

### Customer Service Module

**Handles:**
- Product issues and troubleshooting
- Complaints and feedback
- Returns and refunds
- General inquiries

**Keywords that trigger this module:**
help, support, problem, issue, complaint, not working, error

**Example:**
```
User: My product isn't working
Bot: I can help troubleshoot the issue with you. Could you provide 
     more details about the problem you're experiencing?
```

### Sales Module

**Handles:**
- Product information
- Pricing inquiries
- Purchase assistance
- Order tracking
- Product comparisons

**Keywords:**
buy, purchase, price, cost, product, order, payment

**Example:**
```
User: How much does Product B cost?
Bot: Product B is perfect for small businesses and starts at just 
     $99/month. Would you like to know more about what's included?
```

### HR Module

**Handles:**
- Leave requests
- Policy questions
- Benefits information
- Payroll inquiries
- Onboarding

**Keywords:**
leave, vacation, HR, salary, benefits, policy

**Example:**
```
User: How do I request vacation time?
Bot: I can help you with your leave request. What type of leave 
     would you like to request? (vacation, sick, personal)
```

### Scheduling Module

**Handles:**
- Appointment booking
- Rescheduling
- Cancellations
- Availability checks

**Keywords:**
appointment, meeting, schedule, book, reserve

**Example:**
```
User: I need to book an appointment
Bot: I can help you schedule an appointment. Here are some 
     available times: ...
```

## API Reference

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "WhatsApp Company Assistant",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Get Statistics

```bash
GET /api/stats
```

Response:
```json
{
  "activeSessions": 5,
  "knowledgeBase": {
    "total": 50,
    "published": 48,
    "categories": 5,
    "vectorCount": 250
  },
  "aiHealth": {
    "openai": { "available": true, "failures": 0 },
    "anthropic": { "available": true, "failures": 0 }
  }
}
```

### Add Knowledge

```bash
POST /api/knowledge
Content-Type: application/json

{
  "title": "Product Features",
  "content": "Detailed product information...",
  "category": "products",
  "subcategory": "features",
  "tags": ["product", "features"]
}
```

### Search Knowledge

```bash
GET /api/knowledge/search?q=pricing&limit=5
```

Response:
```json
{
  "results": [
    {
      "id": "...",
      "title": "Pricing Information",
      "content": "...",
      "category": "products",
      "score": 0.95
    }
  ]
}
```

## Best Practices

### For Optimal Performance

1. **Knowledge Base Management**
   - Keep documents under 10,000 words
   - Use clear headings and structure
   - Update regularly
   - Remove outdated content

2. **Response Quality**
   - Review AI responses periodically
   - Adjust personality in `.env` if needed
   - Fine-tune prompts in `promptBuilder.js`

3. **Session Management**
   - Default timeout is 30 minutes
   - Increase for longer conversations
   - Clean expired sessions regularly

4. **Monitoring**
   - Check logs daily
   - Monitor AI usage and costs
   - Track user satisfaction
   - Review analytics regularly

### For Business Users

1. **Quick Responses**
   - Keep messages concise
   - Provide order numbers when asked
   - Use specific product names

2. **Getting Better Results**
   - Be clear about your needs
   - Provide relevant details
   - Ask follow-up questions if needed

3. **When to Escalate**
   - Complex technical issues
   - Sensitive personal information
   - Urgent matters requiring human attention

## Troubleshooting

### Assistant Not Responding

**Possible causes:**
- WhatsApp disconnected
- AI provider error
- Database connection issue

**Solutions:**
1. Check logs: `tail -f logs/combined.log`
2. Verify WhatsApp status
3. Check AI provider API keys
4. Restart application

### Slow Responses

**Possible causes:**
- High AI latency
- Database query performance
- Network issues

**Solutions:**
1. Check AI provider status
2. Enable Redis caching
3. Optimize knowledge base
4. Review database indexes

### Incorrect Responses

**Possible causes:**
- Outdated knowledge base
- Poor query matching
- Context confusion

**Solutions:**
1. Update knowledge base content
2. Add more specific documents
3. Reset conversation with `/reset`
4. Adjust AI temperature in `.env`

### Memory/Performance Issues

**Solutions:**
1. Reduce `MAX_CONTEXT_MESSAGES`
2. Enable Redis
3. Clear old sessions
4. Restart application
5. Upgrade server resources

## Configuration Tips

### Personality Customization

Edit `.env`:
```
ASSISTANT_PERSONALITY=professional,helpful,friendly
```

Options: professional, casual, friendly, formal, enthusiastic, empathetic

### Response Speed

```
RESPONSE_DELAY_MS=1000  # Typing simulation delay
```

### Context Window

```
MAX_CONTEXT_MESSAGES=10  # Number of messages to remember
```

### Business Hours

```
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=18:00
BUSINESS_TIMEZONE=America/New_York
BUSINESS_DAYS=1,2,3,4,5  # Monday-Friday
```

## Analytics and Reporting

### View Conversation Logs

```bash
tail -f logs/conversations.log
```

### View Analytics

```bash
tail -f logs/analytics.log
```

### Export Data

Query MongoDB directly for detailed reports:
```javascript
db.conversations.find({
  createdAt: { $gte: new Date('2024-01-01') }
}).count()
```

## Support and Community

- **Documentation**: Check README.md and DEPLOYMENT.md
- **Logs**: Review application logs for errors
- **GitHub**: Submit issues for bugs or feature requests
- **Updates**: Pull latest code regularly for improvements

---

**Remember**: This assistant learns from your knowledge base. The more comprehensive and up-to-date your knowledge base, the better the responses!
