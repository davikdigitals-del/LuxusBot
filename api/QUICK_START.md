# ⚡ Quick Start Guide

**Get your WhatsApp assistant running in 5 minutes!**

## 🎯 For Complete Beginners

Never deployed a Node.js app? No problem! Follow these exact steps:

### Windows Users

```powershell
# 1. Install Node.js (if not installed)
# Download from: https://nodejs.org
# Choose "LTS" version and run the installer

# 2. Install MongoDB (if not installed)
# Download from: https://www.mongodb.com/try/download/community
# Run the installer with default settings

# 3. Clone this project
# Download ZIP from GitHub and extract, OR use Git:
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant

# 4. Install dependencies
npm install

# 5. Run setup wizard
npm run setup
# Follow the prompts - it will ask about:
# - Company name
# - AI provider (choose FREE local model to start)
# - Business hours
# - Assistant name

# 6. Start the assistant
npm run dev

# 7. Scan QR code with WhatsApp
# The terminal will show a QR code
# Open WhatsApp > Settings > Linked Devices > Scan!
```

### Mac/Linux Users

```bash
# 1. Install Node.js (if not installed)
# Mac: brew install node
# Linux: sudo apt install nodejs npm

# 2. Install MongoDB (if not installed)
# Mac: brew install mongodb-community
# Linux: sudo apt install mongodb

# 3. Clone and setup
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant
npm install
npm run setup

# 4. Start!
npm run dev
```

---

## 🆓 Using FREE AI (No API Costs!)

Want to run this completely FREE? Use local Hermes 3B model:

### Install Ollama

**Windows:**
1. Download from https://ollama.ai
2. Run the installer
3. Open PowerShell and run:
   ```
   ollama pull hermes3:3b
   ```

**Mac/Linux:**
```bash
curl https://ollama.ai/install.sh | sh
ollama pull hermes3:3b
```

### Configure for FREE

Edit `.env`:
```env
DEFAULT_AI_PROVIDER=local
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
```

**That's it!** Zero API costs, completely free to run! 🎉

---

## 💰 Using Paid AI (Better Quality)

### Option 1: OpenAI GPT-4

1. Get API key from https://platform.openai.com/api-keys
2. Edit `.env`:
   ```env
   DEFAULT_AI_PROVIDER=openai
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Done!

**Cost**: ~$0.01 per conversation (very affordable)

### Option 2: Anthropic Claude

1. Get API key from https://console.anthropic.com
2. Edit `.env`:
   ```env
   DEFAULT_AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
3. Done!

**Cost**: ~$0.015 per conversation

### Option 3: Load Balanced (Recommended!)

Use all three providers for best value:

```env
DEFAULT_AI_PROVIDER=auto
LOCAL_MODEL_ENABLED=true
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
```

**Benefit**: Saves 30-50% on API costs by mixing free local model with paid services!

---

## 🎨 Customization

### Add Your Company Info

Edit `.env`:

```env
COMPANY_NAME=Acme Corp
COMPANY_EMAIL=support@acme.com
COMPANY_PHONE=+1-555-0123
COMPANY_WEBSITE=https://acme.com
ASSISTANT_NAME=Alex
```

### Add Company Knowledge

Just copy files to `knowledge/` folder:

```bash
# Windows
copy C:\path\to\your\faq.pdf knowledge\
copy C:\path\to\your\products.docx knowledge\

# Mac/Linux
cp /path/to/your/faq.pdf knowledge/
cp /path/to/your/products.docx knowledge/
```

Supported formats:
- ✅ PDF documents
- ✅ Word documents (.docx)
- ✅ Text files (.txt)
- ✅ Markdown files (.md)

The assistant will automatically learn from these documents!

### Change Business Hours

Edit `.env`:

```env
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
BUSINESS_HOURS_TIMEZONE=America/New_York
BUSINESS_HOURS_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday
```

---

## 📱 Connecting WhatsApp

After running `npm run dev`, you'll see a QR code in your terminal.

**On your phone:**

1. Open WhatsApp
2. Tap the 3 dots (⋮) or go to Settings
3. Tap "Linked Devices"
4. Tap "Link a Device"
5. Point your camera at the QR code
6. Done! ✅

**Your assistant is now live!**

---

## ✅ Testing Your Assistant

Send these test messages to your WhatsApp number:

### Test 1: Basic Greeting
```
You: Hi
Bot: Hello! I'm [Your Assistant Name]. How can I help you today?
```

