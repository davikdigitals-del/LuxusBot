# 🚀 Quick Start Guide

Get your WhatsApp Company Assistant up and running in **5 minutes**!

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ MongoDB running (local or cloud)
- ✅ OpenAI API key (get from https://platform.openai.com/)
- ✅ WhatsApp account

## Step-by-Step Setup

### 1️⃣ Install Dependencies (1 min)

```bash
npm install
```

### 2️⃣ Configure Environment (2 min)

**Option A: Automated Setup (Recommended)**
```bash
npm run setup
```
Follow the prompts to configure your assistant.

**Option B: Manual Setup**
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
```env
# Required - Get from https://platform.openai.com/
OPENAI_API_KEY=sk-your-key-here

# Your Company Info
COMPANY_NAME=Your Company Name
COMPANY_EMAIL=support@yourcompany.com
COMPANY_PHONE=+1234567890

# Admin Password
ADMIN_PASSWORD=change-this-secure-password
```

### 3️⃣ Start MongoDB (30 seconds)

**If using Docker:**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**If MongoDB is already running:**
Skip this step ✅

**Using MongoDB Atlas (cloud):**
Update `MONGODB_URI` in `.env` with your connection string

### 4️⃣ Initialize Database (30 seconds)

```bash
npm run migrate
```

### 5️⃣ Start the Assistant (30 seconds)

```bash
npm run dev
```

You should see:
```
🚀 Initializing WhatsApp Company Assistant...
✅ Connected to MongoDB
✅ Core components initialized
✅ WhatsApp client initialized
📱 QR Code ready - scan with WhatsApp
```

### 6️⃣ Connect WhatsApp (30 seconds)

1. **Open WhatsApp on your phone**
2. **Go to**: Settings → Linked Devices → Link a Device
3. **Scan the QR code** shown in your terminal
4. **Wait for**: "✅ WhatsApp client is ready!"

## 🎉 Test Your Assistant!

Send a message to your WhatsApp number:

```
You: Hi
Bot: 👋 Welcome to Your Company Name Assistant!

I'm here to help you with:
🛒 Product information and purchases
📦 Order tracking and delivery
📅 Appointment scheduling
💬 Customer support

Just send me a message and I'll assist you! 😊
```

## ⚙️ Optional: Add Knowledge Base

Add company information so your assistant can answer questions:

1. **Add a text file** to the `knowledge/` folder:

```bash
echo "## Products

Our flagship Product A includes:
- Feature 1
- Feature 2
- Starting at $99/month

Contact sales@yourcompany.com for details." > knowledge/products.txt
```

2. **Restart the assistant** to load the new knowledge

## 🐳 Alternative: Docker Setup

**One command to start everything:**

```bash
# Edit .env first, then:
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

## 📊 Verify Installation

Check the health endpoint:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "ok",
  "service": "WhatsApp Company Assistant",
  "version": "1.0.0"
}
```

## 🎯 Next Steps

1. **Customize personality**: Edit `ASSISTANT_PERSONALITY` in `.env`
2. **Add more knowledge**: Place documents in `knowledge/` folder
3. **Configure modules**: Enable/disable features in `.env`
4. **Set business hours**: Update `BUSINESS_HOURS_*` variables
5. **Review logs**: Check `logs/combined.log` for activity

## 🔍 Troubleshooting

### ❌ "Cannot connect to MongoDB"
```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Or start it
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### ❌ "OpenAI API error"
- Verify your API key in `.env`
- Check your OpenAI account has credits
- Test at: https://platform.openai.com/playground

### ❌ "QR code not appearing"
- Wait 30 seconds for initialization
- Check terminal output for errors
- Delete `whatsapp-session/` folder and restart

### ❌ "WhatsApp won't connect"
- Ensure WhatsApp is installed on your phone
- Check your internet connection
- Try deleting `whatsapp-session/` and rescanning

## 📚 Full Documentation

- **Detailed Usage**: See `USAGE.md`
- **Deployment Guide**: See `DEPLOYMENT.md`
- **API Reference**: See `USAGE.md` → API Reference
- **Project Overview**: See `PROJECT_SUMMARY.md`

## 💬 Common Commands

```bash
# Start development mode
npm run dev

# Start production mode
npm start

# Run setup wizard
npm run setup

# Run database migrations
npm run migrate

# View logs
tail -f logs/combined.log

# View errors only
tail -f logs/error.log
```

## 🎊 You're Ready!

Your high-IQ WhatsApp assistant is now running!

**Features you can use right away:**
- ✅ Intelligent conversations with GPT-4
- ✅ Context-aware responses
- ✅ Multiple business modules
- ✅ Knowledge base search
- ✅ Session management
- ✅ Multi-language support
- ✅ Sentiment analysis

**Send your first message and start chatting!** 🚀

---

Need help? Check the troubleshooting section or review the full documentation.

**Happy building! 🎉**
