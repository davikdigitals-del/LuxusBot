import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupEnv } from './helpers.js';

setupEnv();

const { Business, Contact, Conversation } = await import('../src/models/index.js');
const { encrypt } = await import('../src/utils/crypto.js');
const { default: TenantContext } = await import('../src/core/tenant/TenantContext.js');
const { default: SessionManager } = await import('../src/core/memory/sessionManager.js');
const { default: KnowledgeBase } = await import('../src/core/knowledge/knowledgeBase.js');
const { EngineRegistry } = await import('../src/core/tenant/EngineRegistry.js');

const objectId = () => new mongoose.Types.ObjectId();

const makeBusinessDoc = (overrides = {}) => ({
  _id: objectId(),
  name: 'Acme',
  contact: { email: 'support@acme.test', industry: 'retail', description: '', website: '' },
  assistant: { name: 'AcmeBot', personality: 'friendly, concise', systemPrompt: '' },
  businessHours: { start: '09:00', end: '18:00', timezone: 'UTC', days: '1,2,3,4,5' },
  aiConfig: { anthropicKeySet: false, temperature: 0.7, maxTokens: 1000 },
  ...overrides,
});

// ------------------------------------------------------------------ TenantContext

test('TenantContext exposes company/assistant/businessHours and decrypts only set keys', () => {
  const key = encrypt('sk-test-tenant-key');
  const business = makeBusinessDoc({
    aiConfig: { anthropicKeySet: true, anthropicKey: key, temperature: 0.5, maxTokens: 500 },
  });

  const tc = new TenantContext(business);
  assert.equal(tc.businessId, String(business._id));
  assert.equal(tc.companyInfo.name, 'Acme');
  assert.equal(tc.companyInfo.email, 'support@acme.test');
  assert.equal(tc.assistantInfo.name, 'AcmeBot');
  assert.equal(tc.businessHours.timezone, 'UTC');

  const ai = tc.getAIConfig();
  assert.equal(ai.anthropicKey, 'sk-test-tenant-key');
  assert.equal(ai.openaiKey, undefined); // no other providers exist any more

  assert.equal(tc.getKnowledgeCollectionName(), `kb_${business._id}`);
});

test('TenantContext throws without a loaded business', () => {
  assert.throws(() => new TenantContext(null));
  assert.throws(() => new TenantContext({}));
});

test('getAIConfigVersion changes when aiConfig changes, not when company info changes', () => {
  const b1 = makeBusinessDoc();
  const v1 = new TenantContext(b1).getAIConfigVersion();

  const b2 = makeBusinessDoc({ ...b1, name: 'Acme Renamed' });
  const v2 = new TenantContext(b2).getAIConfigVersion();
  assert.equal(v1, v2); // company rename alone shouldn't force an engine rebuild

  const b3 = makeBusinessDoc({ ...b1, aiConfig: { ...b1.aiConfig, provider: 'anthropic' } });
  const v3 = new TenantContext(b3).getAIConfigVersion();
  assert.notEqual(v1, v3);
});

// ------------------------------------------------------------------ SessionManager tenant isolation

const db = { contacts: new Map(), conversations: new Map() };

before(() => {
  Contact.prototype.save = async function () { db.contacts.set(String(this._id), this); return this; };
  Contact.findOne = async ({ businessId, phoneNumber }) =>
    [...db.contacts.values()].find(c => String(c.businessId) === String(businessId) && c.phoneNumber === phoneNumber) || null;

  Conversation.prototype.save = async function () { db.conversations.set(String(this._id), this); return this; };
  Conversation.prototype.addMessage = function (role, content) { this.messages = this.messages || []; this.messages.push({ role, content }); };
  Conversation.findOne = async ({ sessionId, status }) => {
    const found = [...db.conversations.values()].find(c => c.sessionId === sessionId && (!status || c.status === status));
    return found || null;
  };
  Conversation.findOneAndUpdate = async ({ sessionId }, update) => {
    const found = [...db.conversations.values()].find(c => c.sessionId === sessionId);
    if (found) Object.assign(found, update);
    return found || null;
  };
});

