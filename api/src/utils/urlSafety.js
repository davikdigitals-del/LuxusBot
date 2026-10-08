import net from 'net';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

const isPrivateIPv4 = (ip) => {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
};

const isPrivateIPv6 = (ip) => {
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
};

/**
 * Cheap first-line check for URLs we will call from the server (webhooks, Slack).
 * https only, no localhost/private/link-local hosts.
 *
 * This does NOT stop DNS rebinding: when you actually send a webhook, resolve the
 * hostname and re-check the resulting IP before connecting.
 */
export const isSafeOutboundUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return false;

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal')) return false;

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return !isPrivateIPv4(host);
  if (ipVersion === 6) return !isPrivateIPv6(host);

  return host.includes('.'); // bare hostnames like "intranet" are rejected
};

export default { isSafeOutboundUrl };
