# ✅ Setup Checklist

Quick reference for setting up your WhatsApp Company Assistant.

## 📋 Prerequisites

### Required
- [ ] Node.js 18+ installed → [Download](https://nodejs.org)
- [ ] MongoDB installed & running → [Install Guide](https://docs.mongodb.com/manual/installation/)

### Optional (Recommended)
- [ ] Redis installed (for better performance) → [Install Guide](https://redis.io/download)
- [ ] Ollama installed (for FREE AI) → [Download](https://ollama.ai)

---

## 🚀 Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Setup Wizard
```bash
npm run setup
```
Follow the interactive prompts.

### 4. Start Application
```bash
npm run dev
```

### 5. Connect WhatsApp
- [ ] QR code appears in terminal
- [ ] Open WhatsApp on phone
- [ ] Go to Settings > Linked Devices
- [ ] Scan QR code
- [ ] Connection confirmed

---

## ⚙️ Configuration

### AI Provider Setup

Choose ONE of these options:

#### Option A: FREE (Local Model)
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
```
- [ ] Ollama installed
- [ ] Model downloaded: `ollama pull hermes3:3b`
- [ ] Ollama running: `ollama serve`

**Cost**: $0/month ✅

#### Option B: OpenAI
```env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```
- [ ] API key from https://platform.openai.com
- [ ] Key added to `.env`

**Cost**: ~$10-100/month

#### Option C: Claude
```env
DEFAULT_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
- [ ] API key from https://console.anthropic.com
- [ ] Key added to `.env`

**Cost**: ~$15-150/month

#### Option D: Load Balanced (Recommended!)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
```
- [ ] Multiple providers configured
- [ ] Keys added to `.env`

**Cost**: ~$5-75/month (50% savings!)

---

## 📝 Company Configuration

Edit `.env`:

```env
# Company Info
COMPANY_NAME=_______________
COMPANY_EMAIL=_______________
COMPANY_PHONE=_______________
COMPANY_WEBSITE=_______________

# Assistant
ASSISTANT_NAME=_______________
ASSISTANT_PERSONALITY=friendly,professional,helpful

# Business Hours
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
BUSINESS_HOURS_TIMEZONE=America/New_York
```

- [ ] Company name set
- [ ] Contact info added
- [ ] Business hours configured
- [ ] Assistant name chosen

---

## 📚 Knowledge Base

Add company documents to `knowledge/` folder:

- [ ] FAQ documents (.pdf, .docx, .txt)
- [ ] Product information
- [ ] Company policies
- [ ] Pricing sheets

Supported formats: PDF, DOCX, TXT, MD

---

## 🧪 Testing

### Test Messages

Send these to verify everything works:

1. **Basic Response**
   - Send: `Hi`
   - Expect: Greeting from assistant

2. **Knowledge Query**
   - Send: `What are your business hours?`
   - Expect: Business hours from config

3. **Multi-turn Conversation**
   - Send: `I need help`
   - Respond to follow-up questions
   - Expect: Contextual responses

---

## 🔍 Verification

### Check Connections

```bash
# MongoDB
mongosh --eval "db.version()"

# Redis
redis-cli ping

# Ollama (if using local AI)
ollama list
```

### Check Logs

```bash
# View logs
tail -f logs/combined.log

# Check for errors
grep ERROR logs/combined.log
```

### Access Dashboard

- [ ] Open browser
- [ ] Go to `http://localhost:3000/dashboard`
- [ ] View metrics

---

## ✅ Pre-Launch Checklist

Before going live:

### Configuration
- [ ] AI provider configured and tested
- [ ] Company information complete
- [ ] Business hours set
- [ ] Assistant personality customized

### Content
- [ ] Knowledge base documents added
- [ ] Tested with 10+ sample questions
- [ ] Responses are accurate
- [ ] Tone matches brand

### Technical
- [ ] WhatsApp connected successfully
- [ ] No errors in logs
- [ ] Dashboard accessible
- [ ] Database backups configured

### Security
- [ ] `.env` file not in Git
- [ ] API keys secured
- [ ] Rate limiting enabled
- [ ] Access controls set

---

## 🚨 Troubleshooting

### QR Code Won't Scan
```bash
rm -rf .wwebjs_auth
npm run dev
```

### MongoDB Not Connecting
```bash
# Start MongoDB
mongod

# Or disable in .env
MONGODB_URI=
```

### AI Not Responding
```bash
# Check API key
grep API_KEY .env

# Or use local model
ollama serve
```

### Port Already in Use
```env
# Change port in .env
PORT=3001
```

---

## 📖 Next Steps

After setup:

1. **Customize**
   - [ ] Add more knowledge base docs
   - [ ] Customize response templates
   - [ ] Configure webhooks

2. **Monitor**
   - [ ] Check dashboard daily
   - [ ] Review logs weekly
   - [ ] Track AI costs

3. **Optimize**
   - [ ] Enable load balancing
   - [ ] Add more providers
   - [ ] Fine-tune responses

4. **Deploy**
   - [ ] Choose hosting provider
   - [ ] Follow DEPLOYMENT.md
   - [ ] Set up monitoring
   - [ ] Configure backups

---

## 📚 Documentation Quick Links

- **Beginner**: [QUICK_START.md](QUICK_START.md)
- **Detailed Setup**: [INSTALLATION.md](INSTALLATION.md)
- **Production**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Load Balancing**: [LOAD_BALANCER.md](LOAD_BALANCER.md)
- **Overview**: [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)

---

## 🆘 Getting Help

### Self-Help
1. Check logs: `logs/combined.log`
2. Search existing issues
3. Read troubleshooting section

### Community
- 🐛 [GitHub Issues](https://github.com/yourusername/whatsapp-company-assistant/issues)
- 💬 [Discord](https://discord.gg/yourserver)
- 📧 Email: support@yourcompany.com

---

## ✨ Success!

When you see:
```
✅ WhatsApp connected!
🎉 Assistant is now active and ready!
📊 Dashboard: http://localhost:3000
```

**You're live!** 🚀

Start sending messages to test your assistant!

---

**Pro Tip**: Print this checklist and check off items as you complete them!
