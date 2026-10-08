import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  metrics: {
    conversations: {
      total: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
      resolved: { type: Number, default: 0 },
      escalated: { type: Number, default: 0 },
      abandoned: { type: Number, default: 0 },
    },
    messages: {
      total: { type: Number, default: 0 },
      incoming: { type: Number, default: 0 },
      outgoing: { type: Number, default: 0 },
      byType: {
        text: { type: Number, default: 0 },
        image: { type: Number, default: 0 },
        document: { type: Number, default: 0 },
        voice: { type: Number, default: 0 },
        video: { type: Number, default: 0 },
        location: { type: Number, default: 0 },
      },
    },
    users: {
      total: { type: Number, default: 0 },
      new: { type: Number, default: 0 },
      returning: { type: Number, default: 0 },
      active: { type: Number, default: 0 },
    },
    performance: {
      avgResponseTime: { type: Number, default: 0 },
      avgConversationDuration: { type: Number, default: 0 },
      avgMessagesPerConversation: { type: Number, default: 0 },
      resolutionRate: { type: Number, default: 0 },
    },
    satisfaction: {
      avgRating: { type: Number, default: 0 },
      totalRatings: { type: Number, default: 0 },
      distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
    },
    intents: {
      type: Map,
      of: Number,
      default: {},
    },
    modules: {
      type: Map,
      of: Number,
      default: {},
    },
    sentiment: {
      very_negative: { type: Number, default: 0 },
      negative: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      positive: { type: Number, default: 0 },
      very_positive: { type: Number, default: 0 },
    },
    ai: {
      totalTokens: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      byProvider: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  },
  hourlyDistribution: {
    type: Map,
    of: Number,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes
analyticsSchema.index({ date: -1 });

// Static methods
analyticsSchema.statics.getOrCreate = async function (businessId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return this.findOneAndUpdate(
    { businessId, date: startOfDay },
    { $setOnInsert: { businessId, date: startOfDay } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

analyticsSchema.statics.incrementMetric = async function (businessId, date, path, value = 1) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const update = { $inc: {} };
  update.$inc[`metrics.${path}`] = value;
  await this.findOneAndUpdate(
    { businessId, date: startOfDay },
    { ...update, $setOnInsert: { businessId, date: startOfDay } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

analyticsSchema.index({ businessId: 1, date: -1 });

const Analytics = mongoose.model('Analytics', analyticsSchema);

export default Analytics;
