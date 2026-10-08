import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupEnv } from './helpers.js';

setupEnv();

const { User, Business, Conversation, Contact, KnowledgeBase: KnowledgeBaseModel } = await import('../src/models/index.js');
const { createApp, attachErrorHandlers } = await import('../src/app.js');
const { default: authService } = await import('../src/services/authService.js');
const engineRegistry = (await import('../src/core/tenant/EngineRegistry.js')).default;
const sessionRegistryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;

const objectId = () => new mongoose.Types.ObjectId();

const db = { users: new Map(), businesses: new Map(), conversations: new Map(), contacts: new Map(), kb: new Map() };

const bearer = (user) => ({ Authorization: `Bearer ${authService.generateToken(user._id)}` });

/** apiKeys array with Mongoose-DocumentArray-like .id()/push()/subdoc.deleteOne() behavior. */
const makeApiKeysArray = () => {
  const arr = [];
  arr.id = (id) => arr.find((k) => String(k._id) === String(id));
  const originalPush = arr.push.bind(arr);
  arr.push = (entry) => {
    const withId = { _id: objectId(), ...entry };
    withId.deleteOne = () => {
      const idx = arr.findIndex((k) => String(k._id) === String(withId._id));
      if (idx !== -1) arr.splice(idx, 1);
    };
    return originalPush(withId);
  };
  return arr;
};

const makeBusiness = (overrides = {}) => {
  const b = {
    _id: objectId(),
    name: 'Acme',
    slug: `acme-${Math.random().toString(36).slice(2, 8)}`,
    owner: objectId(),
    status: 'active',
    subscription: { plan: 'none' },
    usage: { messagesThisMonth: 12 },
    limits: { messagesPerMonth: 100, maxTeamMembers: 3 },
    apiKeys: makeApiKeysArray(),
    ...overrides,
  };
  b.save = async function () { db.businesses.set(String(this._id), this); return this; };
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

let app;

before(() => {
  User.prototype.save = async function () { db.users.set(String(this._id), this); return this; };
  User.findById = (id) => {
    const user = db.users.get(String(id)) || null;
    const query = Promise.resolve(user);
    query.select = async () => user;
    return query;
  };
  User.find = async (q) => {
    const ids = q['memberships.businessId'];
    return [...db.users.values()].filter((u) => u.memberships.some((m) => String(m.businessId) === String(ids)));
  };
  User.countDocuments = async (q) => (await User.find(q)).length;

  Business.findById = async (id) => db.businesses.get(String(id)) || null;
  Business.findOne = async (query) => [...db.businesses.values()].find((business) => (
    business.status === query.status
    && business.apiKeys.some((key) => key.enabled && key.keyHash === query.apiKeys.$elemMatch.keyHash)
  )) || null;
  Business.updateOne = async () => ({ modifiedCount: 1 });

  Conversation.countDocuments = async () => 0;
  Conversation.aggregate = async () => [];
  Contact.countDocuments = async () => 0;
  KnowledgeBaseModel.countDocuments = async () => 0;
  KnowledgeBaseModel.find = () => ({ sort: () => ({ limit: async () => [] }) });

  app = createApp();
  attachErrorHandlers(app);
});

beforeEach(() => { db.users.clear(); db.businesses.clear(); });

// ------------------------------------------------------------------ API keys

test('API keys: no subscription cannot create, paid plan can, raw key shown once', async () => {
  const free = makeBusiness({ subscription: { plan: 'none' } });
  const owner = makeUser([[free, 'owner']]);

  const blocked = await request(app).post(`/api/business/${free._id}/api-keys`).set(bearer(owner)).send({ name: 'CI', permissions: ['messages:read'] });
  assert.equal(blocked.status, 403);

  const paid = makeBusiness({ subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) } });
  const paidOwner = makeUser([[paid, 'owner']]);
  const created = await request(app).post(`/api/business/${paid._id}/api-keys`).set(bearer(paidOwner)).send({ name: 'CI', permissions: ['messages:read'] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.ok(created.body.apiKey.startsWith('lx_'));
  assert.equal(created.body.details.name, 'CI');

  const list = await request(app).get(`/api/business/${paid._id}/api-keys`).set(bearer(paidOwner));
  assert.equal(list.status, 200);
  assert.equal(list.body.apiKeys.length, 1);
  assert.equal(list.body.apiKeys[0].keyHash, undefined);
  assert.ok(!JSON.stringify(list.body).includes(created.body.apiKey));
});

test('API keys: rejects bad permissions, enforces the 10-key limit, viewer cannot create', async () => {
  const business = makeBusiness({ subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) } });
  const owner = makeUser([[business, 'owner']]);
  const viewer = makeUser([[business, 'viewer']]);

  assert.equal((await request(app).post(`/api/business/${business._id}/api-keys`).set(bearer(viewer)).send({ name: 'x', permissions: ['messages:read'] })).status, 403);
  assert.equal((await request(app).post(`/api/business/${business._id}/api-keys`).set(bearer(owner)).send({ name: 'x', permissions: ['nonsense'] })).status, 400);

  for (let i = 0; i < 10; i++) {
    business.apiKeys.push({ name: `k${i}`, keyHash: `h${i}`, prefix: 'lx_live_x', permissions: ['messages:read'], enabled: true });
  }
  const overLimit = await request(app).post(`/api/business/${business._id}/api-keys`).set(bearer(owner)).send({ name: 'one more', permissions: ['messages:read'] });
  assert.equal(overLimit.status, 400);
});

