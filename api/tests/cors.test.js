import { test } from 'node:test';
import assert from 'node:assert/strict';

const { createCors } = await import('../src/middleware/cors.js');

const run = (mw, method, origin) => {
  const headers = {};
  const res = { statusCode: 200, setHeader: (k, v) => { headers[k] = v; }, end() { this.ended = true; } };
  let nexted = false;
  mw({ method, headers: origin ? { origin } : {} }, res, () => { nexted = true; });
  return { res, headers, nexted };
};

const mw = createCors(['https://app.example.com', 'http://localhost:3001/']);

test('allowed origin gets CORS headers and continues', () => {
  const r = run(mw, 'GET', 'https://app.example.com');
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://app.example.com');
  assert.equal(r.nexted, true);
});

test('preflight from an allowed origin is answered with 204', () => {
  const r = run(mw, 'OPTIONS', 'http://localhost:3001');
  assert.equal(r.res.statusCode, 204);
  assert.equal(r.nexted, false);
});

test('unknown origin gets no CORS headers and preflight is refused', () => {
  const r = run(mw, 'OPTIONS', 'https://evil.example');
  assert.equal(r.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(r.res.statusCode, 403);
  const g = run(mw, 'GET', 'https://evil.example');
  assert.equal(g.headers['Access-Control-Allow-Origin'], undefined);
});

test('requests with no Origin (Stripe, server-to-server) pass through', () => {
  const r = run(mw, 'POST', undefined);
  assert.equal(r.nexted, true);
});
