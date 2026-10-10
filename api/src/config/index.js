import dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Missing/blank numeric env vars become undefined so Joi defaults apply (parseInt gave NaN)
const num = (value) => (value === undefined || value === '' ? undefined : Number(value));

// Configuration schema
const configSchema = Joi.object({
  node_env: Joi.string().valid('development', 'production', 'test').default('development'),
  port: Joi.number().default(3000),
  app_name: Joi.string().default('WhatsApp Company Assistant'),
  log_level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),

  // WhatsApp
  whatsapp: Joi.object({
    sessionPath: Joi.string().default('./whatsapp-session'),
    webhookUrl: Joi.string().allow(''),
    webhookVerifyToken: Joi.string().default(''),
  }),

  // AI Providers
  ai: Joi.object({
    anthropic: Joi.object({
      apiKey: Joi.string().allow(''),
      model: Joi.string().default('claude-sonnet-4-5'),
      temperature: Joi.number().min(0).max(1).default(0.7),
      maxTokens: Joi.number().default(2000),
    }),
    defaultProvider: Joi.string().valid('anthropic').default('anthropic'),
  }),

  // Database
  database: Joi.object({
    mongoUri: Joi.string().default('mongodb://localhost:27017/whatsapp_assistant'),
    dbName: Joi.string().default('whatsapp_assistant'),
  }),

  // Redis
  redis: Joi.object({
    host: Joi.string().default('localhost'),
    port: Joi.number().default(6379),
    password: Joi.string().allow(''),
    db: Joi.number().default(0),
  }),

  // Vector Database
  vectorDb: Joi.object({
    host: Joi.string().default('localhost'),
    port: Joi.number().default(8000),
    collection: Joi.string().default('company_knowledge'),
  }),

  // Company Info
  company: Joi.object({
    name: Joi.string().default('Your Company Name'),
    industry: Joi.string().default('Technology'),
    description: Joi.string().default(''),
    website: Joi.string().uri().allow(''),
    email: Joi.string().email().allow(''),
    phone: Joi.string().allow(''),
  }),

  // Business Hours
  businessHours: Joi.object({
    start: Joi.string().default('09:00'),
    end: Joi.string().default('18:00'),
    timezone: Joi.string().default('America/New_York'),
    days: Joi.string().default('1,2,3,4,5'),
  }),

  // Features
  features: Joi.object({
    sentimentAnalysis: Joi.boolean().default(true),
    languageDetection: Joi.boolean().default(true),
    autoTranslation: Joi.boolean().default(false),
    voiceMessages: Joi.boolean().default(true),
    imageAnalysis: Joi.boolean().default(true),
    documentProcessing: Joi.boolean().default(true),
    multiAgent: Joi.boolean().default(true),
    functionCalling: Joi.boolean().default(true),
    webSearch: Joi.boolean().default(false),
    calendarIntegration: Joi.boolean().default(false),
  }),

  // Assistant
  assistant: Joi.object({
    name: Joi.string().default('CompanyBot'),
    personality: Joi.string().default('professional,helpful,friendly'),
    responseDelay: Joi.number().default(20000), // ms; replies wait this long (with "typing...") so the number looks human
    maxContextMessages: Joi.number().default(10),
    sessionTimeout: Joi.number().default(30),
  }),

  // Rate Limiting
  rateLimit: Joi.object({
    windowMs: Joi.number().default(60000),
    maxRequests: Joi.number().default(20),
  }),

  // Analytics
  analytics: Joi.object({
    enabled: Joi.boolean().default(true),
    retentionDays: Joi.number().default(90),
  }),

  // Security
  security: Joi.object({
    jwtSecret: Joi.string().min(32).required(),
    jwtRefreshSecret: Joi.string().min(32).required(),
    jwtExpiresIn: Joi.string().default('1h'),
    encryptionKey: Joi.string().hex().length(64).required(),
  }),

  // Retained only to manage subscriptions that predate the Kora integration.
  legacyBilling: Joi.object({
    secretKey: Joi.string().allow('').default(''),
    planCodes: Joi.object({
      pro: Joi.string().allow('').default(''),
      individual: Joi.string().allow('').default(''),
      enterprise: Joi.string().allow('').default(''),
    }),
  }),
  kora: Joi.object({
    secretKey: Joi.string().allow('').default(''),
    defaultCurrency: Joi.string().uppercase().length(3).allow('').default(''),
    channels: Joi.string().allow('').default('card,bank_transfer,pay_with_bank,mobile_money'),
  }),
  billing: Joi.object({
    aiBudgetUsd: Joi.number().min(0).default(0), // 0 = no AI cost cap (plans are limited by reply quota)
    graceDays: Joi.number().min(0).default(3),
  }),

  // Platform
  appUrl: Joi.string().uri().default('http://localhost:3001'),
  apiUrl: Joi.string().uri().default('http://localhost:3000'),
  google: Joi.object({
    clientId: Joi.string().allow('').default(''),
  }),
  socialAuth: Joi.object({
    github: Joi.object({
      clientId: Joi.string().allow('').default(''),
      clientSecret: Joi.string().allow('').default(''),
    }),
    discord: Joi.object({
      clientId: Joi.string().allow('').default(''),
      clientSecret: Joi.string().allow('').default(''),
    }),
  }),
  trustProxy: Joi.boolean().default(false),
  enableLegacyWhatsApp: Joi.boolean().default(false),
  email: Joi.object({
    provider: Joi.string().valid('smtp', 'gmail-api').default('smtp'),
    host: Joi.string().allow('').default(''),
    port: Joi.number().default(587),
    user: Joi.string().allow('').default(''),
    password: Joi.string().allow('').default(''),
    from: Joi.string().allow('').default(''),
    googleClientId: Joi.string().allow('').default(''),
    googleClientSecret: Joi.string().allow('').default(''),
    googleRefreshToken: Joi.string().allow('').default(''),
  }),
}).unknown();

