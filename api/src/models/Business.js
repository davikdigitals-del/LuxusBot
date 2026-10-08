import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  departments: {
    type: [String],
    default: []
  },
  
  // Branding
  logo: {
    type: String,
    default: null
  },
  primaryColor: {
    type: String,
    default: '#3B82F6'
  },
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  
  // WhatsApp Connection
  whatsapp: {
    number: String,
    status: {
      type: String,
      enum: ['disconnected', 'connecting', 'connected', 'failed'],
      default: 'disconnected'
    },
    sessionId: String,
    qrCode: String,
    qrCodeExpires: Date,
    lastConnected: Date,
    lastDisconnected: Date
  },
  
  // Subscription & Billing
  subscription: {
    plan: {
      type: String,
      enum: ['none', 'pro', 'individual', 'enterprise'],
      default: 'none'
    },
    status: {
      type: String,
      enum: ['none', 'active', 'past_due', 'canceled'],
      default: 'none'
    },
    paymentProvider: {
      type: String,
      enum: ['paystack', 'legacy', 'kora'],
      default: 'legacy'
    },
    paystackCustomerCode: String,
    paystackSubscriptionCode: String,
    paystackEmailToken: String,
    lastPaymentReference: String,
    currentPeriodStart: Date,
    // AI stays on until this date (plus the grace period). Set on every successful payment.
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  
  // Usage Tracking
  usage: {
    messagesThisMonth: {
      type: Number,
      default: 0
    },
    knowledgeBaseSizeMB: {
      type: Number,
      default: 0
    },
    teamMembers: {
      type: Number,
      default: 1
    },
    apiCallsThisMonth: {
      type: Number,
      default: 0
    },
    // What the AI cost us this billing month, in USD (from Anthropic's token counts)
    aiCostThisMonth: {
      type: Number,
      default: 0
    },
    lastResetAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Plan Limits
  limits: {
    messagesPerMonth: {
      type: Number,
      default: 0 // No plan = no AI
    },
    // Monthly AI spend cap in USD; when reached the AI pauses and chats go to a live agent
    aiBudgetUsd: {
      type: Number,
      default: 0
    },
    maxKnowledgeBaseMB: {
      type: Number,
      default: 10
    },
    maxTeamMembers: {
      type: Number,
      default: 1
    },
    maxApiCallsPerMonth: {
      type: Number,
      default: 1000
    }
  },
  
  // AI Configuration
  aiConfig: {
    // AES-256-GCM encrypted (utils/crypto.js). Hidden from queries by default;
    // the engine must load it with .select('+aiConfig.anthropicKey').
    // Optional: a business may bring its own Anthropic key; otherwise the platform key is used.
    anthropicKey: { type: String, select: false },
    anthropicKeySet: { type: Boolean, default: false },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1
    },
    maxTokens: {
      type: Number,
      default: 1000
    }
  },
  
  // Assistant Configuration
  assistant: {
    name: {
      type: String,
      default: 'Assistant'
    },
    personality: {
      type: String,
      default: 'professional, helpful, friendly'
    },
    language: {
      type: String,
      default: 'en'
    },
    systemPrompt: String
  },
  
  // Business Hours
  businessHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    timezone: String,
    schedule: {
      monday: { start: String, end: String, enabled: Boolean },
      tuesday: { start: String, end: String, enabled: Boolean },
      wednesday: { start: String, end: String, enabled: Boolean },
      thursday: { start: String, end: String, enabled: Boolean },
      friday: { start: String, end: String, enabled: Boolean },
      saturday: { start: String, end: String, enabled: Boolean },
      sunday: { start: String, end: String, enabled: Boolean }
    },
    outOfHoursMessage: String
  },
  
  // Contact Info
  contact: {
    email: String,
    phone: String,
    website: String,
    address: String,
    industry: String,
    description: String
  },
  
  // Notifications
  notifications: {
    email: {
      enabled: Boolean,
      address: String,
      events: [String] // ['new_conversation', 'high_priority', 'daily_summary']
    },
    slack: {
      enabled: Boolean,
      webhookUrl: String
    }
  },
  
  // Webhooks
  webhooks: [{
    name: String,
    url: String,
    events: [String], // ['message.received', 'conversation.ended']
    secret: String,
    enabled: {
      type: Boolean,
      default: true
    },
    createdAt: Date
  }],
  
  // Auto-routing of chats to team members (see services/routingService.js)
  routing: {
    enabled: { type: Boolean, default: false },
    // Rules are checked in order; first keyword match decides the department
    rules: [{
      department: String,
      keywords: [String]
    }],
    // Used when a customer asks for a human but no rule matches
    humanRequestDepartment: { type: String, default: '' },
    // Used when nobody in the matching department is online
    fallbackAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Tell the customer a person is taking over
    customerNotice: { type: String, default: 'Thanks - I\'m connecting you with a member of our team who can help with this.' },
    customerUnavailableNotice: { type: String, default: 'Our team is unavailable right now. Please leave a message and we will get back to you as soon as possible.' }
  },

  // API Keys
  apiKeys: [{
    name: String,
    keyHash: String, // SHA-256 of the key; the raw key is shown once at creation
    prefix: String, // First 12 chars for display, e.g. "lx_live_ab12"
    permissions: [String],
    enabled: {
      type: Boolean,
      default: true
    },
    lastUsed: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Onboarding
  onboarding: {
    completed: {
      type: Boolean,
      default: false
    },
    steps: {
      businessInfo: Boolean,
      whatsappConnected: Boolean,
      assistantCustomized: Boolean,
      knowledgeBaseAdded: Boolean,
      planSelected: Boolean
    }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },
  
  // Metadata
  metadata: {
    industry: String,
    companySize: String,
    useCase: String,
    referralSource: String
  }
}, {
  timestamps: true
});

// Indexes
businessSchema.index({ owner: 1 });
businessSchema.index({ 'subscription.stripeCustomerId': 1 });
businessSchema.index({ status: 1 });
businessSchema.index({ 'apiKeys.keyHash': 1 });

// Virtual for team member count
businessSchema.virtual('teamMemberCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'memberships.businessId',
  count: true
});

// Method to check if within limits
businessSchema.methods.isWithinLimit = function(limitType) {
  const usage = this.usage[limitType];
  const limit = this.limits[limitType];
  return usage < limit;
};

// Method to check if can send message
businessSchema.methods.canSendMessage = function() {
  return this.isWithinLimit('messagesThisMonth');
};

// Method to increment usage
businessSchema.methods.incrementUsage = async function(usageType, amount = 1) {
  this.usage[usageType] += amount;
  await this.save();
};

// Method to reset monthly usage
businessSchema.methods.resetMonthlyUsage = async function() {
  this.usage.messagesThisMonth = 0;
  this.usage.apiCallsThisMonth = 0;
  this.usage.lastResetAt = new Date();
  await this.save();
};

// Static method to find by slug
businessSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, status: 'active' });
};

const Business = mongoose.model('Business', businessSchema);

export default Business;
