# 🚀 Quick Start with Hermes (Local Model)

Get your WhatsApp assistant running with **Hermes 3** local model in **5 minutes** - **zero API costs**!

## Why Hermes?

✅ **Best-in-class** local model for chat & instructions
✅ **Function calling** support built-in
✅ **100% free** - no API costs ever
✅ **Private** - all data stays on your machine
✅ **Fast** - runs on regular hardware

## Step 1: Install Ollama (1 minute)

### Windows
Download and install: https://ollama.com/download/windows

### macOS/Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## Step 2: Download Hermes (2 minutes)

```bash
# Best option: Hermes 3 (8B parameters)
ollama pull hermes3:latest

# This will download ~4.7GB
# Wait for: "success"
```

## Step 3: Configure Your Assistant (1 minute)

Edit `.env` file:

```env
# Use local Hermes model (NO API KEY NEEDED!)
DEFAULT_AI_PROVIDER=local

LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_URL=http://localhost:11434
LOCAL_MODEL_NAME=hermes3:latest
LOCAL_MODEL_TEMPERATURE=0.7
LOCAL_MODEL_MAX_TOKENS=2000

# Optional: Keep OpenAI as backup
OPENAI_API_KEY=sk-your-key-here  # Only used if local fails
```

## Step 4: Start Everything (1 minute)

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Terminal 3: Start your assistant
npm install
npm run dev
```

## Step 5: Connect WhatsApp (30 seconds)

1. Scan the QR code with WhatsApp
2. Send a test message
3. **Done!** Your assistant is now running 100% locally!

## Test Your Setup

Send messages to your WhatsApp:

```
You: Hi
Bot: 👋 Hello! I'm your AI assistant powered by Hermes 3...

You: What can you do?
Bot: I can help with:
🛒 Product information
📦 Order tracking
📅 Appointment scheduling
💬 Customer support
...
```

## Performance Tips

### Speed Up Responses

```bash
# Use quantized version (faster)
ollama pull hermes3:8b-llama3.1-q4_K_M

# Update .env:
LOCAL_MODEL_NAME=hermes3:8b-llama3.1-q4_K_M
```

### Reduce Memory Usage

```bash
# Use smaller model (only 3.8B)
ollama pull phi3:latest

# Update .env:
LOCAL_MODEL_NAME=phi3:latest
```

## Check Status

### Is Ollama running?
```bash
ollama list
```

Should show:
```
NAME            SIZE    MODIFIED
hermes3:latest  4.7 GB  2 minutes ago
```

### Test generation
```bash
ollama run hermes3
>>> Say hello!
Hello! How can I assist you today?
```

## Common Issues

### "Cannot connect to local model"

**Fix:**
```bash
# Start Ollama
ollama serve

# Keep this terminal open!
```

### "Model not found"

**Fix:**
```bash
# Check installed models
ollama list

# Pull Hermes if not installed
ollama pull hermes3:latest
```

### Slow responses

**Fix:**
```bash
# Use faster quantized model
ollama pull hermes3:8b-llama3.1-q4_K_M

# Or smaller model
ollama pull phi3:latest
```

## Alternative Models

Try different models based on your needs:

```bash
# Speed priority (1.1GB)
ollama pull tinyllama

# Balance (3GB)
ollama pull llama3.2:3b

# Quality priority (4.7GB)
ollama pull hermes3:latest

# Multilingual (4.7GB)
ollama pull qwen2.5:latest
```

## Monitoring

Check performance:
```bash
curl http://localhost:3000/api/stats
```

You'll see:
- Model: `hermes3:latest`
- Provider: `local`
- Cost: **$0.00** (always!)
- Response time
- Token usage

## Benefits vs Cloud APIs

| Feature | Hermes (Local) | OpenAI GPT-4 |
|---------|----------------|--------------|
| **Cost** | $0/month | $30-100/month |
| **Privacy** | 100% private | Sent to OpenAI |
| **Speed** | Fast | Variable |
| **Limits** | Unlimited | Rate limited |
| **Offline** | ✅ Works | ❌ Needs internet |
| **Control** | Full | Limited |

## Next Steps

1. **Add company knowledge**: Put documents in `knowledge/` folder
2. **Customize personality**: Edit `ASSISTANT_PERSONALITY` in `.env`
3. **Test all modules**: Try customer service, sales, HR, scheduling
4. **Monitor performance**: Check `/api/stats` endpoint

## Need Help?

- Hermes 3 info: https://ollama.com/library/hermes3
- Ollama docs: https://ollama.com/
- Model list: https://ollama.com/library
- Project docs: See `README.md`

---

**Congratulations!** 🎉

You're now running a powerful AI assistant with:
- ✅ **Zero API costs**
- ✅ **Complete privacy**
- ✅ **Unlimited usage**
- ✅ **Professional quality responses**

Your assistant uses **Hermes 3**, one of the best local models available!

**Total monthly cost: $0** 💰
