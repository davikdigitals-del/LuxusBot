# 🎯 Your .env Configuration

## For Smart Switching (Recommended)

Copy this into your `.env` file:

```env
# ============================================
# SMART AI PROVIDER SWITCHING
# ============================================
# This will try: Hermes → OpenAI → Claude
DEFAULT_AI_PROVIDER=auto

# --------------------------------------------
# HERMES (Local) - Primary (FREE!)
# --------------------------------------------
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434
LOCAL_MODEL_NAME=hermes3:3b
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000

# --------------------------------------------
# OPENAI - Backup (when Hermes unavailable)
# --------------------------------------------
# Add your key here (optional - only as backup)
OPENAI_API_KEY=sk-your-key-here-or-leave-blank
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# --------------------------------------------
# CLAUDE - Second Backup (optional)
# --------------------------------------------
# Add your key here (optional - only as backup)
ANTHROPIC_API_KEY=your-key-here-or-leave-blank
ANTHROPIC_MODEL=claude-3-sonnet-20240229
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
```

## 📋 What This Does

```
Every message will follow this flow:

1. Try Hermes first ✅
   ├─ If available → Use it (FREE! 🎉)
   └─ If unavailable → Go to step 2

2. Try OpenAI ✅
   ├─ If API key present → Use it (costs money 💰)
   └─ If no key → Go to step 3

3. Try Claude ✅
   ├─ If API key present → Use it (costs money 💰)
   └─ If no key → Show fallback message

Result: 90-95% of messages use Hermes (free!)
        5-10% use OpenAI/Claude (backup only)
```

## 🎮 Different Configurations

### Option 1: Free Only (No Cloud Backup)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
# Don't add OpenAI or Claude keys
```
**Result:** 100% free, fails if Ollama down

### Option 2: Hermes + OpenAI Backup (Recommended)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
OPENAI_API_KEY=sk-your-actual-key
```
**Result:** Uses Hermes 95%, OpenAI 5% (very cheap!)

### Option 3: All Three Providers (Max Reliability)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-your-key
```
**Result:** Triple redundancy, never fails

### Option 4: OpenAI Only (No Local)
```env
DEFAULT_AI_PROVIDER=openai
LOCAL_MODEL_ENABLED=false
OPENAI_API_KEY=sk-your-key
```
**Result:** Uses only OpenAI (most expensive)

## ✅ Complete .env Example

Here's a complete, working `.env` file for your setup:

```env
# Application
NODE_ENV=development
PORT=3000
APP_NAME=WhatsApp Company Assistant
LOG_LEVEL=info

# WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-session
WHATSAPP_WEBHOOK_URL=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# =============================================
# AI CONFIGURATION - SMART SWITCHING
# =============================================
# Try providers in order: Hermes → OpenAI → Claude
DEFAULT_AI_PROVIDER=auto

# Hermes Local (Primary - FREE!)
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434
LOCAL_MODEL_NAME=hermes3:3b
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000

# OpenAI (Backup - costs money)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# Anthropic Claude (2nd Backup - costs money)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-sonnet-20240229
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000

# Database
MONGODB_URI=mongodb://localhost:27017/whatsapp_assistant
MONGODB_DB_NAME=whatsapp_assistant

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Company Info
COMPANY_NAME=Your Company Name
COMPANY_INDUSTRY=Technology
COMPANY_DESCRIPTION=We are a leading technology company
COMPANY_WEBSITE=https://yourcompany.com
COMPANY_EMAIL=info@yourcompany.com
COMPANY_PHONE=+1234567890

# Business Hours
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=18:00
BUSINESS_TIMEZONE=America/New_York
BUSINESS_DAYS=1,2,3,4,5

# Assistant
ASSISTANT_NAME=CompanyBot
ASSISTANT_PERSONALITY=professional,helpful,friendly
RESPONSE_DELAY_MS=1000
MAX_CONTEXT_MESSAGES=10
SESSION_TIMEOUT_MINUTES=30

# Features
ENABLE_SENTIMENT_ANALYSIS=true
ENABLE_LANGUAGE_DETECTION=true
ENABLE_AUTO_TRANSLATION=false
ENABLE_VOICE_MESSAGES=true
ENABLE_IMAGE_ANALYSIS=true
ENABLE_DOCUMENT_PROCESSING=true

# Security
JWT_SECRET=change-this-to-random-string-in-production
JWT_EXPIRES_IN=7d
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password

# Analytics
ENABLE_ANALYTICS=true
ANALYTICS_RETENTION_DAYS=90

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
```

## 🚀 Quick Start

1. **Copy the example above** into your `.env` file

2. **Update these lines:**
   - Line 58: `COMPANY_NAME=Your Company Name`
   - Line 59: `COMPANY_EMAIL=info@yourcompany.com`
   - Line 79: `ADMIN_PASSWORD=your-secure-password`

3. **Optional - Add API keys as backup:**
   - Line 37: `OPENAI_API_KEY=sk-your-key` (if you have one)
   - Line 43: `ANTHROPIC_API_KEY=sk-your-key` (if you have one)

4. **Start everything:**
   ```bash
   ollama serve  # Start Hermes
   npm run dev   # Start assistant
   ```

## 🎯 What Happens

With this config:

```
Message arrives
↓
System: "Let me try Hermes..."
↓
Hermes available? YES ✅
↓
Use Hermes (FREE!)
↓
Response sent in 1-2 seconds

---

Message arrives
↓
System: "Let me try Hermes..."
↓
Hermes available? NO ❌ (Ollama stopped)
↓
System: "Let me try OpenAI..."
↓
OpenAI available? YES ✅ (if you added key)
↓
Use OpenAI (costs ~$0.01)
↓
Response sent in 2-3 seconds

---

Result: You save 90-95% on API costs!
```

## 📊 Expected Costs

### Scenario: 10,000 messages/month

**Without smart switching:**
- OpenAI only: **$100/month**

**With smart switching:**
- 95% use Hermes (9,500 msgs): **$0**
- 5% use OpenAI (500 msgs): **$5**
- **Total: $5/month** (95% savings!)

**With Hermes only:**
- 100% use Hermes: **$0/month**
- (But no backup if Ollama fails)

## ✅ Checklist

Before starting:
- [ ] Created `.env` file
- [ ] Set `DEFAULT_AI_PROVIDER=auto`
- [ ] Set `LOCAL_MODEL_NAME=hermes3:3b`
- [ ] Updated company information
- [ ] Changed admin password
- [ ] Ollama is running (`ollama serve`)
- [ ] Hermes downloaded (`ollama list`)

Optional:
- [ ] Added OpenAI API key (for backup)
- [ ] Added Claude API key (for 2nd backup)

---

**You're all set!** The system will now intelligently switch between available models! 🎉