### Test 2: Business Hours
```
You: What are your hours?
Bot: We're open [Your Business Hours]
```

### Test 3: Knowledge Base
```
You: [Ask about something in your documents]
Bot: [Answers based on your knowledge base]
```

### Test 4: Multiple Questions
```
You: I need help
Bot: I'd be happy to help! What do you need assistance with?
You: Product information
Bot: [Provides product details from your documents]
```

---

## 🔧 Common Issues & Fixes

### Issue: QR Code Not Showing

**Fix:**
```bash
# Delete old session
rm -rf .wwebjs_auth    # Mac/Linux
Remove-Item .wwebjs_auth -Recurse -Force    # Windows

# Restart
npm run dev
```

### Issue: "MongoDB connection failed"

**Fix:**

```bash
# Windows - Check if MongoDB is running
net start MongoDB

# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or just disable MongoDB (uses in-memory storage)
# Edit .env:
MONGODB_URI=
```

### Issue: "Module not found"

**Fix:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: AI Not Responding

**Fix:**

1. Check your API key in `.env`
2. Or use FREE local model:
   ```bash
   ollama serve
   ```
3. Check logs: `logs/combined.log`

---

## 📊 View Dashboard

While the assistant is running:

1. Open browser
2. Go to: `http://localhost:3000/dashboard`
3. See real-time analytics:
   - 📈 Message volume
   - ⏱️ Response times
   - 😊 Customer satisfaction
   - 💰 AI costs

---

## 🚀 Deploy to Production

Ready to go live? See [DEPLOYMENT.md](DEPLOYMENT.md) for:

- ☁️ Cloud hosting (AWS, Digital Ocean, Heroku)
- 🐳 Docker deployment
- 🔒 SSL/HTTPS setup
- 📊 Monitoring and alerts
- 💾 Backup strategies

---

## 🆘 Need Help?

### Check Documentation
- 📖 [Complete Installation Guide](INSTALLATION.md)
- 🚀 [Deployment Guide](DEPLOYMENT.md)
- ⚖️ [Load Balancer Info](LOAD_BALANCER.md)

### Check Logs
```bash
# View recent logs
tail -100 logs/combined.log

# Search for errors
grep ERROR logs/combined.log
```

### Get Support
- 🐛 [GitHub Issues](https://github.com/yourusername/whatsapp-company-assistant/issues)
- 📧 Email: support@yourcompany.com
- 💬 [Discord Community](https://discord.gg/yourserver)

---

## 🎓 Next Steps

After basic setup:

1. **📚 Add More Knowledge**
   - Copy more company documents to `knowledge/` folder
   - Restart app to load new documents

2. **🎨 Customize Personality**
   - Edit `.env` → `ASSISTANT_PERSONALITY`
   - Try: "friendly,professional,witty,helpful"

3. **⚖️ Enable Load Balancing**
   - Set `DEFAULT_AI_PROVIDER=auto`
   - Add multiple API keys
   - Save 30-50% on costs!

4. **📊 Monitor Performance**
   - Check dashboard at `localhost:3000/dashboard`
   - Review logs regularly
   - Optimize based on usage

5. **🚀 Deploy to Production**
   - Follow [DEPLOYMENT.md](DEPLOYMENT.md)
   - Set up monitoring
   - Configure backups

---

## 💡 Pro Tips

1. **Start FREE**: Use local Hermes model initially, add paid providers when you scale
2. **Test Thoroughly**: Send 50+ test messages before going live
3. **Monitor Costs**: Check dashboard daily for API usage
4. **Update Knowledge**: Refresh your knowledge base monthly
5. **Backup Regularly**: Backup MongoDB and `.env` weekly
6. **Use Load Balancing**: Can save up to 50% on AI costs
7. **Check Logs**: Review error logs weekly
8. **Version Control**: Commit your customizations to Git

---

## ✅ Success Checklist

Before going live:

- [ ] WhatsApp connected and responsive
- [ ] Test messages working correctly
- [ ] Company information configured
- [ ] Knowledge base loaded
- [ ] Business hours set
- [ ] Dashboard accessible
- [ ] Logs directory created
- [ ] Backup strategy in place
- [ ] Team trained on usage
- [ ] Emergency contacts ready

---

**Congratulations! Your WhatsApp assistant is running!** 🎉

Got questions? Check the [full documentation](README.md) or create an [issue](https://github.com/yourusername/whatsapp-company-assistant/issues).

**Start chatting with your new AI assistant!** 💬🤖
