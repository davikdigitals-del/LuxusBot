# 🤖 WhatsApp Company Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> A comprehensive, high-IQ AI-powered WhatsApp assistant for businesses. Deploy your own AI assistant with **FREE local models** or cloud AI providers!

**Deploy in 5 minutes** • **FREE local AI** • **Load balanced** • **Production ready**

## ✨ Why This Assistant?

🆓 **100% FREE AI Option** - Use Hermes 3B locally (no API costs!)  
⚖️ **Smart Load Balancing** - Distribute across multiple AI providers  
🚀 **Easy Deployment** - One-command setup, works anywhere  
📚 **Knowledge Base** - Train on your company documents  
💼 **Business Ready** - Customer service, sales, HR modules included  
🔒 **Secure & Private** - Self-hosted, your data stays yours  

## 🎯 Quick Start

### One-Command Installation

```bash
# Clone and setup (takes ~2 minutes)
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant
npm install
npm run setup

# Start the assistant
npm run dev
```

**That's it!** Scan the QR code with WhatsApp and start chatting!

📖 **Detailed Guide**: See [INSTALLATION.md](INSTALLATION.md) for complete setup instructions.

## 🌟 Features

### 🤖 AI Capabilities
- **Multi-Provider Support**: OpenAI GPT-4, Anthropic Claude, **FREE Local Models** (Hermes 3B)
- **Smart Load Balancing**: Distributes requests across all providers automatically
- **RAG (Retrieval Augmented Generation)**: Vector search through your company knowledge base
- **Advanced Context Management**: Maintains conversation history and user context
- **Sentiment Analysis**: Understands emotional tone of messages
- **Multi-Language Support**: Detects and responds in user's language
- **Image & Document Processing**: Analyzes images, extracts text from PDFs/DOCX

### 💼 Business Modules
- **Customer Service**: Automated support, FAQs, ticket creation, escalation
- **Sales Assistant**: Product info, recommendations, order tracking, lead qualification
- **HR Support**: Leave requests, policy questions, onboarding, employee support
- **Appointment Scheduling**: Meeting booking, calendar management, reminders
- **Analytics Dashboard**: Real-time metrics, conversation insights, satisfaction tracking

### 🛠️ Technical Features
- **Session Management**: Redis-based caching with in-memory fallback
- **Rate Limiting**: Protect against abuse and manage costs
- **Queue System**: Bull queues for handling high message volumes
- **Webhook Support**: Integrate with CRMs, ticketing systems, databases
- **Admin Dashboard**: Web-based control panel and analytics
- **Comprehensive Logging**: Winston logger with log rotation
- **Health Monitoring**: Built-in health checks and alerts
- **Production Ready**: PM2 process manager, Docker support

## 📋 What You Need

