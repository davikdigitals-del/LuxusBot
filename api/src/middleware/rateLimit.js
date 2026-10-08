import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger.js';

/**
 * In-memory limiters: fine for a single API process.
 * When you run several instances, swap RateLimiterMemory for RateLimiterRedis.
 */
const buildLimiter = ({ points, duration, key, message }) => {
  const limiter = new RateLimiterMemory({ points, duration });

  return async (req, res, next) => {
    try {
      await limiter.consume(key(req));
      next();
    } catch (rejection) {
      // Real errors (not a rate-limit rejection): don't block users because the limiter broke
      if (rejection instanceof Error) {
        logger.error('Rate limiter error:', rejection);
        return next();
      }

      const retryAfter = Math.max(1, Math.ceil(rejection.msBeforeNext / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter
      });
    }
  };
};

const ip = (req) => req.ip || req.socket?.remoteAddress || 'unknown';
const email = (req) => String(req.body?.email || '').toLowerCase().slice(0, 254);

const MIN = 60;
const HOUR = 60 * MIN;

// Each entry is an array of middleware: Express runs them in order
export const authLimiters = {
  login: [
    buildLimiter({ points: 30, duration: 15 * MIN, key: (req) => `login:ip:${ip(req)}`, message: 'Too many login attempts. Try again later.' }),
    buildLimiter({ points: 8, duration: 15 * MIN, key: (req) => `login:${ip(req)}:${email(req)}`, message: 'Too many login attempts for this account. Try again later.' }),
  ],
  register: [
    buildLimiter({ points: 5, duration: HOUR, key: (req) => `register:ip:${ip(req)}`, message: 'Too many sign-ups from this address. Try again later.' }),
  ],
  contact: [
    buildLimiter({ points: 5, duration: HOUR, key: (req) => `contact:ip:${ip(req)}`, message: 'Too many contact requests. Try again later.' }),
  ],
  password: [
    buildLimiter({ points: 10, duration: HOUR, key: (req) => `pwd:ip:${ip(req)}`, message: 'Too many requests. Try again later.' }),
    buildLimiter({ points: 3, duration: HOUR, key: (req) => `pwd:${ip(req)}:${email(req)}`, message: 'Too many requests for this account. Try again later.' }),
  ],
  refresh: [
    buildLimiter({ points: 60, duration: HOUR, key: (req) => `refresh:ip:${ip(req)}`, message: 'Too many token refreshes. Try again later.' }),
  ],
};

export default authLimiters;
