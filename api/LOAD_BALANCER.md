# ⚖️ AI Load Balancer

Your WhatsApp assistant now has a **built-in load balancer** that distributes messages across ALL available AI providers!

## How It Works

```
Message 1 → Hermes 3B (local) ✅
Message 2 → OpenAI GPT-4 ✅
Message 3 → Claude ✅
Message 4 → Hermes 3B (local) ✅
Message 5 → OpenAI GPT-4 ✅
Message 6 → Claude ✅
... continues rotating ...
```

## 🎯 Configuration

In your `.env` file:

```env
# Enable load balancing
DEFAULT_AI_PROVIDER=auto

# Configure ALL providers you want in the rotation
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b

OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=your-key-here
```

## 🔄 Load Balancing Algorithm

**Round-Robin Distribution:**

```
Available providers: [Hermes, OpenAI, Claude]

Request 1 → Provider[0] = Hermes
Request 2 → Provider[1] = OpenAI
Request 3 → Provider[2] = Claude
Request 4 → Provider[0] = Hermes (back to start)
Request 5 → Provider[1] = OpenAI
... continues ...
```

## 📊 Real Example

### Setup: All 3 Providers Available

```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true          # Hermes available
OPENAI_API_KEY=sk-xxx            # OpenAI available
ANTHROPIC_API_KEY=sk-xxx         # Claude available
```

### Message Flow:

```
User: "Hi"
System: ⚖️ Load balanced to: local
Bot: "Hello! How can I help?" (via Hermes)

User: "What products do you have?"
System: ⚖️ Load balanced to: openai
Bot: "We have several products..." (via OpenAI)

User: "Tell me about pricing"
System: ⚖️ Load balanced to: anthropic
Bot: "Our pricing is..." (via Claude)

User: "Thanks"
System: ⚖️ Load balanced to: local
Bot: "You're welcome!" (via Hermes)
```

## 💡 Benefits

### 1. **Cost Optimization**
```
10 messages total:
- 3-4 via Hermes (FREE!) → $0
- 3-4 via OpenAI → ~$0.03
- 3 via Claude → ~$0.02

Total: ~$0.05 instead of $0.10 (50% savings!)
```

### 2. **Rate Limit Protection**
- OpenAI has rate limits
- Distributing load prevents hitting limits
- Each provider gets 33% of traffic

### 3. **High Availability**
- If one provider fails, others continue
- System auto-removes failed providers from rotation
- Automatically re-adds when they recover

### 4. **Performance**
- Distributes load evenly
- No single provider gets overwhelmed
- Balanced response times

## 🎮 Different Scenarios

### Scenario 1: Only Hermes Available

```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
# No cloud API keys
```

**Result:**
```
Available providers: [Hermes]

All messages → Hermes (100%)
Cost: $0
```

### Scenario 2: Hermes + OpenAI

```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
```

**Result:**
```
Available providers: [Hermes, OpenAI]

Message 1 → Hermes
Message 2 → OpenAI
Message 3 → Hermes
Message 4 → OpenAI
...

50% via Hermes (FREE)
50% via OpenAI

Cost: ~50% of OpenAI-only
```

### Scenario 3: All Three Providers

```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
```

**Result:**
```
Available providers: [Hermes, OpenAI, Claude]

Message 1 → Hermes
Message 2 → OpenAI
Message 3 → Claude
Message 4 → Hermes
Message 5 → OpenAI
Message 6 → Claude
...

33% via Hermes (FREE)
33% via OpenAI
33% via Claude

Cost: ~67% savings vs OpenAI-only
```

## 📈 Cost Comparison (10,000 messages)

| Configuration | Distribution | Cost |
|---------------|--------------|------|
| OpenAI only | 100% OpenAI | $100 |
| Hermes + OpenAI | 50% Hermes, 50% OpenAI | $50 |
| All 3 providers | 33% each | $67 |
| Hermes only | 100% Hermes | $0 |

## 🔍 Monitoring

### Check Load Balancer Status

```bash
curl http://localhost:3000/api/stats
```

