import { OAuth2Client } from 'google-auth-library';
import { Business, User } from '../models/index.js';
import config from '../config/index.js';
import { isSubscriptionActive } from '../utils/subscriptionState.js';
import authService from './authService.js';

class GoogleAuthService {
  constructor({ client = new OAuth2Client(config.google.clientId) } = {}) {
    this.client = client;
  }

  async verifyCredential(credential) {
    if (!config.google.clientId) {
      throw new Error('Google sign-in is not configured');
    }
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 8192) {
      throw new Error('A valid Google credential is required');
    }

    const ticket = await this.client.verifyIdToken({
      idToken: credential,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error('Google did not return a verified email address');
    }

    const names = String(payload.name || '').trim().split(/\s+/);
    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      firstName: String(payload.given_name || names[0] || '').trim().slice(0, 60),
      lastName: String(payload.family_name || names.slice(1).join(' ') || '').trim().slice(0, 60),
    };
  }

  async login(credential, ipAddress, userAgent) {
    const profile = await this.verifyCredential(credential);
    let user = await User.findOne({ googleId: profile.googleId, status: 'active' });

    if (!user) {
      user = await User.findByEmail(profile.email);
      if (!user) return { registered: false, profile };
      if (user.googleId && user.googleId !== profile.googleId) {
        throw new Error('This email is linked to a different Google account');
      }
      user.googleId = profile.googleId;
      user.emailVerified = true;
    }

    user.lastLogin = new Date();
    user.lastLoginIp = ipAddress;
    user.loginHistory ||= [];
    user.loginHistory.push({ ip: ipAddress, userAgent, timestamp: new Date() });
    if (user.loginHistory.length > 10) user.loginHistory = user.loginHistory.slice(-10);
    await user.save();

    const ownedBusinessIds = user.memberships
      .filter((membership) => membership.status === 'active' && membership.role === 'owner')
      .map((membership) => membership.businessId);
    const ownedBusinesses = ownedBusinessIds.length
      ? await Business.find({ _id: { $in: ownedBusinessIds } })
      : [];
    const requiresPayment = ownedBusinesses.length > 0 &&
      !ownedBusinesses.some((business) => isSubscriptionActive(
        business.subscription,
        Date.now(),
        config.billing.graceDays
      ));

    return {
      registered: true,
      requiresPayment,
      user: authService.sanitizeUser(user),
      token: authService.generateToken(user._id),
      refreshToken: authService.generateRefreshToken(user._id),
    };
  }
}

export default new GoogleAuthService();
export { GoogleAuthService };
