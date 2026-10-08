import crypto from 'crypto';
import axios from 'axios';
import { Business } from '../models/index.js';
import logger from '../utils/logger.js';
import { isSafeOutboundUrl } from '../utils/urlSafety.js';

const SIGNATURE_HEADER = 'x-luxus-signature';

function sign(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function dispatchBusinessWebhook(businessId, event, data) {
  const business = await Business.findById(businessId).select('webhooks');
  if (!business?.webhooks?.length) return;

  const body = JSON.stringify({
    id: crypto.randomUUID(),
    event,
    createdAt: new Date().toISOString(),
    businessId: String(businessId),
    data,
  });

  await Promise.allSettled(business.webhooks
    .filter((hook) => hook.enabled && hook.events?.includes(event) && isSafeOutboundUrl(hook.url))
    .map(async (hook) => {
      try {
        await axios.post(hook.url, body, {
          headers: {
            'content-type': 'application/json',
            [SIGNATURE_HEADER]: `sha256=${sign(hook.secret, body)}`,
            'user-agent': 'Luxus-Webhooks/1.0',
          },
          timeout: 8000,
          maxContentLength: 1024 * 1024,
          maxBodyLength: 1024 * 1024,
        });
      } catch (error) {
        logger.warn('Business webhook delivery failed', {
          businessId: String(businessId),
          webhookId: String(hook._id),
          event,
          error: error.message,
        });
      }
    }));
}

export default { dispatchBusinessWebhook };
