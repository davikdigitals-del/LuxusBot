import mongoose from 'mongoose';

/**
 * A WhatsApp end-customer who messages a business's assistant.
 * NOT a dashboard login (that is User).
 */
const contactSchema = new mongoose.Schema({
  // Becomes required once tenant context is threaded through the engine
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    default: null,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    default: ''
  },
  isMyContact: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Same phone number can be a contact of many businesses, once per business
contactSchema.index({ businessId: 1, phoneNumber: 1 }, { unique: true });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