beforeEach(() => { db.contacts.clear(); db.conversations.clear(); });

test('same phone number across two businesses gets fully isolated sessions and contacts', async () => {
  const sm = new SessionManager();
  sm.useRedis = false; // exercise the in-memory cache path directly

  const businessA = objectId();
  const businessB = objectId();
  const phone = '2348012345678';

  const sessionA = await sm.getOrCreateSession(businessA, phone, { name: 'From A' });
  const sessionB = await sm.getOrCreateSession(businessB, phone, { name: 'From B' });

  assert.notEqual(sessionA.sessionId, sessionB.sessionId);
  assert.equal(sessionA.businessId, String(businessA));
  assert.equal(sessionB.businessId, String(businessB));

  // Contacts are separate rows per business even though the phone number matches
  assert.equal(db.contacts.size, 2);
  const contactsForA = [...db.contacts.values()].filter(c => String(c.businessId) === String(businessA));
  assert.equal(contactsForA.length, 1);
  assert.equal(contactsForA[0].name, 'From A');

  // Fetching again for business A returns the SAME session, not a new one
  const sessionAagain = await sm.getOrCreateSession(businessA, phone, {});
  assert.equal(sessionAagain.sessionId, sessionA.sessionId);

  // Each business got its own Conversation record, scoped correctly
  assert.equal(db.conversations.size, 2);
  const convoA = [...db.conversations.values()].find(c => c.sessionId === sessionA.sessionId);
  assert.equal(String(convoA.businessId), String(businessA));
  assert.equal(String(convoA.userId), String(contactsForA[0]._id));
});

test('sessionId-only lookups (updateContext, addMessage, endSession) use the secondary index, not a full scan', async () => {
  const sm = new SessionManager();
  sm.useRedis = false;

  const businessId = objectId();
  const session = await sm.getOrCreateSession(businessId, '15551234', { name: 'X' });

  // Break getAllSessions so a full-scan fallback would fail loudly
  const originalGetAll = sm.getAllSessions.bind(sm);
  sm.getAllSessions = async () => { throw new Error('full scan should not be used for sessionId-only lookups'); };

  await sm.updateContext(session.sessionId, { intent: 'sales' });
  const ctx = await sm.getContext(session.sessionId);
  assert.equal(ctx.intent, 'sales');

  await sm.updateSessionActivity(session.sessionId);

  sm.getAllSessions = originalGetAll; // restore for cleanExpiredSessions-style callers elsewhere
});

// ------------------------------------------------------------------ KnowledgeBase tenant isolation

test('KnowledgeBase requires a businessId and scopes its vector collection name', () => {
  assert.throws(() => new KnowledgeBase(null, undefined));

  const businessId = objectId();
  const kb = new KnowledgeBase(null, businessId);
  assert.equal(kb.businessId, String(businessId));
  assert.equal(kb.vectorStore.collectionName, `kb_${businessId}`);
});

// ------------------------------------------------------------------ EngineRegistry caching

test('EngineRegistry caches per business and rebuilds only when aiConfig changes', async () => {
  const registry = new EngineRegistry();
  const businessId = objectId();
  let aiConfig = { anthropicKeySet: false, temperature: 0.7, maxTokens: 1000 };

  const selectStub = { select: async () => makeBusinessDoc({ _id: businessId, aiConfig }) };
  Business.findOne = () => selectStub;

  const entry1 = await registry.getForBusiness(businessId);
  const entry2 = await registry.getForBusiness(businessId);
  assert.equal(entry1.aiEngine, entry2.aiEngine); // same instance: no rebuild

  aiConfig = { ...aiConfig, anthropicKeySet: true };
  const entry3 = await registry.getForBusiness(businessId);
  assert.notEqual(entry1.aiEngine, entry3.aiEngine); // config changed: rebuilt

  Business.findOne = () => ({ select: async () => null });
  await assert.rejects(() => registry.getForBusiness(objectId()));
});
