# 🚀 Production Deployment Guide

Complete guide for deploying the WhatsApp Company Assistant to production environments.

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Options](#deployment-options)
3. [Cloud Providers](#cloud-providers)
4. [Environment Setup](#environment-setup)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Scaling](#scaling)
7. [Security](#security)

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

### Application Readiness
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Knowledge base loaded and tested
- [ ] Business logic validated
- [ ] Rate limiting configured
- [ ] Error handling tested
- [ ] Logs properly configured

### Infrastructure Readiness
- [ ] Database backup strategy in place
- [ ] Monitoring tools configured
- [ ] SSL certificates ready
- [ ] Domain name configured
- [ ] Firewall rules defined
- [ ] Backup servers provisioned

### Security Readiness
- [ ] API keys secured
- [ ] Authentication configured
- [ ] Rate limiting enabled
- [ ] Input validation tested
- [ ] Security headers configured
- [ ] HTTPS enforced

---

## 🎯 Deployment Options

### Option 1: VPS (Digital Ocean, Linode, Vultr)
**Best for**: Small to medium deployments, full control

**Pros:**
- ✅ Full server control
- ✅ Predictable pricing
- ✅ Easy to manage

**Cons:**
- ❌ Manual scaling
- ❌ Requires DevOps knowledge

### Option 2: Platform as a Service (Heroku, Railway, Render)
**Best for**: Quick deployments, minimal DevOps

**Pros:**
- ✅ One-click deployment
- ✅ Automatic scaling
- ✅ Built-in monitoring

**Cons:**
- ❌ Higher cost at scale
- ❌ Less control

### Option 3: Cloud Native (AWS, GCP, Azure)
**Best for**: Enterprise, high scalability

**Pros:**
- ✅ Unlimited scaling
- ✅ Global availability
- ✅ Enterprise features

**Cons:**
- ❌ Complex setup
- ❌ Higher learning curve
- ❌ Variable pricing

### Option 4: Containerized (Docker, Kubernetes)
**Best for**: Multi-environment, microservices

**Pros:**
- ✅ Consistent environments
- ✅ Easy replication
- ✅ Horizontal scaling

**Cons:**
- ❌ Container orchestration complexity
- ❌ Infrastructure overhead

---

## ☁️ Cloud Provider Setup

### Digital Ocean (Recommended for Beginners)

#### Step 1: Create Droplet

```bash
# Use Ubuntu 22.04 LTS
# Minimum: 2GB RAM, 2 vCPUs, 50GB SSD
# Recommended: 4GB RAM, 2 vCPUs, 80GB SSD
```

#### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser whatsapp
usermod -aG sudo whatsapp
su - whatsapp
```

#### Step 3: Install Dependencies

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Install Ollama (for local models)
curl https://ollama.ai/install.sh | sh
ollama pull hermes3:3b

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### Step 4: Deploy Application

```bash
# Clone repository
git clone https://github.com/yourusername/whatsapp-company-assistant.git
cd whatsapp-company-assistant

# Install dependencies
npm install --production

# Setup environment
cp .env.example .env
nano .env
# Configure your environment variables

# Setup PM2
pm2 start src/index.js --name whatsapp-assistant
pm2 save
pm2 startup
```

#### Step 5: Configure Firewall

```bash
# Enable UFW
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw enable
```

#### Step 6: Setup Nginx (Optional)

```bash
# Install Nginx
sudo apt install -y nginx

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/whatsapp-assistant

# Add this configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 7: SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Heroku Deployment

#### Step 1: Install Heroku CLI

```bash
# Install
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login
```

#### Step 2: Create Application

```bash
# In your project directory
heroku create your-app-name

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Add Redis addon
heroku addons:create heroku-redis:hobby-dev
```

#### Step 3: Configure Environment

```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DEFAULT_AI_PROVIDER=auto
heroku config:set OPENAI_API_KEY=your-key
# ... set all required variables
```

#### Step 4: Create Procfile

```bash
# Create Procfile
echo "web: node src/index.js" > Procfile
```

#### Step 5: Deploy

```bash
# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# View logs
heroku logs --tail
```

### AWS Deployment

#### Option A: EC2 (Virtual Machine)

Follow the same steps as Digital Ocean, but:
1. Create EC2 instance (Ubuntu 22.04)
2. Configure Security Groups (allow ports 22, 80, 443, 3000)
3. Allocate Elastic IP
4. Follow VPS setup steps above

#### Option B: ECS (Docker Containers)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/whatsapp_assistant
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped

volumes:
  mongo-data:
  ollama-data:
```

Deploy to ECS:
```bash
# Build and push
docker-compose build
docker-compose push

# Deploy to ECS (configure through AWS Console or CLI)
```

---

## ⚙️ Environment Setup

### Production Environment Variables

```env
# ============================================
# PRODUCTION CONFIGURATION
# ============================================

NODE_ENV=production

# ============================================
# APPLICATION
# ============================================
PORT=3000
LOG_LEVEL=info

# ============================================
# DATABASE
# ============================================
MONGODB_URI=mongodb://user:pass@host:27017/whatsapp_assistant?authSource=admin
REDIS_ENABLED=true
REDIS_URL=redis://:password@host:6379

# ============================================
# AI PROVIDERS (Load Balanced)
# ============================================
DEFAULT_AI_PROVIDER=auto

# Local Model (Primary - FREE!)
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_NAME=hermes3:3b
LOCAL_MODEL_BASE_URL=http://localhost:11434

# OpenAI (Fallback)
OPENAI_API_KEY=sk-your-production-key
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=1000

# Anthropic (Fallback)
ANTHROPIC_API_KEY=sk-ant-your-production-key
ANTHROPIC_MODEL=claude-3-sonnet-20240229
ANTHROPIC_MAX_TOKENS=1000

# ============================================
# COMPANY INFORMATION
# ============================================
COMPANY_NAME=Your Company
COMPANY_EMAIL=support@yourcompany.com
COMPANY_PHONE=+1234567890
COMPANY_WEBSITE=https://yourcompany.com

# ============================================
# ASSISTANT CONFIGURATION
# ============================================
ASSISTANT_NAME=Alex
ASSISTANT_PERSONALITY=professional, helpful, efficient
ASSISTANT_LANGUAGE=en

# ============================================
# BUSINESS HOURS
# ============================================
BUSINESS_HOURS_START=09:00
BUSINESS_HOURS_END=17:00
BUSINESS_HOURS_TIMEZONE=America/New_York
BUSINESS_HOURS_DAYS=Monday,Tuesday,Wednesday,Thursday,Friday

# ============================================
# SECURITY
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=20
RATE_LIMIT_WINDOW_MS=60000

# ============================================
# FEATURES
# ============================================
KNOWLEDGE_BASE_ENABLED=true
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-crm.com/webhook
WEBHOOK_SECRET=your-webhook-secret

# ============================================
# MONITORING
# ============================================
SENTRY_DSN=https://your-sentry-dsn
ANALYTICS_ENABLED=true
```

---

## 📊 Monitoring & Maintenance

### Application Monitoring

#### Using PM2

```bash
# View status
pm2 status

# View logs
pm2 logs whatsapp-assistant

# Monitor resources
pm2 monit

# Restart
pm2 restart whatsapp-assistant

# Stop
pm2 stop whatsapp-assistant
```

#### Using systemd (Alternative to PM2)

```bash
# Create service file
sudo nano /etc/systemd/system/whatsapp-assistant.service

# Add:
[Unit]
Description=WhatsApp Company Assistant
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=whatsapp
WorkingDirectory=/home/whatsapp/whatsapp-company-assistant
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable whatsapp-assistant
sudo systemctl start whatsapp-assistant

# View logs
sudo journalctl -u whatsapp-assistant -f
```

### Database Monitoring

#### MongoDB

```bash
# Check status
sudo systemctl status mongod

# Monitor performance
mongo --eval "db.serverStatus()"

# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://localhost:27017/whatsapp_assistant" --out=/backups/mongo_$DATE
find /backups -name "mongo_*" -mtime +7 -exec rm -rf {} \;
```

#### Redis

```bash
# Check status
redis-cli ping

# Monitor
redis-cli monitor

# Get info
redis-cli info
```

### Log Management

```bash
# Rotate logs
sudo nano /etc/logrotate.d/whatsapp-assistant

# Add:
/home/whatsapp/whatsapp-company-assistant/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 whatsapp whatsapp
}
```

### Health Checks

```bash
# Create healthcheck script
nano healthcheck.sh

#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response != "200" ]; then
    echo "Health check failed: $response"
    pm2 restart whatsapp-assistant
    # Send alert
fi

# Add to crontab
crontab -e
*/5 * * * * /home/whatsapp/healthcheck.sh
```

---

## 📈 Scaling

### Vertical Scaling (Increase Resources)

```bash
# Digital Ocean: Resize droplet through dashboard
# AWS: Change EC2 instance type
# Heroku: heroku ps:resize web=standard-2x
```

### Horizontal Scaling (Multiple Instances)

#### Using PM2 Cluster Mode

```bash
# Start in cluster mode
pm2 start src/index.js -i max --name whatsapp-assistant

# Or specific number of instances
pm2 start src/index.js -i 4 --name whatsapp-assistant
```

#### Using Load Balancer

```nginx
# Nginx load balancer config
upstream whatsapp_backend {
    least_conn;
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    server localhost:3004;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://whatsapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Database Scaling

#### MongoDB Replication

```bash
# Convert to replica set
mongosh
rs.initiate()
rs.add("mongo2.yourcompany.com:27017")
rs.add("mongo3.yourcompany.com:27017")
```

#### Redis Clustering

```bash
# Configure Redis cluster
# See: https://redis.io/topics/cluster-tutorial
```

---

## 🔒 Security

### Security Checklist

- [ ] **Firewall configured** (only necessary ports open)
- [ ] **SSL/TLS enabled** (HTTPS only)
- [ ] **API keys secured** (never in code, use env vars)
- [ ] **Rate limiting enabled**
- [ ] **Input validation** on all endpoints
- [ ] **SQL injection protection** (using Mongoose ORM)
- [ ] **XSS protection** (sanitized inputs)
- [ ] **CSRF protection** (for web dashboard)
- [ ] **Regular updates** (dependencies, OS packages)
- [ ] **Backup strategy** implemented
- [ ] **Monitoring alerts** configured
- [ ] **Access logs** enabled and reviewed

### Security Headers

```javascript
// Add to Express app
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  }
}));
```

### Regular Maintenance

```bash
# Update OS packages (monthly)
sudo apt update && sudo apt upgrade -y

# Update Node packages (monthly)
npm audit
npm update

# Review logs (weekly)
tail -n 1000 logs/error.log | grep ERROR

# Database optimization (monthly)
mongo whatsapp_assistant --eval "db.runCommand({compact: 'conversations'})"

# Restart services (weekly)
pm2 restart whatsapp-assistant
```

---

## 🎯 Performance Optimization

### Application Level

```env
# Optimize AI responses
MAX_TOKENS=500                    # Reduce for faster responses
TEMPERATURE=0.7                   # Lower = more consistent, faster

# Enable caching
REDIS_ENABLED=true
CACHE_TTL=3600                    # Cache responses for 1 hour

# Knowledge base optimization
KNOWLEDGE_BASE_MAX_RESULTS=3     # Fewer results = faster
KNOWLEDGE_BASE_MIN_SIMILARITY=0.75  # Higher threshold = fewer matches
```

### Database Level

```javascript
// Add indexes in MongoDB
db.conversations.createIndex({ userId: 1, createdAt: -1 });
db.messages.createIndex({ conversationId: 1, timestamp: -1 });
db.users.createIndex({ phoneNumber: 1 }, { unique: true });
```

### Server Level

```bash
# Increase Node.js memory limit
pm2 start src/index.js --name whatsapp-assistant --node-args="--max-old-space-size=4096"

# Optimize MongoDB
sudo nano /etc/mongod.conf
# Increase wiredTiger cache size
```

---

## 📞 Support & Troubleshooting

### Common Production Issues

#### High Memory Usage
```bash
# Check memory
free -h
pm2 monit

# Solution: Increase server RAM or reduce max_tokens
```

#### Slow Response Times
```bash
# Check AI provider status
curl http://localhost:3000/api/health

# Solution: Use local models or enable load balancing
```

#### WhatsApp Disconnects
```bash
# Check logs
pm2 logs whatsapp-assistant | grep "disconnected"

# Solution: Restart application, re-scan QR code
```

### Emergency Procedures

#### Application Crash
```bash
pm2 restart whatsapp-assistant
pm2 logs whatsapp-assistant --err
```

#### Database Connection Lost
```bash
sudo systemctl restart mongod
pm2 restart whatsapp-assistant
```

#### Out of Disk Space
```bash
# Clean old logs
find logs/ -name "*.log" -mtime +7 -delete

# Clean MongoDB journal
mongo admin --eval "db.runCommand({cleanupOrphaned: 1})"

# Clean Docker images (if using Docker)
docker system prune -a
```

---

## ✅ Deployment Checklist

Final checklist before going live:

- [ ] Application tested end-to-end
- [ ] All environment variables set
- [ ] Database backups automated
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Documentation updated
- [ ] Team trained
- [ ] Rollback plan ready
- [ ] Support contacts prepared

---

**Your WhatsApp Assistant is now production-ready!** 🚀

Questions? Create an issue or check [INSTALLATION.md](INSTALLATION.md) for setup details.
