import express from 'express';
import { User, Business } from '../models/index.js';
import authService from '../services/authService.js';
import googleAuthService from '../services/googleAuthService.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { authLimiters } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';
import { sha256 } from '../utils/crypto.js';

const router = express.Router();

// Body values must be non-empty strings (blocks NoSQL operator injection like {"$ne": null})
const isStr = (...values) => values.every(v => typeof v === 'string' && v.length > 0);

const findPendingInvitation = async (token) => {
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) return null;
  const tokenHash = sha256(token);
  const user = await User.findOne({
    status: 'active',
    memberships: {
      $elemMatch: {
        invitationTokenHash: tokenHash,
        invitationExpiresAt: { $gt: new Date() },
        status: 'pending',
      },
    },
  });
  if (!user) return null;
  const membership = user.memberships.find((item) =>
    item.invitationTokenHash === tokenHash &&
    item.status === 'pending' &&
    item.invitationExpiresAt > new Date()
  );
  return membership ? { user, membership } : null;
};

router.get('/invitation', async (req, res) => {
  try {
    const invitation = await findPendingInvitation(req.query.token);
    if (!invitation) {
      return res.status(410).json({ success: false, error: 'This invitation link is invalid or has expired' });
    }
    const business = await Business.findById(invitation.membership.businessId).select('name');
    if (!business) {
      return res.status(410).json({ success: false, error: 'The business for this invitation is no longer available' });
    }
    res.json({
      success: true,
      invitation: {
        email: invitation.user.email,
        businessName: business.name,
        role: invitation.membership.role,
        department: invitation.membership.departments[0] || '',
        requiresPassword: invitation.membership.inviteRequiresPassword,
      },
    });
  } catch (error) {
    logger.error('Get invitation details endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to load invitation' });
  }
});

router.post('/accept-invitation', authLimiters.password, optionalAuth, async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body || {};
    const invitation = await findPendingInvitation(token);
    if (!invitation) {
      return res.status(410).json({ success: false, error: 'This invitation link is invalid or has expired' });
    }

    const { user: matchedUser, membership: matchedMembership } = invitation;
    const acceptingNewAccount = matchedMembership.inviteRequiresPassword;
    if (acceptingNewAccount) {
      if (!isStr(password, firstName, lastName) || password.length < 8 || password.length > 128) {
        return res.status(400).json({ success: false, error: 'Enter your name and a password of at least 8 characters' });
      }
      if (!firstName.trim() || !lastName.trim() || firstName.trim().length > 60 || lastName.trim().length > 60) {
        return res.status(400).json({ success: false, error: 'Names must be 1-60 characters' });
      }
    } else if (!req.user || req.user.email.toLowerCase() !== matchedUser.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Sign in with the invited email address to accept this invitation' });
    }

    const user = await User.findById(matchedUser._id);
    if (!user || user.status !== 'active') {
      return res.status(410).json({ success: false, error: 'This invitation is no longer available' });
    }
    const membership = user.memberships.find((item) =>
      String(item._id) === String(matchedMembership._id) &&
      item.status === 'pending' &&
      item.invitationTokenHash === sha256(token) &&
      item.invitationExpiresAt > new Date()
    );
    if (!membership) {
      return res.status(410).json({ success: false, error: 'This invitation is invalid or has expired' });
    }

    if (acceptingNewAccount) {
      user.password = password;
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.emailVerified = true;
    }
    membership.status = 'active';
    membership.joinedAt = new Date();
    membership.invitationTokenHash = undefined;
    membership.invitationExpiresAt = undefined;
    membership.inviteRequiresPassword = false;
    await user.save();

    res.json({ success: true, email: user.email, message: 'Invitation accepted' });
  } catch (error) {
    logger.error('Accept invitation endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept invitation' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', authLimiters.login, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!isStr(email, password)) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const result = await authService.login(email, password, ipAddress, userAgent);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Login endpoint error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

router.post('/google', authLimiters.login, async (req, res) => {
  try {
    const result = await googleAuthService.login(
      req.body?.credential,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );
    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.message === 'Google sign-in is not configured' ? 503 : 401;
    logger.warn('Google sign-in failed:', error.message);
    res.status(status).json({
      success: false,
      error: status === 503 ? error.message : 'Google sign-in failed. Please try again.',
    });
  }
});

router.post('/register', authLimiters.register, async (req, res) => {
  try {
    const { email, password, firstName, lastName, businessName } = req.body || {};

    if (!isStr(email, password, firstName, lastName, businessName)) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }
    if (firstName.trim().length > 60 || lastName.trim().length > 60 || businessName.trim().length > 100) {
      return res.status(400).json({ success: false, error: 'One or more fields are too long' });
    }

    await authService.register({ email, password, firstName, lastName, businessName });
    return res.status(201).json({ success: true, message: 'Account created. You can now sign in.' });
  } catch (error) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    logger.error('Registration endpoint error:', error);
    return res.status(500).json({ success: false, error: 'Could not create account. Please try again.' });
  }
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email
 * @access  Public
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!isStr(token)) {
      return res.status(400).json({
        success: false,
        error: 'Verification token required'
      });
    }
    
    const result = await authService.verifyEmail(token);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Verify email endpoint error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Email verification failed'
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', authLimiters.password, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!isStr(email)) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const result = await authService.requestPasswordReset(email);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Forgot password endpoint error:', error);
    res.status(503).json({
      success: false,
      error: 'Password reset email could not be sent. Please try again later.'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', authLimiters.password, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!isStr(token, password)) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }
    
    const result = await authService.resetPassword(token, password);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Reset password endpoint error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password reset failed'
    });
  }
});

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', authLimiters.refresh, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!isStr(refreshToken)) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }
    
    const result = await authService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Refresh token endpoint error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!isStr(oldPassword, newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Old and new password are required'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters'
      });
    }
    
    const result = await authService.changePassword(req.userId, oldPassword, newPassword);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Change password endpoint error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password change failed'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update the authenticated user's profile
 * @access  Private
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const allowedFields = ['firstName', 'lastName', 'phone'];
    const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) {
      return res.status(400).json({ success: false, error: 'Only firstName, lastName, and phone can be updated here' });
    }
    if (Object.keys(body).length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least one profile field to update' });
    }
    for (const field of ['firstName', 'lastName']) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 60)) {
        return res.status(400).json({ success: false, error: `${field} must be 1-60 characters` });
      }
    }
    if (body.phone !== undefined && (
      typeof body.phone !== 'string' || body.phone.trim().length > 30
    )) {
      return res.status(400).json({ success: false, error: 'phone must be a string of up to 30 characters' });
    }

    const user = await User.findById(req.userId);
    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }
    if (body.firstName !== undefined) user.firstName = body.firstName.trim();
    if (body.lastName !== undefined) user.lastName = body.lastName.trim();
    if (body.phone !== undefined) user.phone = body.phone.trim() || null;
    await user.save();

    res.json({ success: true, user: authService.sanitizeUser(user) });
  } catch (error) {
    logger.error('Update user profile endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: authService.sanitizeUser(req.user)
    });
  } catch (error) {
    logger.error('Get current user endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user data'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client should delete tokens)
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a more complex system, you might want to blacklist the token
    // For now, client-side token deletion is sufficient
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

export default router;
