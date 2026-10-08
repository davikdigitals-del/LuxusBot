# 🔄 Smart AI Provider Switching

Your assistant now **automatically switches** between available AI models!

## How It Works

When you set `DEFAULT_AI_PROVIDER=auto`, the system intelligently tries providers in this order:

```
1️⃣ Hermes (Local) → FREE, FAST, PRIVATE
         ↓ (if unavailable)
2️⃣ OpenAI GPT-4 → POWERFUL, RELIABLE
         ↓ (if unavailable)
3️⃣ Claude → BACKUP, RELIABLE
         ↓ (if unavailable)
4️⃣ Fallback Message
```

## 🎯 Configuration

In your `.env` file:

```env
# Set to 'auto' for smart switching
DEFAULT_AI_PROVIDER=auto

# Enable all providers you have:

# Hermes (Local) - Always free!
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b

# OpenAI - Add your key (optional)
OPENAI_API_KEY=sk-your-key-here

# Claude - Add your key (optional)
ANTHROPIC_API_KEY=your-key-here
```

## 💡 Smart Priority System

### Priority 1: Hermes (Local) 🆓
**Why first?**
- ✅ $0 API costs
- ✅ Fastest (no network latency)
- ✅ 100% private
- ✅ No rate limits

**Will be used when:**
- Ollama is running
- Model is downloaded
- Service is healthy

### Priority 2: OpenAI GPT-4 💪
**Why second?**
- ✅ Most powerful
- ✅ Best quality
- ✅ Latest knowledge
- ⚠️ Costs money

**Will be used when:**
- API key is provided
- Hermes is unavailable
- Service is healthy

### Priority 3: Anthropic Claude 🛡️
**Why third?**
- ✅ Very reliable
- ✅ Great quality
- ✅ Good for long context
- ⚠️ Costs money

**Will be used when:**
- API key is provided
- Hermes and OpenAI unavailable
- Service is healthy

## 📊 Real-World Examples

### Example 1: All Providers Available
```
User sends message
↓
System checks: Hermes available? ✅ YES
↓
Uses Hermes (FREE!)
↓
Cost: $0
```

### Example 2: Hermes Down, OpenAI Available
```
User sends message
↓
System checks: Hermes available? ❌ NO (Ollama not running)
↓
System checks: OpenAI available? ✅ YES
↓
Uses OpenAI GPT-4
↓
Cost: ~$0.01 per message
```

### Example 3: Only Claude Available
```
User sends message
↓
System checks: Hermes available? ❌ NO
System checks: OpenAI available? ❌ NO (no API key)
↓
System checks: Claude available? ✅ YES
↓
Uses Claude
↓
Cost: ~$0.008 per message
```

### Example 4: All Providers Down
```
User sends message
↓
System checks: All unavailable ❌
↓
Sends fallback message:
"I'm experiencing technical difficulties. Please try again or contact support@yourcompany.com"
↓
Cost: $0
```

## 🎮 Usage Scenarios

### Scenario 1: Maximum Savings (Recommended)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-backup-only  # Only for emergencies
```
**Result:** 95% of messages use Hermes (free), 5% use OpenAI (when Hermes fails)
**Monthly cost:** ~$5-10 instead of $100

### Scenario 2: Maximum Reliability
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-your-key
```
**Result:** Always has multiple backups
**Monthly cost:** ~$10-20 (mostly uses free Hermes)

### Scenario 3: Local Only (Privacy Critical)
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
# No cloud API keys
```
**Result:** Never sends data to cloud, fails if Ollama down
**Monthly cost:** $0

### Scenario 4: Cloud Only (Maximum Quality)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=false
OPENAI_API_KEY=sk-your-key
```
**Result:** Uses OpenAI for best quality
**Monthly cost:** $50-200

## 📈 Cost Savings Examples

### 10,000 messages/month

| Configuration | Cost | Savings |
|---------------|------|---------|
| OpenAI only | $100 | $0 |
| Auto (Hermes primary) | $5 | $95 (95%) |
| Hermes only | $0 | $100 (100%) |

### 100,000 messages/month

| Configuration | Cost | Savings |
|---------------|------|---------|
| OpenAI only | $1,000 | $0 |
| Auto (Hermes primary) | $50 | $950 (95%) |
| Hermes only | $0 | $1,000 (100%) |

## 🔍 Monitoring Provider Usage

### Check Which Provider is Being Used

In your logs, you'll see:
```
🤖 Attempting with provider: local
✅ Successfully generated response with local
Model: hermes3:3b
Provider: local
Cost: $0.00
```

### Check Provider Health

Visit the stats endpoint:
```bash
curl http://localhost:3000/api/stats
```

Response:
```json
{
  "aiHealth": {
    "local": {
      "available": true,
      "failures": 0,
      "enabled": true,
      "model": "hermes3:3b"
    },
    "openai": {
      "available": true,
      "failures": 0,
      "enabled": true,
      "model": "gpt-4-turbo-preview"
    },
    "anthropic": {
      "available": false,
      "failures": 0,
      "enabled": false,
      "model": "claude-3-sonnet"
    }
  }
}
```

## 🛠️ Troubleshooting

### Hermes Not Being Used

**Check 1: Is Ollama running?**
```bash
ollama list
```
Should show your model.

**Check 2: Is the model name correct?**
```env
LOCAL_MODEL_NAME=hermes3:3b  # Must match exactly
```

**Check 3: Is local enabled?**
```env
LOCAL_MODEL_ENABLED=true
```

**Check 4: Check logs**
```bash
tail -f logs/combined.log
```
Look for: "🤖 Attempting with provider: local"

### Always Using OpenAI (Want to Use Hermes)

**Cause:** Ollama not running or model not found

**Fix:**
```bash
# Start Ollama
ollama serve

# Verify model exists
ollama list

# Restart your assistant
npm run dev
```

### Want to Force a Specific Provider

```env
# Force Hermes only
DEFAULT_AI_PROVIDER=local

# Force OpenAI only
DEFAULT_AI_PROVIDER=openai

# Force Claude only
DEFAULT_AI_PROVIDER=anthropic

# Smart switching (recommended)
DEFAULT_AI_PROVIDER=auto
```

## 🎯 Best Practices

### For Development
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
# No API keys needed - save money!
```

### For Production (Recommended)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-backup-key
# Primary: Hermes (free)
# Backup: OpenAI (when needed)
```

### For High-Stakes (Max Reliability)
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-your-key
# Triple redundancy!
```

## 📊 Real-Time Switching Example

```
Message 1: "Hello" 
→ Uses Hermes (available, free) ✅

Message 2: "How are you?" 
→ Uses Hermes (available, free) ✅

*Ollama crashes*

Message 3: "Help me with order" 
→ Tries Hermes ❌ (unavailable)
→ Switches to OpenAI ✅ (available)
→ Response sent successfully

*Ollama restarts*

Message 4: "Thank you" 
→ Uses Hermes again ✅ (back online, free)
```

## 🎊 Summary

With `DEFAULT_AI_PROVIDER=auto`, you get:

✅ **Cost Optimization** - Use free Hermes when available
✅ **Reliability** - Automatic fallback to cloud
✅ **Performance** - Fast local responses
✅ **Privacy** - Data stays local when possible
✅ **Zero Downtime** - Always has a backup
✅ **Smart Switching** - Seamless transitions

**Just set it and forget it!** 🚀

---

**Recommendation**: Always use `DEFAULT_AI_PROVIDER=auto` for best results!