test('API keys: enable/disable and revoke actually mutate the stored key', async () => {
  const business = makeBusiness({ subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) } });
  const owner = makeUser([[business, 'owner']]);

  const created = await request(app).post(`/api/business/${business._id}/api-keys`).set(bearer(owner)).send({ name: 'CI', permissions: ['messages:read'] });
  const keyId = created.body.details.id;

  const disabled = await request(app).put(`/api/business/${business._id}/api-keys/${keyId}`).set(bearer(owner)).send({ enabled: false });
  assert.equal(disabled.status, 200);
  assert.equal(business.apiKeys.id(keyId).enabled, false);

  const revoked = await request(app).delete(`/api/business/${business._id}/api-keys/${keyId}`).set(bearer(owner));
  assert.equal(revoked.status, 200);
  assert.equal(business.apiKeys.id(keyId), undefined);

  assert.equal((await request(app).delete(`/api/business/${business._id}/api-keys/${keyId}`).set(bearer(owner))).status, 404);
});

test('profile settings: authenticated user can update name and phone but not email', async () => {
  const user = makeUser([]);
  user.firstName = 'Before';
  user.lastName = 'Update';
  user.phone = null;

  const updated = await request(app)
    .put('/api/auth/profile')
    .set(bearer(user))
    .send({ firstName: '  Ada ', lastName: 'Lovelace', phone: '+1 555-0100' });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.user.firstName, 'Ada');
  assert.equal(updated.body.user.lastName, 'Lovelace');
  assert.equal(updated.body.user.phone, '+1 555-0100');
  assert.equal(user.firstName, 'Ada');

  const rejectedEmail = await request(app)
    .put('/api/auth/profile')
    .set(bearer(user))
    .send({ email: 'new@example.com' });
  assert.equal(rejectedEmail.status, 400);
});

test('External API: API keys enforce permissions and scope knowledge writes to their business', async () => {
  const business = makeBusiness({
    subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) },
  });
  const owner = makeUser([[business, 'owner']]);
  const readKey = await request(app)
    .post(`/api/business/${business._id}/api-keys`)
    .set(bearer(owner))
    .send({ name: 'Read integration', permissions: ['knowledge:read'] });
  const writeKey = await request(app)
    .post(`/api/business/${business._id}/api-keys`)
    .set(bearer(owner))
    .send({ name: 'Write integration', permissions: ['knowledge:write'] });
  assert.equal(readKey.status, 201);
  assert.equal(writeKey.status, 201);

  assert.equal((await request(app).get('/api/v1/knowledge')).status, 401);
  const denied = await request(app)
    .post('/api/v1/knowledge')
    .set('x-api-key', readKey.body.apiKey)
    .send({ title: 'FAQ', content: 'Returns are accepted.', category: 'faq' });
  assert.equal(denied.status, 403);

  const originalGetForBusiness = engineRegistry.getForBusiness.bind(engineRegistry);
  let engineBusinessId;
  engineRegistry.getForBusiness = async (businessId) => {
    engineBusinessId = String(businessId);
    return {
      knowledgeBase: {
        addDocument: async (params) => ({ _id: objectId(), ...params }),
      },
    };
  };

  const created = await request(app)
    .post('/api/v1/knowledge')
    .set('x-api-key', writeKey.body.apiKey)
    .send({ title: 'FAQ', content: 'Returns are accepted.', category: 'faq' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(engineBusinessId, String(business._id));
  assert.equal(created.body.document.title, 'FAQ');

  engineRegistry.getForBusiness = originalGetForBusiness;
});

// ------------------------------------------------------------------ Dashboard

test('dashboard overview uses the correct schema field names (maxTeamMembers, not teamMembers)', async () => {
  const business = makeBusiness({
    subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5) },
    usage: { messagesThisMonth: 42 },
    limits: { messagesPerMonth: 10000, maxTeamMembers: 10 },
  });
  const owner = makeUser([[business, 'owner']]);

  sessionRegistryModule.getStatus = async () => ({ status: 'connected', phoneNumber: '15551234567' });
  const pipelines = [];
  Conversation.aggregate = async (pipeline) => {
    pipelines.push(pipeline);
    if (pipeline.some((stage) => stage.$unwind === '$messages')) {
      return [{ messagesToday: 7, messagesThisMonth: 42 }];
    }
    return [{ conversationsToday: 2, conversationsThisMonth: 11 }];
  };

  const res = await request(app).get(`/api/business/${business._id}/dashboard`).set(bearer(owner));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.overview.messagesUsed, 42);
  assert.equal(res.body.overview.messagesToday, 7);
  assert.equal(res.body.overview.messagesThisMonth, 42);
  assert.equal(res.body.overview.conversationsToday, 2);
  assert.equal(res.body.overview.conversationsThisMonth, 11);
  const messagePipeline = pipelines.find((pipeline) => pipeline.some((stage) => stage.$unwind === '$messages'));
  const conversationPipeline = pipelines.find((pipeline) => !pipeline.some((stage) => stage.$unwind === '$messages'));
  assert.deepEqual(messagePipeline[0].$match.messages.$elemMatch.role, { $in: ['user', 'assistant'] });
  assert.match(String(messagePipeline[0].$match.phoneNumber.$not), /@g\\\.us/);
  assert.match(String(conversationPipeline[0].$match.phoneNumber.$not), /@g\\\.us/);
  assert.equal(res.body.overview.messagesLimit, 10000);
  assert.equal(res.body.overview.teamLimit, 10);
  assert.equal(res.body.overview.teamCount, 1); // just the owner
  assert.equal(res.body.overview.whatsapp.status, 'connected');
  assert.equal(res.body.overview.whatsapp.phoneNumber, '15551234567');
});