**Required:**
- Node.js 18+ ([Download](https://nodejs.org))
- MongoDB ([Install Guide](https://docs.mongodb.com/manual/installation/))

**Optional (Recommended):**
- Redis (for better performance)
- Ollama (for FREE local AI models)

**Cost Options:**
- 🆓 **100% FREE**: Use local Hermes 3B model (no API costs)
- 💰 **Paid**: OpenAI ($0.01/1k tokens) or Claude ($0.015/1k tokens)
- ⚖️ **Hybrid**: Mix free + paid for optimal cost/quality

## 🚀 Installation

### Option 1: Quick Setup (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant

# 2. Install dependencies
npm install

# 3. Run automated setup
npm run setup

# 4. Configure (edit .env file)
cp .env.example .env

# 5. Start!
npm run dev
```

### Option 2: Manual Setup

See [INSTALLATION.md](INSTALLATION.md) for detailed step-by-step instructions.

### Option 3: Docker (Coming Soon)

```bash
docker-compose up -d
```

## 📱 Connecting WhatsApp

After starting the assistant:

1. **QR Code Appears** in your terminal
2. **Open WhatsApp** on your phone
3. Go to **Settings** > **Linked Devices**
4. Tap **"Link a Device"**
5. **Scan the QR code**
6. **Done!** Start sending messages

## ⚙️ Configuration

### 1️⃣ Choose Your AI Provider

**FREE Local Model (Recommended for Testing):**
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
```
💰 **Cost**: $0 per month

**OpenAI GPT-4 (Best Quality):**
```env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```
💰 **Cost**: ~$10-100/month depending on usage

**Anthropic Claude (Balanced):**
```env
DEFAULT_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
💰 **Cost**: ~$15-150/month depending on usage

**⚖️ Load Balanced (Best Value - 30-50% Savings!):**
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
```
💰 **Cost**: ~$5-75/month (uses FREE local model for 30-50% of requests)

📖 **Learn More**: See [LOAD_BALANCER.md](LOAD_BALANCER.md) for load balancing details.

### 2️⃣ Company Information

```env
COMPANY_NAME=Your Company
COMPANY_EMAIL=support@yourcompany.com
COMPANY_PHONE=+1234567890
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
```

### 3️⃣ Add Knowledge Base

```bash
# Add your company documents
cp your-faq.pdf knowledge/
cp product-catalog.docx knowledge/
cp policies.txt knowledge/
```

Supported formats: PDF, DOCX, TXT, MD

### 4️⃣ Customize Assistant

```env
ASSISTANT_NAME=Alex
ASSISTANT_PERSONALITY=friendly, professional, helpful
ASSISTANT_LANGUAGE=en
```

## 🔌 External API

Create an API key in **Dashboard → API keys**, select only the permissions your integration needs, and save the raw key when it is shown. Send it on every request as the `x-api-key` header. Keys are tenant-scoped; requests do not accept a business ID, so integrations cannot select another business.

The base path is `/api/v1` on your API server. Available endpoints:

| Method | Endpoint | Permission |
|---|---|---|
| `GET` | `/conversations` | `conversations:read` |
| `GET` | `/conversations/:id` | `conversations:read` |
| `GET` | `/conversations/:id/messages` | `messages:read` |
| `POST` | `/conversations/:id/messages` | `messages:send` |
| `GET` | `/knowledge` | `knowledge:read` |
| `GET` | `/knowledge/:id` | `knowledge:read` |
| `GET` | `/knowledge/search?query=...` | `knowledge:read` |
| `POST` | `/knowledge` | `knowledge:write` |
| `PUT` | `/knowledge/:id` | `knowledge:write` |

Example knowledge search:

```bash
curl "https://YOUR_API_HOST/api/v1/knowledge/search?query=return%20policy" \
  -H "x-api-key: YOUR_API_KEY"
```

To add a knowledge document, send JSON with `title`, `content`, and one of `general`, `products`, `pricing`, `policies`, `faq`, `support`, or `other` as `category`. Message sending accepts `{"message":"..."}` and is allowed only for existing conversations already transferred to human handoff. API access requires an active paid plan. Requests without the required permission return `403`; missing or invalid keys return `401`.

📖 **Full Configuration Guide**: See [INSTALLATION.md](INSTALLATION.md)

## 📁 Project Structure

```
whatsapp-company-assistant/
├── src/
│   ├── index.js                 # Application entry point
│   ├── config/                  # Configuration files
│   ├── core/                    # Core system components
│   │   ├── whatsapp/           # WhatsApp integration
│   │   ├── ai/                 # AI brain and providers
│   │   ├── knowledge/          # RAG and knowledge base
│   │   └── memory/             # Context and session management
│   ├── modules/                # Business function modules
│   │   ├── customer-service/
│   │   ├── sales/
│   │   ├── hr/
│   │   └── scheduling/
│   ├── utils/                  # Utility functions
│   ├── middleware/             # Express middleware
│   ├── routes/                 # API routes
│   └── models/                 # Database models
├── knowledge/                   # Knowledge base documents
├── scripts/                     # Setup and maintenance scripts
├── logs/                        # Application logs
└── tests/                       # Test files
```

## 💬 Usage Examples

### Customer Support
```
👤 User: Hi, my order #12345 hasn't arrived yet
🤖 Bot: I'll help you track order #12345. Let me check... 
      Your order was shipped on Jan 15 and is currently in transit.
      Expected delivery: Jan 20. Would you like tracking updates?
```

### Product Information
```
👤 User: Tell me about your premium plan
🤖 Bot: Our Premium Plan includes:
      ✓ Unlimited messages
      ✓ Priority support
      ✓ Advanced analytics
      ✓ Custom integrations
      Price: $99/month
      Would you like to upgrade?
```

### Appointment Booking
```
👤 User: I need to schedule a demo
🤖 Bot: I'd be happy to schedule a demo! 
      Available slots this week:
      • Tuesday, Jan 18 at 2:00 PM
      • Wednesday, Jan 19 at 10:00 AM
      • Friday, Jan 21 at 3:00 PM
      Which time works best for you?
```

### Knowledge Base Query
```
👤 User: What's your refund policy?
🤖 Bot: [From knowledge base] Our refund policy:
      • 30-day money-back guarantee
      • No questions asked
      • Full refund to original payment method
      • Processing time: 5-7 business days
      Need help with a refund?
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and system status |
| `/api/analytics` | GET | Conversation metrics and insights |
| `/api/knowledge` | POST | Upload knowledge base documents |
| `/api/conversations` | GET | List all conversations |
| `/api/conversations/:id` | GET | Get specific conversation |
| `/api/broadcast` | POST | Send broadcast message to users |
| `/webhook` | POST | WhatsApp webhook endpoint |

## 📊 Dashboard & Analytics

Access the web dashboard at `http://localhost:3000/dashboard`

**Real-time Metrics:**
- 📈 Message volume (hourly/daily/weekly)
- ⏱️ Average response time
- 😊 Customer satisfaction scores
- 🎯 Top topics and intents
- 💰 AI usage and costs
- 🤖 Provider distribution (load balancer stats)

**Export Reports:**
- CSV exports for analysis
- Custom date ranges
- Filterable by module, user, or topic

## 🛡️ Security

- Rate limiting on all endpoints
- JWT-based authentication for admin API
- Environment variable validation
- Input sanitization
- Secure session management

## Kora Payments

New plan checkouts use Kora hosted checkout. Configure these API environment variables:

- `KORA_SECRET_KEY`: Kora secret key for the environment (test or live).
- `KORA_DEFAULT_CURRENCY`: the three-letter currency configured as the default for the Kora merchant account. Kora's charge API requires this value on each charge; it is not automatically discovered.
- `KORA_PAYMENT_CHANNELS`: comma-separated Kora payment channels enabled for the merchant and currency. Defaults to `card,bank_transfer,pay_with_bank,mobile_money`.

Plan prices remain denominated in USD and are converted to the configured checkout currency using Kora's current exchange rate. Customers renew manually through Billing; Kora checkouts do not create automatic monthly subscriptions. Configure the Kora merchant dashboard webhook URL as `/api/billing/kora-webhook` if per-checkout notification URLs are not enabled. Existing automatically renewing subscriptions retain a separate legacy webhook and management path until canceled or migrated.

`LEGACY_PAYSTACK_SECRET_KEY` and the three `LEGACY_PAYSTACK_PLAN_*` values are optional compatibility settings used only for subscriptions created before Kora was introduced. They do not configure new checkouts. Remove them after all earlier subscriptions are canceled or migrated.

## 🔄 Maintenance

### Backup
```bash
# Backup MongoDB
mongodump --uri="mongodb://localhost:27017/whatsapp_assistant"

# Backup Redis
redis-cli BGSAVE
```

### Update Knowledge Base
```bash
npm run update-knowledge
```

### View Logs
```bash
tail -f logs/combined.log
```

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the documentation in `/docs`
- Review common issues in TROUBLESHOOTING.md
- Open an issue on GitHub

## 🚀 Deployment

### Deploy to Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production deployment guide including:

- ✅ VPS setup (Digital Ocean, AWS, etc.)
- ✅ Platform as a Service (Heroku, Railway)
- ✅ Docker containerization
- ✅ Load balancing and scaling
- ✅ SSL/HTTPS setup
- ✅ Monitoring and alerts
- ✅ Backup strategies

**Quick Deploy Options:**

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)
[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new)

## 📈 Cost Comparison

**10,000 messages per month:**

| Configuration | Cost/Month | Notes |
|---------------|------------|-------|
| 🆓 Hermes 3B Only | $0 | Completely FREE! |
| 💰 OpenAI Only | ~$100 | Highest quality |
| 💰 Claude Only | ~$150 | Very reliable |
| ⚖️ **Load Balanced** | **~$50** | **Best value: 50% savings!** |

💡 **Recommendation**: Start with 100% FREE (Hermes), then add load balancing when you scale.

## 🛡️ Security & Privacy

- ✅ Self-hosted (your data never leaves your server)
- ✅ End-to-end encrypted WhatsApp connection
- ✅ Secure API key management
- ✅ Rate limiting and abuse prevention
- ✅ Input sanitization and validation
- ✅ Redis session encryption
- ✅ MongoDB authentication
- ✅ HTTPS/SSL support

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📚 Documentation

**New to this project? Start here!** 👇

### 🎓 Getting Started
- ⚡ **[Quick Start Guide](QUICK_START.md)** - 5-minute setup for beginners
- 📦 **[Installation Guide](INSTALLATION.md)** - Complete setup instructions
- 📋 **[Project Summary](PROJECT_SUMMARY.md)** - Overview of everything included

### 🚀 Advanced Topics
- 🚢 **[Deployment Guide](DEPLOYMENT.md)** - Production deployment strategies
- ⚖️ **[Load Balancer Guide](LOAD_BALANCER.md)** - AI load balancing & cost optimization
- 🤝 **[Contributing Guide](CONTRIBUTING.md)** - How to contribute code

### 📖 Additional Resources
- 🔧 API Documentation (coming soon)
- 💼 Business Modules Guide (coming soon)
- 🧠 AI Configuration (coming soon)
- 🐛 Troubleshooting Guide (coming soon)

**First time?** Read [QUICK_START.md](QUICK_START.md) first!

## 🆘 Troubleshooting

**Common Issues:**

1. **QR Code won't scan**: Delete `.wwebjs_auth` folder and restart
2. **MongoDB connection failed**: Check if MongoDB is running (`mongod`)
3. **Redis connection failed**: Disable Redis in `.env` or start Redis
4. **AI not responding**: Check API keys or use local model

See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more solutions.

## 📞 Support

- 📧 **Email**: support@yourcompany.com
- 💬 **Discord**: [Join our community](https://discord.gg/yourserver)
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/whatsapp-company-assistant/issues)
- 📖 **Docs**: [Full Documentation](https://docs.yoursite.com)

## 🎯 Roadmap

**Q1 2024:**
- [x] Multi-provider AI support
- [x] Load balancing system
- [x] Knowledge base with RAG
- [ ] Docker deployment
- [ ] Voice message support

**Q2 2024:**
- [ ] WhatsApp Business API
- [ ] CRM integrations (Salesforce, HubSpot)
- [ ] Payment processing
- [ ] Multi-language auto-detection
- [ ] Advanced analytics with ML

**Q3 2024:**
- [ ] Multi-agent collaboration
- [ ] Video call scheduling
- [ ] Mobile admin app
- [ ] Enterprise features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web API
- [OpenAI](https://openai.com) - GPT models
- [Anthropic](https://anthropic.com) - Claude models
- [Ollama](https://ollama.ai) - Local model runtime
- [LangChain](https://langchain.com) - AI orchestration

## ⭐ Star History

If this project helps you, please star it on GitHub!

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/whatsapp-company-assistant&type=Date)](https://star-history.com/#yourusername/whatsapp-company-assistant&Date)

---

**Built with ❤️ for businesses that want to provide exceptional customer experience through WhatsApp.**

**Ready to deploy? Start with [INSTALLATION.md](INSTALLATION.md)!** 🚀
