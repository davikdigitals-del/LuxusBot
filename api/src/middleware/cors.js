/**
 * Minimal CORS for the dashboard (a separate origin from the API).
 * Allowed origins come from CORS_ORIGINS (comma separated), falling back to APP_URL.
 * Server-to-server callers (payment webhooks, API keys) send no Origin header and are unaffected.
 */
export function createCors(allowedOrigins = []) {
  const allowed = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [])
      .map((o) => o.trim().replace(/\/$/, ''))
      .concat(['http://localhost:3001', 'http://127.0.0.1:3001'])
      .filter(Boolean)
  );

  return function cors(req, res, next) {
    const origin = req.headers.origin;
    const ok = Boolean(origin) && allowed.has(origin);

    if (ok) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-API-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS' && origin) {
      res.statusCode = ok ? 204 : 403;
      return res.end();
    }
    return next();
  };
}

export default createCors;