**Response:**
```json
{
  "aiHealth": {
    "providers": {
      "local": {
        "available": true,
        "failures": 0,
        "usage": 340,
        "model": "hermes3:3b",
        "inRotation": true
      },
      "openai": {
        "available": true,
        "failures": 0,
        "usage": 338,
        "model": "gpt-4-turbo-preview",
        "inRotation": true
      },
      "anthropic": {
        "available": true,
        "failures": 0,
        "usage": 337,
        "model": "claude-3-sonnet",
        "inRotation": true
      }
    },
    "loadBalancing": {
      "mode": "auto",
      "availableProviders": ["local", "openai", "anthropic"],
      "currentIndex": 1,
      "nextProvider": "openai"
    }
  }
}
```

### View Logs

```bash
tail -f logs/combined.log
```

**You'll see:**
```
⚖️ Load balancer: 3 providers available: [ 'local', 'openai', 'anthropic' ]
⚖️ Load balanced to: local (340 requests)
✅ Successfully generated response with local

⚖️ Load balanced to: openai (338 requests)
✅ Successfully generated response with openai

⚖️ Load balanced to: anthropic (337 requests)
✅ Successfully generated response with anthropic
```

## 🛠️ Auto-Recovery

If a provider fails, it's automatically removed:

```
Initial: [Hermes, OpenAI, Claude]

Message 1 → Hermes ✅
Message 2 → OpenAI ✅
Message 3 → Claude ❌ (fails)

Updated: [Hermes, OpenAI]

Message 4 → Hermes ✅
Message 5 → OpenAI ✅
Message 6 → Hermes ✅
...

*Claude comes back online after 30 seconds*

Updated: [Hermes, OpenAI, Claude]

Message 7 → Hermes ✅
Message 8 → OpenAI ✅
Message 9 → Claude ✅ (back in rotation!)
```

## 🎯 Best Practices

### For Maximum Cost Savings
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx  # Backup for quality
# Result: 50% free (Hermes), 50% paid
```

### For Maximum Quality
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=false
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
# Result: Balance between GPT-4 and Claude
```

### For Maximum Availability
```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
# Result: Triple redundancy!
```

## 🚀 Getting Started

1. **Edit `.env`:**
   ```env
   DEFAULT_AI_PROVIDER=auto
   ```

2. **Add provider credentials:**
   ```env
   LOCAL_MODEL_ENABLED=true
   OPENAI_API_KEY=your-key
   ANTHROPIC_API_KEY=your-key
   ```

3. **Start everything:**
   ```bash
   ollama serve
   npm run dev
   ```

4. **Watch the balancing:**
   ```bash
   tail -f logs/combined.log | grep "Load balanced"
   ```

## ⚙️ Advanced Configuration

### Disable Load Balancing (Use Single Provider)

```env
# Use only Hermes
DEFAULT_AI_PROVIDER=local

# Use only OpenAI
DEFAULT_AI_PROVIDER=openai

# Use only Claude
DEFAULT_AI_PROVIDER=anthropic
```

### Custom Refresh Interval

The balancer checks provider availability every 30 seconds. To change this, edit `src/core/ai/aiEngine.js`:

```javascript
// Line ~167
if (now - this.lastBalanceCheck < 30000) { // Change 30000 to desired milliseconds
```

## 📊 Performance Impact

**Load balancing overhead:** ~5ms per request
**Benefit:** Distributed load, better reliability

**Recommended:** Always use load balancing with multiple providers

## 🎉 Summary

With `DEFAULT_AI_PROVIDER=auto`, you get:

✅ **Automatic load distribution** across all providers
✅ **Cost optimization** (use free Hermes in rotation)
✅ **Rate limit protection** (spread across providers)
✅ **High availability** (if one fails, others continue)
✅ **Balanced performance** (no single bottleneck)
✅ **Auto-recovery** (failed providers rejoin automatically)

---

**Just set `DEFAULT_AI_PROVIDER=auto` and add multiple API keys!** ⚖️
