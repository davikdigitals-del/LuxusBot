import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
  console.log('🚀 WhatsApp Company Assistant Setup\n');
  console.log('This script will help you configure your assistant.\n');
  
  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }
  
  console.log('\n📝 Please provide the following information:\n');
  
  // Gather configuration
  const config = {};
  
  // Company Information
  console.log('--- Company Information ---');
  config.COMPANY_NAME = await question('Company Name: ');
  config.COMPANY_INDUSTRY = await question('Industry (e.g., Technology, Healthcare): ');
  config.COMPANY_DESCRIPTION = await question('Brief description: ');
  config.COMPANY_WEBSITE = await question('Website URL: ');
  config.COMPANY_EMAIL = await question('Contact Email: ');
  config.COMPANY_PHONE = await question('Contact Phone: ');
  
  // AI Configuration
  console.log('\n--- AI Configuration ---');
  config.ANTHROPIC_API_KEY = await question('Anthropic API Key (required): ');
  config.DEFAULT_AI_PROVIDER = 'anthropic';
  
  // Database Configuration
  console.log('\n--- Database Configuration ---');
  const mongoUri = await question('MongoDB URI [mongodb://localhost:27017/whatsapp_assistant]: ');
  config.MONGODB_URI = mongoUri || 'mongodb://localhost:27017/whatsapp_assistant';
  
  const redisHost = await question('Redis Host [localhost]: ');
  config.REDIS_HOST = redisHost || 'localhost';
  
  // Assistant Configuration
  console.log('\n--- Assistant Configuration ---');
  const assistantName = await question('Assistant Name [CompanyBot]: ');
  config.ASSISTANT_NAME = assistantName || 'CompanyBot';
  
  const personality = await question('Personality traits (comma-separated) [professional,helpful,friendly]: ');
  config.ASSISTANT_PERSONALITY = personality || 'professional,helpful,friendly';
  
  // Security - cryptographically random, not exposed to Anthropic-adjacent Math.random()
  console.log('\n--- Security Configuration ---');
  config.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  config.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
  config.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  console.log('Generated JWT_SECRET, JWT_REFRESH_SECRET, and ENCRYPTION_KEY (not printed - written straight to .env)');
  
  // Business Hours
  console.log('\n--- Business Hours ---');
  const businessStart = await question('Start time (HH:MM) [09:00]: ');
  config.BUSINESS_HOURS_START = businessStart || '09:00';
  
  const businessEnd = await question('End time (HH:MM) [18:00]: ');
  config.BUSINESS_HOURS_END = businessEnd || '18:00';
  
  const timezone = await question('Timezone [America/New_York]: ');
  config.BUSINESS_TIMEZONE = timezone || 'America/New_York';
  
  // Create .env file
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Replace values
  for (const [key, value] of Object.entries(config)) {
    if (value) {
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, `${key}=${value}`);
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Configuration saved to .env file');
  
  // Create necessary directories
  const dirs = ['logs', 'knowledge', 'uploads', 'temp'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created ${dir}/ directory`);
    }
  });
  
  console.log('\n📚 Next Steps:\n');
  console.log('1. Install dependencies:');
  console.log('   npm install\n');
  console.log('2. Make sure MongoDB and Redis are running\n');
  console.log('3. Start the assistant:');
  console.log('   npm run dev\n');
  console.log('4. Scan the QR code with WhatsApp\n');
  console.log('5. Add knowledge base documents to knowledge/ folder\n');
  console.log('📖 Read the README.md for more information\n');
  
  rl.close();
}

setup().catch(console.error);
