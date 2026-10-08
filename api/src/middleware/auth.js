import jwt from 'jsonwebtoken';
import { User, Business } from '../models/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { sha256 } from '../utils/crypto.js';
import { isSubscriptionActive } from '../utils/subscriptionState.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ROLE_LEVEL = { viewer: 1, agent: 2, admin: 3, owner: 4 };

/**
 * Verify an ACCESS token (refresh tokens are rejected) and return the payload
 */
const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (decoded.type !== 'access') {
    const err = new Error('Wrong token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
};

/**
 * Verify JWT token and attach user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = verifyAccessToken(authHeader.substring(7));

    const user = await User.findById(decoded.userId).select('-password');

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Resolve the business this request acts on and verify the user belongs to it.
 *
 * The business id comes from the route (:id / :businessId) when present, otherwise
 * from the x-business-id header or ?businessId= query. If the route id and the
 * header disagree the request is rejected. Handlers MUST use req.businessId
 * (never req.params.id) so the id that was checked is the id that is used.
 */
export const requireBusiness = (req, res, next) => {
  try {
    const fromRoute = req.params.businessId || req.params.id;
    const fromHeader = req.headers['x-business-id'];

    if (fromRoute && fromHeader && String(fromRoute) !== String(fromHeader)) {
      return res.status(400).json({
        success: false,
        error: 'Business ID mismatch between URL and x-business-id header'
      });
    }

    const businessId = fromRoute || fromHeader || req.query.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        error: 'Business ID required'
      });
    }

    if (typeof businessId !== 'string' || !OBJECT_ID.test(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID'
      });
    }

    if (!req.user.hasAccessToBusiness(businessId)) {
      // Same response as "not found" would leak less, but 403 keeps the client UX clear
      return res.status(403).json({
        success: false,
        error: 'Access denied to this business'
      });
    }

    req.businessId = businessId;
    req.userRole = req.user.getRoleInBusiness(businessId);

    next();
  } catch (error) {
    logger.error('Business context error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify business access'
    });
  }
};

/**
 * Require specific role or higher
 * Role hierarchy: viewer < agent < admin < owner
 * requireRole('admin', 'owner') means "admin or above"
 */
export const requireRole = (...allowedRoles) => {
  const requiredLevel = Math.min(...allowedRoles.map(role => ROLE_LEVEL[role]));

  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({
        success: false,
        error: 'No role assigned'
      });
    }

    if (ROLE_LEVEL[req.userRole] < requiredLevel) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.userRole
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const decoded = verifyAccessToken(authHeader.substring(7));
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Verify email is verified
 */
export const requireEmailVerified = (req, res, next) => {
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      action: 'verify_email'
    });
  }
  next();
};

/**
 * Check if user is business owner
 */
export const requireOwner = (req, res, next) => {
  if (req.userRole !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Only business owners can perform this action'
    });
  }
  next();
};

/**
 * API key authentication (for external integrations)
 * Keys are stored as SHA-256 hashes; the raw key is only shown once at creation.
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 128) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    const keyHash = sha256(apiKey);

    // $elemMatch makes sure the hash and enabled flag belong to the SAME key
    const business = await Business.findOne({
      status: 'active',
      apiKeys: { $elemMatch: { keyHash, enabled: true } }
    });

    if (!business) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // API access is a paid feature (Starter and above)
    if (!isSubscriptionActive(business.subscription, Date.now(), config.billing.graceDays)) {
      return res.status(403).json({
        success: false,
        error: 'API access requires a paid plan'
      });
    }

    const keyEntry = business.apiKeys.find(k => k.keyHash === keyHash);

    // Atomic update - avoids saving the whole document on every API call
    Business.updateOne(
      { _id: business._id, 'apiKeys.keyHash': keyHash },
      { $set: { 'apiKeys.$.lastUsed': new Date() } }
    ).catch(err => logger.error('Failed to update API key lastUsed:', err));

    req.business = business;
    req.businessId = String(business._id);
    req.apiKeyPermissions = keyEntry ? keyEntry.permissions : [];
    req.apiKeyId = keyEntry ? String(keyEntry._id) : null;
    req.isApiKeyAuth = true;

    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

export const requireApiKeyPermission = (permission) => (req, res, next) => {
  if (!req.isApiKeyAuth || !req.apiKeyPermissions?.includes(permission)) {
    return res.status(403).json({
      success: false,
      error: `API key requires the ${permission} permission`
    });
  }
  next();
};

export default {
  authenticate,
  requireBusiness,
  requireRole,
  optionalAuth,
  requireEmailVerified,
  requireOwner,
  authenticateApiKey
};
