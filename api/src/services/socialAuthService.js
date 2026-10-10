import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Business, User } from '../models/index.js';
import config from '../config/index.js';
import authService from './authService.js';
import { isSubscriptionActive } from '../utils/subscriptionState.js';

const PROVIDERS = {
  github: {
    idField: 'githubId',
    scope: 'read:user user:email',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
  },
  discord: {
    idField: 'discordId',
    scope: 'identify email',
    authorizationUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
  },
};

const providerConfig = (provider) => {
  const definition = PROVIDERS[provider];
  if (!definition) throw new Error('Unsupported sign-in provider');
  const credentials = config.socialAuth?.[provider];
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new Error(`${provider} sign-in is not configured`);
  }
  return { ...definition, ...credentials };
};

const getJson = async (fetchImpl, url, options) => {
  const response = await fetchImpl(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error_description || result.message || `Provider request failed (${response.status})`);
  }
  return result;
};

class SocialAuthService {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetch = fetchImpl;
  }

  getAuthorizationUrl(provider, state, redirectUri) {
    const settings = providerConfig(provider);
    const url = new URL(settings.authorizationUrl);
    url.searchParams.set('client_id', settings.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', settings.scope);
    url.searchParams.set('state', state);
    if (provider === 'discord') url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  async fetchProfile(provider, code, redirectUri) {
    const settings = providerConfig(provider);
    if (typeof code !== 'string' || !code || code.length > 2048) {
      throw new Error('Invalid authorization response');
    }

    const token = await getJson(this.fetch, settings.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'LuxusBot',
      },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (typeof token.access_token !== 'string' || !token.access_token) {
      throw new Error('Provider did not return an access token');
    }

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/json',
      'User-Agent': 'LuxusBot',
    };

    if (provider === 'github') {
      const [user, emails] = await Promise.all([
        getJson(this.fetch, 'https://api.github.com/user', { headers }),
        getJson(this.fetch, 'https://api.github.com/user/emails', { headers }),
      ]);
      const email = emails.find((entry) => entry.primary && entry.verified)?.email;
      if (!user.id || !email) throw new Error('GitHub must provide a verified email address');
      const names = String(user.name || user.login || '').trim().split(/\s+/);
      return {
        provider,
        providerId: String(user.id),
        email: email.trim().toLowerCase(),
        firstName: String(names[0] || 'GitHub').slice(0, 60),
        lastName: String(names.slice(1).join(' ') || 'User').slice(0, 60),
        avatar: typeof user.avatar_url === 'string' && user.avatar_url.startsWith('https://') ? user.avatar_url : null,
      };
    }

    const user = await getJson(this.fetch, 'https://discord.com/api/users/@me', { headers });
    if (!user.id || user.verified !== true || typeof user.email !== 'string') {
      throw new Error('Discord must provide a verified email address');
    }
    const names = String(user.global_name || user.username || '').trim().split(/\s+/);
    const avatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png`
      : null;
    return {
      provider,
      providerId: String(user.id),
      email: user.email.trim().toLowerCase(),
      firstName: String(names[0] || 'Discord').slice(0, 60),
      lastName: String(names.slice(1).join(' ') || 'User').slice(0, 60),
      avatar,
    };
  }

  createOAuthTicket(profile) {
    return jwt.sign(
      { purpose: 'social-oauth', profile },
      config.jwtSecret,
      { expiresIn: '5m', algorithm: 'HS256' }
    );
  }

  createSignupTicket(profile) {
    return jwt.sign(
      { purpose: 'social-signup', profile },
      config.jwtSecret,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  }

  verifyTicket(ticket, purpose) {
    if (typeof ticket !== 'string' || ticket.length > 8192) {
      throw new Error('A valid social sign-in ticket is required');
    }
    let payload;
    try {
      payload = jwt.verify(ticket, config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw new Error('Social sign-in expired. Please try again.');
    }
    if (payload.purpose !== purpose || !payload.profile) {
      throw new Error('Invalid social sign-in ticket');
    }
    return payload.profile;
  }

  async completeLogin(ticket, ipAddress, userAgent) {
    const profile = this.verifyTicket(ticket, 'social-oauth');
    if (!PROVIDERS[profile.provider] || !profile.providerId || !profile.email) {
      throw new Error('Invalid social sign-in profile');
    }

    const { idField } = PROVIDERS[profile.provider];
    let user = await User.findOne({ [idField]: profile.providerId, status: 'active' });
    if (!user) {
      user = await User.findByEmail(profile.email);
      if (!user) {
        return {
          registered: false,
          signupTicket: this.createSignupTicket(profile),
          profile: {
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
          },
        };
      }
      if (!user.emailVerified) {
        throw new Error('Verify this email address before linking a social sign-in method');
      }
      if (user[idField] && user[idField] !== profile.providerId) {
        throw new Error(`This email is linked to a different ${profile.provider} account`);
      }
      user[idField] = profile.providerId;
      user.emailVerified = true;
    }
    if (user.status !== 'active') throw new Error('This account is not active');

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

  verifySignupTicket(ticket) {
    const profile = this.verifyTicket(ticket, 'social-signup');
    if (
      !PROVIDERS[profile.provider] ||
      !profile.providerId ||
      !profile.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(profile.email)
    ) {
      throw new Error('Invalid social signup ticket');
    }
    return profile;
  }

  createState() {
    return crypto.randomBytes(32).toString('base64url');
  }
}

export default new SocialAuthService();
export { SocialAuthService };
