import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupEnv } from './helpers.js';

setupEnv();

const { User, Business, Contact } = await import('../src/models/index.js');
const { createApp, attachErrorHandlers } = await import('../src/app.js');
const { default: authService } = await import('../src/services/authService.js');
const { default: emailService } = await import('../src/services/emailService.js');
const { decrypt, generateApiKey, sha256 } = await import('../src/utils/crypto.js');
const { authenticateApiKey } = await import('../src/middleware/auth.js');
const { isSafeOutboundUrl } = await import('../src/utils/urlSafety.js');

// ---- tiny in-memory "database" (no MongoDB needed) ----
const db = { users: new Map(), businesses: new Map() };

const objectId = () => new mongoose.Types.ObjectId();

const makeBusiness = (overrides = {}) => {
  const b = new Business({
    name: 'Acme', slug: `acme-${Math.random().toString(36).slice(2, 8)}`, owner: objectId(), ...overrides,
  });
  db.businesses.set(String(b._id), b);
  return b;
};

const makeUser = (memberships = [], extra = {}) => {
  const u = new User({
    email: `u${Math.random().toString(36).slice(2, 8)}@test.dev`,
    password: 'x'.repeat(10), firstName: 'T', lastName: 'U', status: 'active',
    memberships: memberships.map(([b, role]) => ({ businessId: b._id, role, status: 'active' })),
    ...extra,
  });
  db.users.set(String(u._id), u);
  return u;
};

const bearer = (user) => ({ Authorization: `Bearer ${authService.generateToken(user._id)}` });

let app;

before(() => {
  // Stub persistence
  Business.prototype.save = async function () { db.businesses.set(String(this._id), this); return this; };
  User.prototype.save = async function () { db.users.set(String(this._id), this); return this; };
  // Works both as `await User.findById(id)` and `await User.findById(id).select(...)`
  User.findById = (id) => {
    const user = db.users.get(String(id)) || null;
    const query = Promise.resolve(user);
    query.select = async () => user;
    return query;
  };
  User.findByEmail = async (email) => [...db.users.values()].find(u => u.email === String(email).toLowerCase()) || null;
  User.findByVerificationToken = async () => null;
  User.findByResetToken = async () => null;
  Business.findById = async (id) => db.businesses.get(String(id)) || null;
  Business.find = async ({ _id }) => _id.$in.map(id => db.businesses.get(String(id))).filter(Boolean);
  // Emulates: { status, apiKeys: { $elemMatch: { keyHash, enabled: true } } }
  Business.findOne = async (q) => {
    const m = q.apiKeys?.$elemMatch;
    return [...db.businesses.values()].find(b =>
      b.status === q.status && b.apiKeys.some(k => k.keyHash === m.keyHash && k.enabled === m.enabled)) || null;
  };
  Business.updateOne = async () => ({ acknowledged: true });

  app = createApp();
  attachErrorHandlers(app);
});

beforeEach(() => { db.users.clear(); db.businesses.clear(); });

// ------------------------------------------------------------------ boot

test('models export Business and Contact; Contact needs phone, not email/password', () => {
  assert.ok(Business && Contact);
  const c = new Contact({ phoneNumber: '2348012345678' });
  assert.equal(c.validateSync(), undefined);
});