// Build config object
const buildConfig = () => {
  const config = {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    app_name: process.env.APP_NAME,
    log_level: process.env.LOG_LEVEL,

    whatsapp: {
      sessionPath: process.env.WHATSAPP_SESSION_PATH,
      webhookUrl: process.env.WHATSAPP_WEBHOOK_URL,
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    },

    ai: {
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL,
        temperature: num(process.env.ANTHROPIC_TEMPERATURE),
        maxTokens: num(process.env.ANTHROPIC_MAX_TOKENS),
      },
      defaultProvider: 'anthropic',
    },

    database: {
      mongoUri: process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB_NAME,
    },

    redis: {
      host: process.env.REDIS_HOST,
      port: num(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
      db: num(process.env.REDIS_DB),
    },

    vectorDb: {
      host: process.env.CHROMA_HOST,
      port: num(process.env.CHROMA_PORT),
      collection: process.env.CHROMA_COLLECTION,
    },

    company: {
      name: process.env.COMPANY_NAME,
      industry: process.env.COMPANY_INDUSTRY,
      description: process.env.COMPANY_DESCRIPTION,
      website: process.env.COMPANY_WEBSITE,
      email: process.env.COMPANY_EMAIL,
      phone: process.env.COMPANY_PHONE,
    },

    businessHours: {
      start: process.env.BUSINESS_HOURS_START,
      end: process.env.BUSINESS_HOURS_END,
      timezone: process.env.BUSINESS_TIMEZONE,
      days: process.env.BUSINESS_DAYS,
    },

    features: {
      sentimentAnalysis: process.env.ENABLE_SENTIMENT_ANALYSIS === 'true',
      languageDetection: process.env.ENABLE_LANGUAGE_DETECTION === 'true',
      autoTranslation: process.env.ENABLE_AUTO_TRANSLATION === 'true',
      voiceMessages: process.env.ENABLE_VOICE_MESSAGES === 'true',
      imageAnalysis: process.env.ENABLE_IMAGE_ANALYSIS === 'true',
      documentProcessing: process.env.ENABLE_DOCUMENT_PROCESSING === 'true',
      multiAgent: process.env.ENABLE_MULTI_AGENT === 'true',
      functionCalling: process.env.ENABLE_FUNCTION_CALLING === 'true',
      webSearch: process.env.ENABLE_WEB_SEARCH === 'true',
      calendarIntegration: process.env.ENABLE_CALENDAR_INTEGRATION === 'true',
    },

    assistant: {
      name: process.env.ASSISTANT_NAME,
      personality: process.env.ASSISTANT_PERSONALITY,
      responseDelay: num(process.env.RESPONSE_DELAY_MS),
      maxContextMessages: num(process.env.MAX_CONTEXT_MESSAGES),
      sessionTimeout: num(process.env.SESSION_TIMEOUT_MINUTES),
    },

    rateLimit: {
      windowMs: num(process.env.RATE_LIMIT_WINDOW_MS),
      maxRequests: num(process.env.RATE_LIMIT_MAX_REQUESTS),
    },

    analytics: {
      enabled: process.env.ENABLE_ANALYTICS === 'true',
      retentionDays: num(process.env.ANALYTICS_RETENTION_DAYS),
    },

    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      encryptionKey: process.env.ENCRYPTION_KEY,
    },

    legacyBilling: {
      secretKey: process.env.LEGACY_PAYSTACK_SECRET_KEY,
      planCodes: {
        pro: process.env.LEGACY_PAYSTACK_PLAN_PRO,
        individual: process.env.LEGACY_PAYSTACK_PLAN_INDIVIDUAL,
        enterprise: process.env.LEGACY_PAYSTACK_PLAN_ENTERPRISE,
      },
    },
    kora: {
      secretKey: process.env.KORA_SECRET_KEY,
      defaultCurrency: process.env.KORA_DEFAULT_CURRENCY,
      channels: process.env.KORA_PAYMENT_CHANNELS,
    },
    billing: {
      aiBudgetUsd: num(process.env.AI_MONTHLY_BUDGET_USD),
      graceDays: num(process.env.BILLING_GRACE_DAYS),
    },

    appUrl: process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://luxusbot-oo3c.onrender.com' : undefined),
    apiUrl: process.env.API_URL || (process.env.NODE_ENV === 'production' ? 'https://luxus-api.onrender.com' : undefined),
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
    },
    socialAuth: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
      },
    },
    trustProxy: process.env.TRUST_PROXY === 'true',
    enableLegacyWhatsApp: process.env.ENABLE_LEGACY_WHATSAPP === 'true',
    email: {
      provider: process.env.EMAIL_PROVIDER,
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT ? num(process.env.EMAIL_SMTP_PORT) : undefined,
      user: process.env.EMAIL_SMTP_USER,
      password: process.env.EMAIL_SMTP_PASSWORD,
      from: process.env.EMAIL_FROM,
      googleClientId: process.env.GMAIL_API_CLIENT_ID,
      googleClientSecret: process.env.GMAIL_API_CLIENT_SECRET,
      googleRefreshToken: process.env.GMAIL_API_REFRESH_TOKEN,
    },
  };

  return config;
};

