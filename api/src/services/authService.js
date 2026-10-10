import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Business } from '../models/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import emailService from './emailService.js';

class AuthService {
  /**
   * Generate JWT token
   */
  generateToken(userId, expiresIn = config.jwtExpiresIn) {
    return jwt.sign(
      { userId, type: 'access' },
      config.jwtSecret,
      { expiresIn, algorithm: 'HS256' }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: '30d', algorithm: 'HS256' }
    );
  }

  async register({ email, password, firstName, lastName, businessName }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    const cleanBusinessName = String(businessName || '').trim();

    if (await User.findByEmail(normalizedEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const user = new User({
      email: normalizedEmail,
      password,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      status: 'active',
    });
    await user.save();

    const business = new Business({
      name: cleanBusinessName,
      slug: this.generateSlug(cleanBusinessName),
      owner: user._id,
      subscription: { plan: 'none', status: 'none' },
      onboarding: { steps: { planSelected: false } },
    });
    await business.save();

    await user.addMembership(business._id, 'owner', user._id);
    await user.acceptInvitation(business._id);
    user.preferences.defaultBusinessId = business._id;
    await user.save();

    logger.info(`Free account created: ${user.email}`);
    return { user, business };
  }

  /**
   * Creates an account + business for a customer who has ALREADY PAID.
   * Only called after verified payment - there is no public paid sign-up.
   * The user gets a random password they never see and a 7-day link to set their own.
   */
  async createPaidAccount({
    email,
    firstName,
    lastName,
    businessName,
    plan,
    paymentProvider = 'legacy',
    paystackCustomerCode,
    paymentReference,
    paidAt,
    periodEnd,
    limits,
    socialProvider,
    socialId,
  }) {
    const existing = await User.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    const socialIdFields = socialProvider === 'github'
      ? { githubId: socialId }
      : socialProvider === 'discord'
        ? { discordId: socialId }
        : {};
    const user = new User({
      email,
      password: crypto.randomBytes(24).toString('hex'),
      ...socialIdFields,
      firstName: firstName || 'Customer',
      lastName: lastName || '-',
      status: 'active',
      emailVerified: true, // the set-password link below proves they own this inbox
    });
    user.passwordResetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await user.save();

    const business = new Business({
      name: businessName,
      slug: this.generateSlug(businessName),
      owner: user._id,
      subscription: {
        plan,
        status: 'active',
        paymentProvider,
        paystackCustomerCode,
        lastPaymentReference: paymentReference,
        currentPeriodStart: paidAt,
        currentPeriodEnd: periodEnd,
      },
      limits,
      usage: { lastResetAt: new Date() },
      onboarding: { steps: { planSelected: true } },
    });
    await business.save();

    await user.addMembership(business._id, 'owner', user._id);
    await user.acceptInvitation(business._id);
    user.preferences.defaultBusinessId = business._id;
    await user.save();

    logger.info(`Paid account created: ${user.email}`);
    return { user, business };
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress, userAgent) {
    try {
      // Find user
      const user = await User.findByEmail(email);
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      user.lastLogin = new Date();
      user.lastLoginIp = ipAddress;
      
      // Add to login history
      user.loginHistory.push({
        ip: ipAddress,
        userAgent,
        timestamp: new Date()
      });

      // Keep only last 10 login records
      if (user.loginHistory.length > 10) {
        user.loginHistory = user.loginHistory.slice(-10);
      }

      await user.save();

      // Generate tokens
      const token = this.generateToken(user._id);
      const refreshToken = this.generateRefreshToken(user._id);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        token,
        refreshToken
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    try {
      const user = await User.findByVerificationToken(token);
      
      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      await user.save();

      logger.info(`Email verified: ${user.email}`);

      return {
        message: 'Email verified successfully'
      };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);
      
      if (!user) {
        return {
          registered: false,
          message: 'Email is not registered'
        };
      }

      // Generate reset token
      user.passwordResetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
      
      await user.save();

      try {
        await emailService.sendPasswordResetEmail(user.email, user.passwordResetToken);
      } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        logger.error('Password reset email failed:', error);
        throw new Error('Password reset email could not be sent. Please try again later.');
      }

      logger.info(`Password reset requested: ${user.email}`);

      return {
        registered: true,
        message: 'If your email is registered, you will receive a password reset link'
      };
    } catch (error) {
      logger.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findByResetToken(token);
      
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      await user.save();

      logger.info(`Password reset: ${user.email}`);

      return {
        message: 'Password reset successfully'
      };
    } catch (error) {
      logger.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret, { algorithms: ['HS256'] });
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await User.findById(decoded.userId);
      
      if (!user || user.status !== 'active') {
        throw new Error('Invalid refresh token');
      }

      const newToken = this.generateToken(user._id);
      const newRefreshToken = this.generateRefreshToken(user._id);

      return {
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify old password
      const isMatch = await user.comparePassword(oldPassword);
      
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }

      user.password = newPassword;
      await user.save();

      logger.info(`Password changed: ${user.email}`);

      return {
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Password change error:', error);
      throw error;
    }
  }

  /**
   * Generate unique slug for business
   */
  generateSlug(name) {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Add random suffix to ensure uniqueness
    slug += '-' + crypto.randomBytes(3).toString('hex');
    
    return slug;
  }

  /**
   * Sanitize user object (remove sensitive data)
   */
  sanitizeUser(user) {
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.emailVerificationToken;
    delete userObj.passwordResetToken;
    return userObj;
  }

  /**
   * Sanitize business object
   */
  sanitizeBusiness(business) {
    const businessObj = business.toObject();

    // Provider keys are never sent to the client (only whether they are set)
    if (businessObj.aiConfig) {
      delete businessObj.aiConfig.anthropicKey;
    }

    // API keys: keep display info only, never the hash
    if (businessObj.apiKeys) {
      businessObj.apiKeys = businessObj.apiKeys.map(({ keyHash, ...safe }) => safe);
    }

    // Webhook signing secrets are only shown when a webhook is created
    if (businessObj.webhooks) {
      businessObj.webhooks = businessObj.webhooks.map(({ secret, ...safe }) => safe);
    }

    // Billing identifiers are not needed by the dashboard
    if (businessObj.subscription) {
      delete businessObj.subscription.paystackCustomerCode;
      delete businessObj.subscription.paystackSubscriptionCode;
      delete businessObj.subscription.paystackEmailToken;
      delete businessObj.subscription.lastPaymentReference;
    }

    return businessObj;
  }
}

export default new AuthService();