test('/health works and unknown routes 404 as JSON', async () => {
  assert.equal((await request(app).get('/health')).status, 200);
  const r = await request(app).get('/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.success, false);
});

test('malformed JSON returns 400, not a stack trace', async () => {
  const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
  assert.equal(r.status, 400);
});

// ------------------------------------------------------------------ auth + tokens

test('public signup creates a workspace without selecting or activating a plan', async () => {
  const r = await request(app).post('/api/auth/register').send({
    email: 'new@test.dev', password: 'longenough1', firstName: 'A', lastName: 'B', businessName: 'Acme Ltd',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(db.users.size, 1);
  assert.equal(db.businesses.size, 1);

  const business = [...db.businesses.values()][0];
  assert.equal(business.subscription.plan, 'none');
  assert.equal(business.subscription.status, 'none');
  assert.equal(business.limits.messagesPerMonth, 0);
  assert.equal(business.onboarding.steps.planSelected, false);
  assert.equal([...db.users.values()][0].getRoleInBusiness(business._id), 'owner');
});

test('public signup validates password and rejects duplicate email', async () => {
  const details = { email: 'new@test.dev', password: 'longenough1', firstName: 'A', lastName: 'B', businessName: 'Acme Ltd' };
  const weak = await request(app).post('/api/auth/register').send({ ...details, password: 'short' });
  assert.equal(weak.status, 400);

  const first = await request(app).post('/api/auth/register').send(details);
  assert.equal(first.status, 201);
  const duplicate = await request(app).post('/api/auth/register').send(details);
  assert.equal(duplicate.status, 409);
});

test('refresh token cannot be used as an access token; access token cannot refresh', async () => {
  const u = makeUser();
  const refresh = authService.generateRefreshToken(u._id);
  const asAccess = await request(app).get('/api/business').set('Authorization', `Bearer ${refresh}`);
  assert.equal(asAccess.status, 401);

  const access = authService.generateToken(u._id);
  const asRefresh = await request(app).post('/api/auth/refresh-token').send({ refreshToken: access });
  assert.equal(asRefresh.status, 401);

  const ok = await request(app).post('/api/auth/refresh-token').send({ refreshToken: refresh });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test('NoSQL operator objects are rejected on token/credential fields', async () => {
  for (const [path, body] of [
    ['/api/auth/reset-password', { token: { $ne: null }, password: 'longenough1' }],
    ['/api/auth/verify-email', { token: { $ne: null } }],
    ['/api/auth/login', { email: { $gt: '' }, password: 'x' }],
    ['/api/auth/forgot-password', { email: { $ne: null } }],
  ]) {
    const r = await request(app).post(path).send(body);
    assert.equal(r.status, 400, `${path} -> ${r.status}`);
  }
});

test('login is rate limited per ip+email (429 after 8 attempts)', async () => {
  const email = 'victim@test.dev';
  let last;
  for (let i = 0; i < 9; i++) {
    last = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass1' });
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers['retry-after']);
  // a different account from the same ip is not locked out by the per-account limiter
  const other = await request(app).post('/api/auth/login').send({ email: 'other@test.dev', password: 'wrongpass1' });
  assert.equal(other.status, 401);
});

// ------------------------------------------------------------------ tenant isolation

test('cannot read another business by pairing your own x-business-id with their URL id', async () => {
  const mine = makeBusiness(); const theirs = makeBusiness({ name: 'Victim Co' });
  const u = makeUser([[mine, 'owner']]);

  const spoof = await request(app).get(`/api/business/${theirs._id}`).set({ ...bearer(u), 'x-business-id': String(mine._id) });
  assert.equal(spoof.status, 400);

  const direct = await request(app).get(`/api/business/${theirs._id}`).set(bearer(u));
  assert.equal(direct.status, 403);

  const own = await request(app).get(`/api/business/${mine._id}`).set(bearer(u));
  assert.equal(own.status, 200);
  assert.equal(own.body.business.name, 'Acme');
});

test('cannot edit or delete another business either', async () => {
  const mine = makeBusiness(); const theirs = makeBusiness({ name: 'Victim Co' });
  const u = makeUser([[mine, 'owner']]);
  const put = await request(app).put(`/api/business/${theirs._id}`).set({ ...bearer(u), 'x-business-id': String(mine._id) }).send({ name: 'Pwned' });
  assert.equal(put.status, 400);
  const del = await request(app).delete(`/api/business/${theirs._id}`).set(bearer(u));
  assert.equal(del.status, 403);
  assert.equal(db.businesses.get(String(theirs._id)).name, 'Victim Co');
  assert.equal(db.businesses.get(String(theirs._id)).status, 'active');
});

test('invalid business id is a 400, not a 500', async () => {
  const u = makeUser();
  const r = await request(app).get('/api/business/not-an-id').set(bearer(u));
  assert.equal(r.status, 400);
});

test('roles: viewer cannot update, admin can; nested merge keeps other settings; limits are not editable', async () => {
  const b = makeBusiness();
  const viewer = makeUser([[b, 'viewer']]); const admin = makeUser([[b, 'admin']]);

  assert.equal((await request(app).put(`/api/business/${b._id}`).set(bearer(viewer)).send({ name: 'X' })).status, 403);

  const r = await request(app).put(`/api/business/${b._id}`).set(bearer(admin)).send({
    assistant: { name: 'Zed' }, limits: { messagesPerMonth: 999999 }, subscription: { plan: 'pro' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const saved = db.businesses.get(String(b._id));
  assert.equal(saved.assistant.name, 'Zed');
  assert.equal(saved.assistant.personality, 'professional, helpful, friendly'); // untouched
  assert.equal(saved.limits.messagesPerMonth, 0);
  assert.equal(saved.subscription.plan, 'none');
});

test('business settings persist custom weekday hours, timezone, and after-hours message', async () => {
  const business = makeBusiness();
  const owner = makeUser([[business, 'owner']]);
  const settings = {
    enabled: true,
    timezone: 'Africa/Lagos',
    schedule: {
      monday: { start: '08:30', end: '17:15', enabled: true },
      tuesday: { start: '09:00', end: '18:00', enabled: false },
    },
    outOfHoursMessage: 'Our team is away. We will reply during business hours.',
  };

  const response = await request(app)
    .put(`/api/business/${business._id}`)
    .set(bearer(owner))
    .send({ businessHours: settings });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const saved = db.businesses.get(String(business._id)).businessHours;
  assert.equal(saved.enabled, true);
  assert.equal(saved.timezone, 'Africa/Lagos');
  assert.deepEqual(saved.schedule.monday, settings.schedule.monday);
  assert.deepEqual(saved.schedule.tuesday, settings.schedule.tuesday);
  assert.equal(saved.outOfHoursMessage, settings.outOfHoursMessage);
});

test('input validation on business update', async () => {
  const b = makeBusiness(); const owner = makeUser([[b, 'owner']]);
  const put = (body) => request(app).put(`/api/business/${b._id}`).set(bearer(owner)).send(body);
  assert.equal((await put({ primaryColor: 'red' })).status, 400);
  assert.equal((await put({ name: '' })).status, 400);
  assert.equal((await put({ logo: 'javascript:alert(1)' })).status, 400);
  assert.equal((await put({ notifications: { slack: { webhookUrl: 'http://localhost:9000/x' } } })).status, 400);
  assert.equal((await put({ primaryColor: '#112233' })).status, 200);
});

// ------------------------------------------------------------------ secrets

test('AI keys are stored encrypted and never returned', async () => {
  const b = makeBusiness(); const owner = makeUser([[b, 'owner']]);
  const raw = 'sk-test-1234567890abcdef';
  const r = await request(app).put(`/api/business/${b._id}/ai-config`).set(bearer(owner)).send({ anthropicKey: raw });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.aiConfig.anthropicKeySet, true);
  assert.ok(!JSON.stringify(r.body).includes(raw));

  const stored = db.businesses.get(String(b._id)).aiConfig.anthropicKey;
  assert.ok(stored.startsWith('v1:') && !stored.includes(raw));
  assert.equal(decrypt(stored), raw);

  const get = await request(app).get(`/api/business/${b._id}`).set(bearer(owner));
  assert.ok(!JSON.stringify(get.body).includes(stored));

  const bad = await request(app).put(`/api/business/${b._id}/ai-config`).set(bearer(owner)).send({ anthropicKey: 'short' });
  assert.equal(bad.status, 400);
  assert.equal((await request(app).put(`/api/business/${b._id}/ai-config`).set(bearer(owner)).send({ temperature: 5 })).status, 400);

  const clear = await request(app).put(`/api/business/${b._id}/ai-config`).set(bearer(owner)).send({ anthropicKey: '' });
  assert.equal(clear.body.aiConfig.anthropicKeySet, false);
});

test('webhooks: https + public host only, secret generated server-side and shown once', async () => {
  const b = makeBusiness(); const owner = makeUser([[b, 'owner']]);
  const post = (body) => request(app).post(`/api/business/${b._id}/webhooks`).set(bearer(owner)).send(body);

  assert.equal((await post({ name: 'w', url: 'http://example.com/h', events: ['message.received'] })).status, 400);
  assert.equal((await post({ name: 'w', url: 'https://169.254.169.254/latest', events: ['message.received'] })).status, 400);
  assert.equal((await post({ name: 'w', url: 'https://example.com/h', events: ['drop.tables'] })).status, 400);

  const ok = await post({ name: 'w', url: 'https://example.com/h', events: ['message.received'], secret: 'attacker-chosen' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.webhook.secret.length, 64);
  assert.notEqual(ok.body.webhook.secret, 'attacker-chosen');

  const get = await request(app).get(`/api/business/${b._id}`).set(bearer(owner));
  assert.equal(get.body.business.webhooks[0].secret, undefined);
});

test('isSafeOutboundUrl blocks private, local and non-https targets', () => {
  for (const bad of ['http://a.com', 'https://localhost/x', 'https://127.0.0.1', 'https://10.0.0.5', 'https://192.168.1.1',
    'https://172.20.0.1', 'https://169.254.169.254', 'https://[::1]/', 'https://intranet/', 'https://u:p@a.com', 'ftp://a.com', 'nonsense']) {
    assert.equal(isSafeOutboundUrl(bad), false, bad);
  }
  assert.equal(isSafeOutboundUrl('https://hooks.slack.com/services/T/B/X'), true);
});

// ------------------------------------------------------------------ API keys

const runApiKeyAuth = async (headerKey) => {
  const req = { headers: headerKey ? { 'x-api-key': headerKey } : {} };
  let status = 200; let body; let nexted = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  await authenticateApiKey(req, res, () => { nexted = true; });
  return { status, body, nexted, req };
};

test('API keys: stored hashed, matched by hash, paid plans only, disabled keys rejected', async () => {
  const { key, prefix, keyHash } = generateApiKey('test');
  assert.equal(keyHash, sha256(key));
  assert.equal(prefix, key.slice(0, 12));

  const paid = makeBusiness({ subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) }, apiKeys: [{ name: 'ci', keyHash, prefix, permissions: ['messages:send'] }] });
  const ok = await runApiKeyAuth(key);
  assert.equal(ok.nexted, true);
  assert.equal(ok.req.businessId, String(paid._id));
  assert.deepEqual(ok.req.apiKeyPermissions, ['messages:send']);

  assert.equal((await runApiKeyAuth('lx_test_wrong')).status, 401);
  assert.equal((await runApiKeyAuth(undefined)).status, 401);
  // raw key stored by mistake must not authenticate (only hashes are compared)
  assert.equal((await runApiKeyAuth(keyHash)).status, 401);

  paid.apiKeys[0].enabled = false;
  assert.equal((await runApiKeyAuth(key)).status, 401);

  paid.apiKeys[0].enabled = true; paid.subscription.plan = 'none';
  assert.equal((await runApiKeyAuth(key)).status, 403);
});
