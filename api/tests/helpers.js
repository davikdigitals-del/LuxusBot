import crypto from 'crypto';

// Must run before src/config is imported
export const setupEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.MONGODB_URI ||= 'mongodb://localhost:27017/test';
  process.env.MONGODB_DB_NAME ||= 'test';
  process.env.LOG_LEVEL = 'error';
};
