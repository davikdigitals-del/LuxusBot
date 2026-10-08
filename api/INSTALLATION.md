# 📦 Complete Installation Guide

This guide will walk you through setting up the WhatsApp Company Assistant from scratch. Perfect for anyone who wants to deploy this system!

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Configuration](#configuration)
5. [First Run](#first-run)
6. [Troubleshooting](#troubleshooting)

---

## 🖥️ System Requirements

### Minimum Requirements
- **Operating System**: Windows 10/11, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk Space**: 5GB free
- **Node.js**: Version 18.0.0 or higher
- **Internet**: Stable connection

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **SSD**: 10GB+ free
- **Node.js**: Latest LTS version

---

## 🚀 Installation Methods

Choose the method that works best for you:

### Method 1: Quick Install (Recommended for Beginners)
```bash
# Clone the repository
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant

# Run automated setup
npm install
npm run setup
```

### Method 2: Manual Install (For Advanced Users)
Follow the [Step-by-Step Setup](#step-by-step-setup) below.

### Method 3: Docker Install (Coming Soon)
```bash
docker-compose up -d
```

---

## 📝 Step-by-Step Setup

### Step 1: Install Node.js

#### Windows
1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### macOS
```bash
# Using Homebrew
brew install node

# Or download from nodejs.org
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Install MongoDB

#### Windows
1. Download from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Run installer with default settings
3. MongoDB will run as a Windows service

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux (Ubuntu)
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Step 3: Install Redis (Optional but Recommended)

#### Windows
1. Download from [redis.io](https://redis.io/download) or use WSL2
2. Or use Docker:
   ```bash
   docker run -d -p 6379:6379 redis
   ```

#### macOS
```bash
brew install redis
brew services start redis
```

#### Linux (Ubuntu)
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

### Step 4: Install Ollama (For Local AI Models)

#### Windows
1. Download from [ollama.ai](https://ollama.ai)
2. Run the installer
3. Pull Hermes model:
   ```bash
   ollama pull hermes3:3b
   ```

#### macOS/Linux
```bash
curl https://ollama.ai/install.sh | sh
ollama pull hermes3:3b
```

### Step 5: Clone the Repository

```bash
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant
```

### Step 6: Install Dependencies

```bash
npm install
```

This will install all required packages. It may take 2-5 minutes.

### Step 7: Configure Environment

```bash
# Copy the example configuration
cp .env.example .env

# Open .env in your favorite text editor
notepad .env      # Windows
nano .env         # Linux/macOS
```

**Edit the following required fields:**

```env
# REQUIRED: Choose AI provider mode
DEFAULT_AI_PROVIDER=auto

# MongoDB (usually default works)
MONGODB_URI=mongodb://localhost:27017/whatsapp_assistant

# Redis (optional, but recommended)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Company Information
COMPANY_NAME=Your Company Name
COMPANY_EMAIL=support@yourcompany.com
COMPANY_PHONE=+1234567890
```

**Optional: Add AI Provider Keys**

```env
# Local Model (FREE - Recommended!)
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b

# OpenAI (Optional)
OPENAI_API_KEY=sk-your-key-here

# Anthropic Claude (Optional)
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 8: Run Setup Script

```bash
npm run setup
```

This will:
- ✅ Verify all dependencies
- ✅ Create necessary directories
- ✅ Initialize the database
- ✅ Test AI connections
- ✅ Validate configuration

### Step 9: Add Knowledge Base (Optional)

```bash
# Create knowledge folder if it doesn't exist
mkdir -p knowledge

# Add your company documents
# Supported formats: .txt, .pdf, .docx, .md
cp /path/to/your/docs/* knowledge/
```

Examples of useful documents:
- Product catalogs
- FAQ documents
- Company policies
- Pricing information
- Service descriptions

### Step 10: Start the Assistant

```bash
# Development mode (with auto-restart)
npm run dev

# Or production mode
npm start
```

### Step 11: Connect WhatsApp

1. **Wait for QR Code**: The terminal will display a QR code
2. **Open WhatsApp** on your phone
3. **Go to Settings** > **Linked Devices**
4. **Tap "Link a Device"**
5. **Scan the QR Code** shown in your terminal
6. **Done!** Your assistant is now active

---

## ⚙️ Configuration

### Basic Configuration

#### 1. AI Provider Setup

**Option A: Use Local Model (FREE!)**
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
```

**Option B: Use OpenAI**
```env
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

**Option C: Use Claude**
```env
DEFAULT_AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
ANTHROPIC_MODEL=claude-3-sonnet-20240229
```

**Option D: Load Balancer (RECOMMENDED!)**
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
```

See [LOAD_BALANCER.md](LOAD_BALANCER.md) for details.

#### 2. Company Information

```env
COMPANY_NAME=Acme Corporation
COMPANY_EMAIL=support@acme.com
COMPANY_PHONE=+1-555-0123
COMPANY_WEBSITE=https://acme.com
COMPANY_ADDRESS=123 Main St, City, State 12345
```

#### 3. Business Hours

```env
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
BUSINESS_HOURS_TIMEZONE=America/New_York
BUSINESS_HOURS_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday
```

#### 4. Assistant Personality

```env
ASSISTANT_NAME=Alex
ASSISTANT_PERSONALITY=friendly, professional, helpful
ASSISTANT_LANGUAGE=en
```

### Advanced Configuration

#### Rate Limiting
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000
```

#### Session Management
```env
SESSION_TIMEOUT=3600000
MAX_CONVERSATION_HISTORY=50
```

#### Knowledge Base
```env
KNOWLEDGE_BASE_ENABLED=true
KNOWLEDGE_BASE_MAX_RESULTS=3
KNOWLEDGE_BASE_MIN_SIMILARITY=0.7
```

#### Webhooks (Optional)
```env
WEBHOOK_ENABLED=false
WEBHOOK_URL=https://your-crm.com/webhook
WEBHOOK_SECRET=your-secret-key
```

---

## 🎯 First Run

### What to Expect

1. **Initialization** (10-30 seconds)
   ```
   🚀 Starting WhatsApp Company Assistant...
   📦 Loading configuration...
   🔌 Connecting to MongoDB...
   ✅ MongoDB connected
   🔌 Connecting to Redis...
   ✅ Redis connected
   🤖 Initializing AI providers...
   ✅ AI providers ready
   ```

2. **WhatsApp Connection**
   ```
   📱 Initializing WhatsApp client...
   
   ████ ▄▄▄▄▄ █▀█ █▄▀▀▀▄▀ ▄▄▄▄▄ ████
   ████ █   █ █▀▄▀█ ▀ ▀█▀ █   █ ████
   ████ █▄▄▄█ █▀ █▄▀█▀▄█ █▄▄▄█ ████
   
   👆 Scan this QR code with WhatsApp
   ```

3. **Ready**
   ```
   ✅ WhatsApp connected!
   🎉 Assistant is now active and ready!
   📊 Dashboard: http://localhost:3000
   ```

### Testing Your Setup

Send a test message to your WhatsApp number:

**Test 1: Basic Response**
```
You: Hi
Bot: Hello! I'm Alex, your virtual assistant. How can I help you today?
```

**Test 2: Knowledge Query**
```
You: What are your business hours?
Bot: We're open Monday-Friday from 9:00 AM to 5:00 PM EST.
```

**Test 3: Multi-turn Conversation**
```
You: I need help with my order
Bot: I'd be happy to help! Could you provide your order number?
You: It's #12345
Bot: Let me look that up for you...
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: QR Code Won't Display

**Solution:**
```bash
# Clear WhatsApp session
rm -rf .wwebjs_auth

# Restart
npm run dev
```

#### Issue: "Cannot connect to MongoDB"

**Solution:**
```bash
# Check if MongoDB is running
mongosh

# If not running, start it
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

#### Issue: "Redis connection failed"

**Solution 1: Disable Redis**
```env
REDIS_ENABLED=false
```

**Solution 2: Start Redis**
```bash
# Windows (Docker)
docker run -d -p 6379:6379 redis

# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

#### Issue: "No AI providers available"

**Solution:**
```bash
# Option 1: Use local model (free)
ollama serve
ollama pull hermes3:3b

# Update .env
LOCAL_MODEL_ENABLED=true

# Option 2: Add API key
OPENAI_API_KEY=sk-your-key
```

#### Issue: "Port 3000 already in use"

**Solution:**
```env
# Change port in .env
PORT=3001
```

#### Issue: AI responses are slow

**Solutions:**
1. Use local model for speed:
   ```env
   DEFAULT_AI_PROVIDER=local
   ```

2. Reduce max tokens:
   ```env
   MAX_TOKENS=500
   ```

3. Disable knowledge base for faster responses:
   ```env
   KNOWLEDGE_BASE_ENABLED=false
   ```

### Getting Help

#### Check Logs
```bash
# View recent logs
tail -f logs/combined.log

# Search for errors
grep ERROR logs/combined.log
```

#### Verify Installation
```bash
npm run setup
```

#### Test AI Connection
```bash
curl http://localhost:3000/health
```

#### Reset Everything
```bash
# ⚠️ WARNING: This deletes all data!

# Stop the app
# Delete sessions
rm -rf .wwebjs_auth

# Clear database
mongo whatsapp_assistant --eval "db.dropDatabase()"

# Reinstall
npm install
npm run setup
```

---

## 🎓 Next Steps

After successful installation:

1. **📚 Read Documentation**
   - [README.md](README.md) - Overview
   - [LOAD_BALANCER.md](LOAD_BALANCER.md) - AI load balancing
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment

2. **🎨 Customize**
   - Add your company knowledge base
   - Customize response templates
   - Configure business modules

3. **🚀 Deploy to Production**
   - See [DEPLOYMENT.md](DEPLOYMENT.md)
   - Set up monitoring
   - Configure backups

4. **📊 Monitor Performance**
   - Access dashboard at `http://localhost:3000/dashboard`
   - Review analytics
   - Optimize based on usage

---

## 💡 Tips for Success

### Cost Optimization
- Use `DEFAULT_AI_PROVIDER=auto` with local models for 30-50% cost savings
- Set appropriate rate limits
- Monitor API usage regularly

### Performance
- Enable Redis for better performance
- Use local models when possible
- Keep knowledge base documents under 10MB total

### Security
- Never commit `.env` file to Git
- Use strong API keys
- Enable rate limiting in production
- Keep dependencies updated

### Maintenance
- Back up database weekly
- Review logs regularly
- Update knowledge base monthly
- Test AI responses periodically

---

## ✅ Installation Checklist

Before going live, verify:

- [ ] Node.js 18+ installed
- [ ] MongoDB running
- [ ] Redis running (optional)
- [ ] Ollama running (if using local models)
- [ ] `.env` file configured
- [ ] AI provider tested
- [ ] WhatsApp connected
- [ ] Test messages work
- [ ] Knowledge base loaded
- [ ] Logs directory created
- [ ] Dashboard accessible

---

## 🆘 Support

Still having issues?

1. **Check existing issues**: [GitHub Issues](https://github.com/yourusername/whatsapp-company-assistant/issues)
2. **Ask for help**: Create a new issue with:
   - Your OS and Node version
   - Error messages from logs
   - Steps to reproduce
3. **Community**: Join our Discord/Slack (coming soon)

---

**Congratulations! You're ready to deploy your WhatsApp Company Assistant!** 🎉

Need help? Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide.
