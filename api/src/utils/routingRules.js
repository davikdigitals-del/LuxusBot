const HUMAN_REQUEST = /\b(speak|talk|chat)\s+(to|with)\s+(a|an|some\s?one|somebody|the)?\s*(human|person|agent|representative|rep|manager|staff|team|someone|somebody)\b|\b(real|live)\s+(person|human|agent)\b|\bhuman\s+(agent|being|support)\b|\bcustomer\s+(care|service|support)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Returns { department, reason } or null. Rules are checked in order; first keyword match wins. */
export function classifyMessage(routing, text) {
  const t = String(text || '').toLowerCase();
  for (const rule of routing?.rules || []) {
    // Keywords of 4+ letters also match longer forms (refund -> refunds, refunded);
    // shorter ones stay whole-word so "pay" doesn't fire on "paypal".
    const hit = (rule.keywords || []).find((k) => {
      const tail = k.length >= 4 ? '[a-z0-9]{0,4}' : '';
      return new RegExp(`(^|[^a-z0-9])${escapeRe(k)}${tail}([^a-z0-9]|$)`, 'i').test(t);
    });
    if (hit) return { department: rule.department, reason: `keyword "${hit}"` };
  }
  if (HUMAN_REQUEST.test(t)) {
    return { department: routing?.humanRequestDepartment || '', reason: 'customer asked for a person' };
  }
  return null;
}