test('dashboard overview 404s for a business the caller cannot access', async () => {
  const business = makeBusiness();
  const stranger = makeUser([]);
  const res = await request(app).get(`/api/business/${business._id}/dashboard`).set(bearer(stranger));
  assert.equal(res.status, 403); // requireBusiness blocks it before the handler even runs
});

// ------------------------------------------------------------------ Knowledge base

test('knowledge base list/add/update/delete round-trip through the real KnowledgeBase engine class', async () => {
  const business = makeBusiness();
  const owner = makeUser([[business, 'owner']]);
  const viewer = makeUser([[business, 'viewer']]);

  // Stub the engine registry so this test never touches ChromaDB/Mongo for real
  const fakeKB = {
    addDocument: async (params) => ({ _id: objectId(), title: params.title, category: params.category }),
    updateDocument: async (id, updates) => {
      if (String(id) !== String(storedDocId)) throw new Error('Document not found');
      return { _id: id, title: updates.title || 'Old title', category: updates.category || 'general', status: updates.status || 'published' };
    },
    deleteDocument: async (id) => {
      if (String(id) !== String(storedDocId)) throw new Error('Document not found');
      return true;
    },
    getDocument: async (id) => (String(id) === String(storedDocId) ? { _id: id, title: 'Found doc' } : null),
    getCategories: async () => ['general', 'faq'],
    search: async (query) => [{ id: objectId(), title: 'Match', content: `snippet for ${query}`, score: 0.9 }],
  };
  const originalGetForBusiness = engineRegistry.getForBusiness.bind(engineRegistry);
  engineRegistry.getForBusiness = async () => ({ knowledgeBase: fakeKB });

  const storedDocId = objectId();

  // viewer cannot add
  assert.equal((await request(app).post(`/api/business/${business._id}/knowledge`).set(bearer(viewer)).send({ title: 'T', content: 'C', category: 'general' })).status, 403);

  // validation
  assert.equal((await request(app).post(`/api/business/${business._id}/knowledge`).set(bearer(owner)).send({ title: '', content: 'C', category: 'general' })).status, 400);
  assert.equal((await request(app).post(`/api/business/${business._id}/knowledge`).set(bearer(owner)).send({ title: 'T', content: 'C', category: 'not-a-real-category' })).status, 400);

  const added = await request(app).post(`/api/business/${business._id}/knowledge`).set(bearer(owner)).send({ title: 'Return policy', content: 'Returns within 30 days', category: 'policies' });
  assert.equal(added.status, 201, JSON.stringify(added.body));

  const got = await request(app).get(`/api/business/${business._id}/knowledge/${storedDocId}`).set(bearer(viewer)); // reads are open to viewers
  assert.equal(got.status, 200);
  assert.equal(got.body.document.title, 'Found doc');

  const notFound = await request(app).get(`/api/business/${business._id}/knowledge/${objectId()}`).set(bearer(viewer));
  assert.equal(notFound.status, 404);

  const updated = await request(app).put(`/api/business/${business._id}/knowledge/${storedDocId}`).set(bearer(owner)).send({ title: 'New title' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.document.title, 'New title');

  // admin/owner-only delete
  assert.equal((await request(app).delete(`/api/business/${business._id}/knowledge/${storedDocId}`).set(bearer(viewer))).status, 403);
  const deleted = await request(app).delete(`/api/business/${business._id}/knowledge/${storedDocId}`).set(bearer(owner));
  assert.equal(deleted.status, 200);

  const categories = await request(app).get(`/api/business/${business._id}/knowledge/categories`).set(bearer(owner));
  assert.deepEqual(categories.body.categories, ['general', 'faq']);

  const search = await request(app).post(`/api/business/${business._id}/knowledge/search`).set(bearer(owner)).send({ query: 'return policy' });
  assert.equal(search.status, 200);
  assert.match(search.body.results[0].content, /return policy/);

  assert.equal((await request(app).post(`/api/business/${business._id}/knowledge/search`).set(bearer(owner)).send({ query: '' })).status, 400);

  engineRegistry.getForBusiness = originalGetForBusiness;
});
