import moment from 'moment-timezone';
import config from '../config/index.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Check if current time is within business hours. Accepts two shapes:
 *  - the platform-level default (config.businessHours): flat { start, end, timezone, days }
 *  - a tenant's real Business.businessHours: { enabled, timezone, schedule: { monday: {start,end,enabled}, ... } }
 * Pass a tenant's businessHours to check against that tenant's hours instead
 * of the platform default.
 */
export const isBusinessHours = (businessHours = config.businessHours) => {
  const now = moment().tz(businessHours.timezone || 'UTC');

  // Tenant shape: has a `schedule` object (per-day) rather than flat start/end
  if (businessHours.schedule) {
    if (!businessHours.enabled) return true; // hours not enforced for this business - always "available"
    const today = businessHours.schedule[DAY_NAMES[now.day()]];
    if (!today || !today.enabled || !today.start || !today.end) return false;
    const currentTime = now.format('HH:mm');
    return currentTime >= today.start && currentTime <= today.end;
  }

  // Legacy flat shape
  const currentDay = now.day(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = now.format('HH:mm');
  const businessDays = String(businessHours.days).split(',').map(d => parseInt(d, 10));
  if (!businessDays.includes(currentDay)) {
    return false;
  }
  return currentTime >= businessHours.start && currentTime <= businessHours.end;
};

/**
 * Human-readable business hours for both shapes accepted by isBusinessHours()
 * above - used in the AI system prompt and the off-hours customer notice.
 */
export const formatBusinessHours = (businessHours = config.businessHours) => {
  if (businessHours.schedule) {
    if (!businessHours.enabled) return 'no fixed hours';
    const today = businessHours.schedule[DAY_NAMES[moment().tz(businessHours.timezone || 'UTC').day()]];
    if (!today || !today.enabled) return `closed today (${businessHours.timezone || 'UTC'})`;
    return `${today.start} - ${today.end} ${businessHours.timezone || 'UTC'} (today)`;
  }
  return `${businessHours.start} - ${businessHours.end} ${businessHours.timezone}`;
};

export const formatNextBusinessOpening = (businessHours, now = moment()) => {
  if (!businessHours.schedule || !businessHours.enabled) return '';

  const timezone = businessHours.timezone || 'UTC';
  const localNow = now.clone().tz(timezone);
  const todayName = DAY_NAMES[localNow.day()];
  const today = businessHours.schedule[todayName];
  const currentTime = localNow.format('HH:mm');

  if (today?.enabled && today.start && today.end && currentTime < today.start) {
    return `We're currently closed. We open today at ${moment(today.start, 'HH:mm').format('h:mm A')} (${timezone}).`;
  }

  for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
    const nextDay = localNow.clone().add(daysAhead, 'days');
    const schedule = businessHours.schedule[DAY_NAMES[nextDay.day()]];
    if (!schedule?.enabled || !schedule.start || !schedule.end) continue;

    const openingTime = moment(schedule.start, 'HH:mm').format('h:mm A');
    if (daysAhead === 1) {
      return `We're closed for today. Please come back tomorrow at ${openingTime} (${timezone}).`;
    }
    return `We're closed today. Please come back ${nextDay.format('dddd')} at ${openingTime} (${timezone}).`;
  }

  return "We're currently closed. Please check back later for our opening hours.";
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  return phone.replace(/[^\d]/g, '');
};

/**
 * Sanitize input text
 */
export const sanitizeInput = (text) => {
  if (!text) return '';
  return text.trim().replace(/[<>]/g, '');
};

/**
 * Extract keywords from text
 */
export const extractKeywords = (text) => {
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  return [...new Set(words)];
};

/**
 * Calculate similarity between two texts
 */
export const calculateSimilarity = (text1, text2) => {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

/**
 * Truncate text to a maximum length
 */
export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Generate unique ID
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Sleep/delay function
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Parse intent from message
 */
export const parseIntent = (message) => {
  const lowerMessage = message.toLowerCase();
  
  const intents = {
    greeting: /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
    farewell: /(bye|goodbye|see you|thanks|thank you)/i,
    help: /(help|support|assist|problem|issue)/i,
    product: /(product|item|buy|purchase|price|cost)/i,
    order: /(order|delivery|shipping|track)/i,
    appointment: /(appointment|meeting|schedule|book)/i,
    complaint: /(complain|complaint|unhappy|disappointed|angry|frustrated)/i,
    feedback: /(feedback|review|rating|opinion)/i,
    hr: /(leave|vacation|holiday|salary|payroll|hr)/i,
  };
  
  for (const [intent, pattern] of Object.entries(intents)) {
    if (pattern.test(lowerMessage)) {
      return intent;
    }
  }
  
  return 'general';
};

/**
 * Extract email from text
 */
export const extractEmail = (text) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
};

/**
 * Extract phone from text
 */
export const extractPhone = (text) => {
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0] : null;
};

/**
 * Format duration in human readable format
 */
export const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(delay * Math.pow(2, attempt - 1));
    }
  }
};

/**
 * Chunk array into smaller arrays
 */
export const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export default {
  isBusinessHours,
  formatPhoneNumber,
  sanitizeInput,
  extractKeywords,
  calculateSimilarity,
  truncateText,
  generateId,
  sleep,
  parseIntent,
  extractEmail,
  extractPhone,
  formatDuration,
  retry,
  chunkArray,
};
