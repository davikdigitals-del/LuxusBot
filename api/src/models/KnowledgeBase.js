import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  subcategory: {
    type: String,
    default: '',
  },
  tags: [{
    type: String,
  }],
  keywords: [{
    type: String,
  }],
  language: {
    type: String,
    default: 'en',
  },
  source: {
    type: {
      type: String,
      enum: ['manual', 'document', 'website', 'api'],
      default: 'manual',
    },
    url: String,
    filename: String,
    author: String,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  vectorId: {
    type: String,
    default: '',
  },
  embeddings: {
    type: [Number],
    default: [],
  },
  usage: {
    views: {
      type: Number,
      default: 0,
    },
    helpful: {
      type: Number,
      default: 0,
    },
    notHelpful: {
      type: Number,
      default: 0,
    },
    lastUsed: Date,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
  },
  publishedAt: Date,
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

// Indexes
knowledgeBaseSchema.index({ category: 1, status: 1 });
knowledgeBaseSchema.index({ tags: 1 });
knowledgeBaseSchema.index({ keywords: 1 });
knowledgeBaseSchema.index({ 'usage.lastUsed': -1 });
knowledgeBaseSchema.index({ title: 'text', content: 'text' });

// Methods
knowledgeBaseSchema.methods.incrementUsage = function () {
  this.usage.views += 1;
  this.usage.lastUsed = new Date();
};

knowledgeBaseSchema.methods.markHelpful = function (isHelpful) {
  if (isHelpful) {
    this.usage.helpful += 1;
  } else {
    this.usage.notHelpful += 1;
  }
};

const KnowledgeBase = mongoose.model('KnowledgeBase', knowledgeBaseSchema);

export default KnowledgeBase;
