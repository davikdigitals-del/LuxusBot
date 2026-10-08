import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  // Basic Info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },

  // Profile
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    default: null
  },

  // Authentication
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  passwordResetToken: String,
  passwordResetExpires: Date,

  // Multi-tenant Memberships
  memberships: [{
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'agent', 'viewer'],
      required: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Routing tags, e.g. ['billing', 'sales']. Used to auto-assign chats.
    departments: {
      type: [String],
      default: []
    },
    invitationTokenHash: String,
    invitationExpiresAt: Date,
    inviteRequiresPassword: {
      type: Boolean,
      default: false
    },
    invitedAt: {
      type: Date,
      default: Date.now
    },
    joinedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending'
    }
  }],

  // User Preferences
  preferences: {
    defaultBusinessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Security
  lastLogin: Date,
  lastLoginIp: String,
  loginHistory: [{
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: String
  }],

  // Account Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  },

  // Metadata
  metadata: {
    referralSource: String,
    signupIp: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ 'memberships.businessId': 1 });
userSchema.index({ status: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has access to business
userSchema.methods.hasAccessToBusiness = function (businessId) {
  return this.memberships.some(
    m => m.businessId.toString() === businessId.toString() && m.status === 'active'
  );
};

// Method to get role in business
userSchema.methods.getRoleInBusiness = function (businessId) {
  const membership = this.memberships.find(
    m => m.businessId.toString() === businessId.toString() && m.status === 'active'
  );
  return membership ? membership.role : null;
};

// Method to check if user has permission
userSchema.methods.hasPermission = function (businessId, requiredRole) {
  const roleHierarchy = { viewer: 1, agent: 2, admin: 3, owner: 4 };
  const userRole = this.getRoleInBusiness(businessId);

  if (!userRole) return false;

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Method to add membership
userSchema.methods.addMembership = async function (businessId, role, invitedBy) {
  this.memberships.push({
    businessId,
    role,
    invitedBy,
    invitedAt: new Date(),
    status: 'pending'
  });
  await this.save();
};

// Method to accept membership invitation
userSchema.methods.acceptInvitation = async function (businessId) {
  const membership = this.memberships.find(
    m => m.businessId.toString() === businessId.toString()
  );

  if (membership) {
    membership.status = 'active';
    membership.joinedAt = new Date();
    await this.save();
  }
};

// Static method to find by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: String(email).toLowerCase(), status: 'active' });
};

// Static method to find by verification token
userSchema.statics.findByVerificationToken = function (token) {
  return this.findOne({
    emailVerificationToken: String(token),
    emailVerificationExpires: { $gt: Date.now() }
  });
};

// Static method to find by reset token
userSchema.statics.findByResetToken = function (token) {
  return this.findOne({
    passwordResetToken: String(token),
    passwordResetExpires: { $gt: Date.now() }
  });
};

const User = mongoose.model('User', userSchema);

export default User;
