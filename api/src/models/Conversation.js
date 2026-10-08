import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'document', 'voice', 'video', 'location'],
    default: 'text',
  },
  mediaUrl: {
    type: String,
    default: '',
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  // References a Contact (a WhatsApp end-customer of this business), NOT the
  // dashboard User model. Field name kept as userId for compatibility with
  // existing code/queries (see core/memory/longTermMemory.js).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
    index: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  messages: [messageSchema],
  context: {
    intent: {
      type: String,
      default: 'general',
    },
    topic: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'en',
    },
    sentiment: {
      score: {
        type: Number,
        default: 0,
      },
      label: {
        type: String,
        enum: ['very_negative', 'negative', 'neutral', 'positive', 'very_positive'],
        default: 'neutral',
      },
    },
  },
  assignedModule: {
    type: String,
    enum: ['customer-service', 'sales', 'hr', 'scheduling', 'general'],
    default: 'general',
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'escalated', 'abandoned'],
    default: 'active',
  },
  // Human handoff: while handoffMode is 'human', the AI stops replying and
  // messages are relayed to/from assignedAgent's own linked WhatsApp instead.
  handoffMode: {
    type: String,
    enum: ['ai', 'human'],
    default: 'ai',
    index: true,
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  assignedDepartment: {
    type: String,
    default: '',
    index: true,
  },
  transferredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  transferredAt: Date,
  transferNote: {
    type: String,
    default: '',
  },
  resolution: {
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: Date,
    satisfaction: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
  },
  metrics: {
    responseTime: {
      type: Number,
      default: 0,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    aiProvider: {
      type: String,
      default: '',
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: Date,
}, {
  timestamps: true,
});

// Indexes
conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ assignedModule: 1 });
conversationSchema.index({ 'context.intent': 1 });
conversationSchema.index({ startedAt: -1 });

// Methods
conversationSchema.methods.addMessage = function (role, content, messageType = 'text', metadata = {}) {
  this.messages.push({
    role,
    content,
    messageType,
    metadata,
    timestamp: new Date(),
  });
  this.metrics.messageCount = this.messages.length;
};

conversationSchema.methods.calculateDuration = function () {
  if (this.messages.length > 1) {
    const firstMessage = this.messages[0].timestamp;
    const lastMessage = this.messages[this.messages.length - 1].timestamp;
    this.metrics.duration = lastMessage - firstMessage;
  }
};

conversationSchema.methods.markResolved = function (satisfaction, feedback) {
  this.status = 'resolved';
  this.resolution.resolved = true;
  this.resolution.resolvedAt = new Date();
  this.endedAt = new Date();

  if (satisfaction) {
    this.resolution.satisfaction = satisfaction;
  }

  if (feedback) {
    this.resolution.feedback = feedback;
  }

  this.calculateDuration();
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
