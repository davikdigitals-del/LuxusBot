# 📝 Where to Configure Hermes

## Quick Guide: Edit `.env` File

### Step 1: Create `.env` file

```bash
# Copy the example file
cp .env.example .env
```

### Step 2: Open `.env` in your editor

Look for these sections and update them:

---

## 🎯 Section 1: Choose Your AI Provider (Line ~26)

```env
# DEFAULT_AI_PROVIDER Options:
# - 'local' = Use only Hermes (100% free, private)
# - 'auto' = Try Hermes first, backup to OpenAI if needed
# - 'openai' = Use only OpenAI GPT-4
# - 'anthropic' = Use only Claude

DEFAULT_AI_PROVIDER=local
```

**Recommended**: `local` for free or `auto` for reliability

---

## 🎯 Section 2: Hermes Configuration (Line ~28-35)

```env
# Enable local model
LOCAL_MODEL_ENABLED=true

# Ollama URL (don't change unless using LM Studio)
LOCAL_MODEL_URL=http://localhost:11434

# Model name (must match what you downloaded)
LOCAL_MODEL_NAME=hermes3:latest

# AI settings (adjust for your needs)
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000
```

---

## 🎯 Section 3: OpenAI (Optional - for hybrid mode)

```env
# Only needed if using 'auto' mode as backup
OPENAI_API_KEY=sk-your-key-here  # Leave blank if only using Hermes
OPENAI_MODEL=gpt-4-turbo-preview
```

**Note**: You can leave this blank if using only Hermes!

---

## 📋 Complete Example `.env` for Hermes Only

Here's what your `.env` should look like for **Hermes-only** setup:

```env
# Application
NODE_ENV=development
PORT=3000
APP_NAME=WhatsApp Company Assistant
LOG_LEVEL=info

# WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-session

# AI Configuration - HERMES LOCAL
DEFAULT_AI_PROVIDER=local

# OpenAI (not needed for local-only, but keep for future)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4-turbo-preview

# Local Model - HERMES 3
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434
LOCAL_MODEL_NAME=hermes3:latest
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000

# Database
MONGODB_URI=mongodb://localhost:27017/whatsapp_assistant
MONGODB_DB_NAME=whatsapp_assistant

# Company Info
COMPANY_NAME=Your Company Name
COMPANY_EMAIL=support@yourcompany.com

# Security
JWT_SECRET=change-this-to-random-string
ADMIN_PASSWORD=change-this-password
```

---

## 🔍 Key Lines to Change

**Must change:**
1. Line ~26: `DEFAULT_AI_PROVIDER=local`
2. Line ~30: `LOCAL_MODEL_ENABLED=true`
3. Line ~32: `LOCAL_MODEL_NAME=hermes3:latest`
4. Line ~50+: `COMPANY_NAME=Your Company Name`
5. Line ~80+: `ADMIN_PASSWORD=your-secure-password`

**Optional (can leave as-is):**
- `LOCAL_MODEL_URL=http://localhost:11434` (only change if using LM Studio)
- `LOCAL_MODEL_TEMPERATURE=0.7` (0.5 = more focused, 0.9 = more creative)
- `LOCAL_MODEL_MAX_TOKENS=2000` (increase for longer responses)

---

## 🎨 Visual Guide

```
.env file structure:
├── [Lines 1-10] Basic app settings
├── [Lines 11-25] WhatsApp config
├── [Lines 26-35] ⭐ AI & HERMES CONFIG ⭐ (EDIT THIS!)
├── [Lines 36-45] Database settings
├── [Lines 46-60] Company information
└── [Lines 61+] Other features
```

---

## 🚦 Quick Test

After editing `.env`, test your configuration:

```bash
# 1. Make sure Ollama is running
ollama serve

# 2. Check if Hermes is downloaded
ollama list
# Should show: hermes3:latest

# 3. Start your assistant
npm run dev

# 4. Look for this log:
# "Using AI provider: local"
# "Model: hermes3:latest"
```

---

## 🔧 Troubleshooting

### Can't find `.env` file?
```bash
# Create it from example
cp .env.example .env

# Or on Windows:
copy .env.example .env
```

### Model not found?
```bash
# Download Hermes first
ollama pull hermes3:latest

# Then update .env
LOCAL_MODEL_NAME=hermes3:latest
```

### Want to try different model?
```bash
# Download another model
ollama pull llama3.2:latest

# Update .env
LOCAL_MODEL_NAME=llama3.2:latest
```

---

## 📱 Different Configurations

### Configuration 1: Hermes Only (100% Free)
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=  # Leave blank
```

### Configuration 2: Hybrid (Best Value)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-your-key-here  # Add key
```

### Configuration 3: OpenAI Only (Most Powerful)
```env
DEFAULT_AI_PROVIDER=openai
LOCAL_MODEL_ENABLED=false
OPENAI_API_KEY=sk-your-key-here  # Required
```

---

## ✅ Final Checklist

- [ ] Created `.env` file from `.env.example`
- [ ] Set `DEFAULT_AI_PROVIDER=local`
- [ ] Set `LOCAL_MODEL_ENABLED=true`
- [ ] Set `LOCAL_MODEL_NAME=hermes3:latest`
- [ ] Updated company information
- [ ] Changed admin password
- [ ] Ollama is running (`ollama serve`)
- [ ] Hermes downloaded (`ollama pull hermes3:latest`)

---

**You're ready!** Start the assistant with `npm run dev` 🚀

For more help:
- See `HERMES_QUICKSTART.md` for full setup
- See `LOCAL_MODEL_SETUP.md` for advanced options
