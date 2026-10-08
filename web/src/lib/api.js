'use client';

/**
 * Thin fetch wrapper for the Luxus API.
 *  - attaches the access token
 *  - on a 401, tries ONE silent refresh, retries the original call, then
 *    gives up and clears the session (the caller's catch/redirect handles the rest)
 *  - every method returns the parsed JSON body; a non-2xx throws an ApiError
 *    carrying { status, message } so screens can show the server's own message
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const TOKEN_KEY = 'luxus_token';
const REFRESH_KEY = 'luxus_refresh_token';

export const auth = {
  getToken: () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  getRefreshToken: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  setTokens: (token, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  isLoggedIn: () => !!auth.getToken(),
};

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return false;

  refreshPromise = fetch(`${BASE_URL}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      auth.setTokens(data.token, data.refreshToken || refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function request(path, { method = 'GET', body, headers = {}, businessId, skipAuth = false, _retried = false } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };

  if (!skipAuth) {
    const token = auth.getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }
  if (businessId) finalHeaders['x-business-id'] = businessId;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty body (e.g. 204) - fine
  }

  if (res.status === 401 && !skipAuth && !_retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request(path, { method, body, headers, businessId, skipAuth, _retried: true });
    }
    auth.clear();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError('Session expired', 401, data);
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export default api;