// Validate and export config
const validateConfig = () => {
  const config = buildConfig();
  const { error, value } = configSchema.validate(config, { abortEarly: false });

  if (error) {
    console.error('❌ Configuration validation failed:');
    error.details.forEach((detail) => {
      console.error(`  - ${detail.message}`);
    });
    process.exit(1);
  }

  // Refuse placeholder secrets in production
  if (value.node_env === 'production') {
    const weak = /change|your_|example|secret_here/i;
    if (weak.test(value.security.jwtSecret) || weak.test(value.security.jwtRefreshSecret)) {
      console.error('❌ JWT secrets look like placeholders. Run: node scripts/gen-secrets.js');
      process.exit(1);
    }
  }
  if (value.security.jwtSecret === value.security.jwtRefreshSecret) {
    console.error('❌ JWT_SECRET and JWT_REFRESH_SECRET must be different');
    process.exit(1);
  }

  // Flat aliases used by the auth code (config.jwtSecret etc.)
  return {
    ...value,
    jwtSecret: value.security.jwtSecret,
    jwtRefreshSecret: value.security.jwtRefreshSecret,
    jwtExpiresIn: value.security.jwtExpiresIn,
    encryptionKey: value.security.encryptionKey,
  };
};

const config = validateConfig();

export default config;
