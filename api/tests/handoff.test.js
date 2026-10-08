import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupEnv } from './helpers.js';

setupEnv();

const { Conversation, User, Business, Contact, WhatsAppSession } = await import('../src/models/index.js');
const { useMongoAuthState } = await import('../src/core/whatsapp/mongoAuthState.js');
const { EventEmitter } = await import('events');
const { SessionRegistry } = await import('../src/core/whatsapp/SessionRegistry.js');
const { HandoffService } = await import('../src/core/handoff/HandoffService.js');

const objectId = () => new mongoose.Types.ObjectId();

// ------------------------------------------------------------------ mongoAuthState

const sessionDb = new Map(); // key -> WhatsAppSession-like doc

before(() => {
  WhatsAppSession.prototype.save = async function () { sessionDb.set(`${this.ownerType}:${this.ownerId}`, this); return this; };
  WhatsAppSession.findOne = async ({ ownerType, ownerId }) => sessionDb.get(`${ownerType}:${ownerId}`) || null;
  WhatsAppSession.updateOne = async ({ ownerType, ownerId }, { $set }) => {
    const doc = sessionDb.get(`${ownerType}:${ownerId}`);
    if (doc) Object.assign(doc, $set);
    return { acknowledged: true };
  };
  WhatsAppSession.deleteOne = async ({ ownerType, ownerId }) => { sessionDb.delete(`${ownerType}:${ownerId}`); return { acknowledged: true }; };
  WhatsAppSession.find = async ({ status }) => [...sessionDb.values()].filter((d) => status.$in.includes(d.status));
});

beforeEach(() => sessionDb.clear());

test('mongoAuthState persists and round-trips Baileys creds (Buffers survive) via BufferJSON', async () => {
  const ownerId = String(objectId());
  const first = await useMongoAuthState('agent', ownerId);

  assert.ok(Buffer.isBuffer(first.state.creds.noiseKey.private));

  first.state.creds.registered = true;
  await first.saveCreds();
  await first.flush();

  // A fresh call (simulating a process restart) must load the SAME creds back
  const second = await useMongoAuthState('agent', ownerId);
  assert.equal(second.state.creds.registered, true);
  assert.ok(Buffer.isBuffer(second.state.creds.noiseKey.private));
  assert.equal(Buffer.compare(second.state.creds.noiseKey.private, first.state.creds.noiseKey.private), 0);
});

test('mongoAuthState keys.set/get round-trips a signal key entry and clearState wipes it', async () => {
  const ownerId = String(objectId());
  const auth = await useMongoAuthState('business', ownerId);

  const fakeKey = { pub: Buffer.from([1, 2, 3]), priv: Buffer.from([4, 5, 6]) };
  await auth.state.keys.set({ 'pre-key': { '42': fakeKey } });

  const got = await auth.state.keys.get('pre-key', ['42']);
  assert.deepEqual(got['42'].pub, fakeKey.pub);

  await auth.clearState();
  const auth2 = await useMongoAuthState('business', ownerId);
  const gotAfterClear = await auth2.state.keys.get('pre-key', ['42']);
  assert.equal(gotAfterClear['42'], null);
});

test('mongoAuthState serializes a pending credentials save with logout cleanup', async () => {
  const ownerId = String(objectId());
  const originalSave = WhatsAppSession.prototype.save;
  let savesInFlight = 0;
  let maxConcurrentSaves = 0;

  WhatsAppSession.prototype.save = async function () {
    savesInFlight += 1;
    maxConcurrentSaves = Math.max(maxConcurrentSaves, savesInFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 40));
      sessionDb.set(`${this.ownerType}:${this.ownerId}`, this);
      return this;
    } finally {
      savesInFlight -= 1;
    }
  };

  try {
    const auth = await useMongoAuthState('agent', ownerId);
    auth.state.creds.registered = true;
    const credsSave = auth.saveCreds();

    await new Promise((resolve) => setTimeout(resolve, 275));
    await Promise.all([credsSave, auth.clearState()]);

    assert.equal(maxConcurrentSaves, 1);
    assert.equal(auth.sessionDoc.data.size, 0);
  } finally {
    WhatsAppSession.prototype.save = originalSave;
  }
});

// ------------------------------------------------------------------ SessionRegistry namespacing

test('SessionRegistry keys business and agent sessions separately, even for the same id value', async () => {
  const registry = new SessionRegistry();
  assert.equal(registry.key('business', '507f1f77bcf86cd799439011'), 'business:507f1f77bcf86cd799439011');
  assert.equal(registry.key('agent', '507f1f77bcf86cd799439011'), 'agent:507f1f77bcf86cd799439011');
  assert.notEqual(registry.key('business', 'x'), registry.key('agent', 'x'));
});

test('SessionRegistry.getStatus reads from Mongo even for a session not loaded in this process', async () => {
  const registry = new SessionRegistry();
  const ownerId = String(objectId());
  await WhatsAppSession.updateOne({ ownerType: 'business', ownerId }, { $set: {} }); // no-op if missing, seed below instead
  sessionDb.set(`business:${ownerId}`, { ownerType: 'business', ownerId, status: 'connected', phoneNumber: '15551234', lastQR: null });

  const status = await registry.getStatus('business', ownerId);
  assert.equal(status.status, 'connected');
  assert.equal(status.phoneNumber, '15551234');
});

test('sendMessage/sendSelfMessage throw a clear error when no session is loaded (never silently no-op)', async () => {
  const registry = new SessionRegistry();
  await assert.rejects(() => registry.sendMessage('business', 'nope', 'x@s.whatsapp.net', 'hi'), /No active WhatsApp session/);
  await assert.rejects(() => registry.sendSelfMessage('agent', 'nope', 'hi'), /No connected WhatsApp session/);
});

// ------------------------------------------------------------------ HandoffService

const db = { conversations: new Map(), users: new Map(), contacts: new Map(), businesses: new Map() };
let sentSelfMessages;
let sentBusinessMessages;
let fakeRegistry;

before(() => {
  Conversation.prototype.save = async function () { db.conversations.set(String(this._id), this); return this; };
  Conversation.prototype.addMessage = function (role, content, messageType, metadata) {
    this.messages = this.messages || [];
    this.messages.push({ role, content, messageType, metadata });
  };
  Conversation.findOne = async (q) => {
    if (q._id) return db.conversations.get(String(q._id)) || null;
    return [...db.conversations.values()].find((c) => c.sessionId === q.sessionId) || null;
  };
  Conversation.find = async (q) => [...db.conversations.values()].filter(
    (c) => (!Object.hasOwn(q, 'assignedAgent') || (q.assignedAgent === null ? c.assignedAgent == null : String(c.assignedAgent) === String(q.assignedAgent))) &&
           (!q.handoffMode || c.handoffMode === q.handoffMode) &&
           (!q.assignedDepartment || c.assignedDepartment === q.assignedDepartment) &&
           (!q.businessId || String(c.businessId) === String(q.businessId)) &&
           (!q.status || q.status.$ne !== c.status)
  );
  Conversation.findOneAndUpdate = async (query, update) => {
    const conversation = db.conversations.get(String(query._id));
    if (!conversation || conversation.handoffMode !== query.handoffMode ||
        String(conversation.businessId) !== String(query.businessId) ||
        conversation.assignedAgent != null ||
        conversation.assignedDepartment !== query.assignedDepartment ||
        conversation.status === 'resolved') return null;
    Object.assign(conversation, update.$set);
    return conversation;
  };
  Conversation.countDocuments = async ({ assignedAgent }) => [...db.conversations.values()].filter(
    (conversation) => String(conversation.assignedAgent) === String(assignedAgent) &&
      conversation.handoffMode === 'human' && conversation.status !== 'resolved'
  ).length;
  User.findById = async (id) => db.users.get(String(id)) || null;
  User.find = async (query = {}) => [...db.users.values()].filter((user) => {
    if (query.memberships?.$elemMatch) {
      const match = query.memberships.$elemMatch;
      return user.memberships?.some((membership) =>
        String(membership.businessId) === String(match.businessId) &&
        membership.status === match.status &&
        membership.departments?.includes(match.departments)
      );
    }
    const businessId = query['memberships.businessId'];
    return user.memberships?.some((membership) => String(membership.businessId) === String(businessId));
  });
  Contact.findById = async (id) => db.contacts.get(String(id)) || null;
  Business.findById = async (id) => db.businesses.get(String(id)) || null;
});

beforeEach(() => {
  db.conversations.clear(); db.users.clear(); db.contacts.clear(); db.businesses.clear();
  sentSelfMessages = [];
  sentBusinessMessages = [];
  fakeRegistry = {
    isConnected: () => true,
    sendSelfMessage: async (ownerType, ownerId, text) => { sentSelfMessages.push({ ownerType, ownerId: String(ownerId), text }); },
    sendMessage: async (ownerType, ownerId, jid, text) => { sentBusinessMessages.push({ ownerType, ownerId: String(ownerId), jid, text }); },
  };
});

const makeConversation = (overrides = {}) => {
  const c = {
    _id: objectId(),
    businessId: objectId(),
    userId: objectId(),
    sessionId: 'sess-1',
    handoffMode: 'ai',
    status: 'active',
    messages: [],
    context: {},
    ...overrides,
  };
  // Plain object literal, not a real Mongoose document - attach the same
  // instance methods Conversation.prototype has so handoff code that calls
  // conversation.save()/addMessage() works the same as it would for real.
  c.save = async function () { db.conversations.set(String(this._id), this); return this; };
  c.addMessage = function (role, content, messageType, metadata) {
    this.messages = this.messages || [];
    this.messages.push({ role, content, messageType, metadata });
  };
  db.conversations.set(String(c._id), c);
  return c;
};

test('transferConversation rejects a non-member and never mutates the conversation on failure', async () => {
  const handoff = new HandoffService();
  handoff.notifyAgentOfTransfer = async () => {}; // isolate from SessionRegistry in this test
  const businessId = objectId();
  const conversation = makeConversation({ businessId });
  const stranger = objectId();
  db.users.set(String(stranger), { _id: stranger, memberships: [] });

  await assert.rejects(
    () => handoff.transferConversation({ businessId, conversationId: conversation._id, agentId: stranger, transferredBy: objectId() }),
    /not an active member/
  );
  assert.equal(conversation.handoffMode, 'ai');
});

test('transferConversation sets handoffMode/assignedAgent and notifies the agent when connected', async () => {
  const handoff = new HandoffService();
  const businessId = objectId();
  const agentId = objectId();
  const conversation = makeConversation({ businessId });
  db.users.set(String(agentId), { _id: agentId, memberships: [{ businessId, status: 'active', role: 'agent' }] });
  db.businesses.set(String(businessId), { _id: businessId, name: 'Acme' });
  db.contacts.set(String(conversation.userId), { _id: conversation.userId, name: 'Jane', phoneNumber: '15551234' });

  // Inject the fake registry the way EngineRegistry-style DI would
  const originalIsConnected = (await import('../src/core/whatsapp/SessionRegistry.js')).default.isConnected;
  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  const updated = await handoff.transferConversation({ businessId, conversationId: conversation._id, agentId, transferredBy: objectId(), note: 'VIP customer' });

  assert.equal(updated.handoffMode, 'human');
  assert.equal(String(updated.assignedAgent), String(agentId));
  assert.equal(updated.status, 'escalated');
  assert.equal(sentSelfMessages.length, 1);
  assert.match(sentSelfMessages[0].text, /VIP customer/);
  assert.match(sentSelfMessages[0].text, /Jane/);

  registryModule.isConnected = originalIsConnected;
});

test('relayCustomerMessageIfHandedOff relays to a connected agent and returns true', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const conversation = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  db.users.set(String(agentId), { _id: agentId });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  const relayed = await handoff.relayCustomerMessageIfHandedOff({ businessId: conversation.businessId, conversation, fromName: 'Jane', text: 'still there?' });
  assert.equal(relayed, true);
  assert.equal(sentSelfMessages.length, 1);
  assert.match(sentSelfMessages[0].text, /still there\?/);
});

test('relayCustomerMessageIfHandedOff falls back to AI (returns false) when the agent is offline', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const conversation = makeConversation({ handoffMode: 'human', assignedAgent: agentId, status: 'escalated' });
  db.users.set(String(agentId), { _id: agentId });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, { ...fakeRegistry, isConnected: () => false });

  const relayed = await handoff.relayCustomerMessageIfHandedOff({ businessId: conversation.businessId, conversation, fromName: 'Jane', text: 'hello?' });
  assert.equal(relayed, false);
  assert.equal(conversation.handoffMode, 'ai'); // returned to AI automatically
  assert.equal(sentSelfMessages.length, 0);
});

test('relayCustomerMessageIfHandedOff is a no-op for AI-mode or missing conversations', async () => {
  const handoff = new HandoffService();
  assert.equal(await handoff.relayCustomerMessageIfHandedOff({ conversation: null, fromName: 'x', text: 'x' }), false);
  const aiConvo = makeConversation({ handoffMode: 'ai' });
  assert.equal(await handoff.relayCustomerMessageIfHandedOff({ conversation: aiConvo, fromName: 'x', text: 'x' }), false);
});

test('handleAgentSelfMessage relays a single active handoff straight through, tagged with sentBy=agent', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const conversation = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  db.contacts.set(String(conversation.userId), { _id: conversation.userId, name: 'Jane', phoneNumber: '+1 (555) 123-4567' });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: 'On my way to help you now' });

  assert.equal(sentBusinessMessages.length, 1);
  assert.equal(sentBusinessMessages[0].jid, '15551234567@s.whatsapp.net');
  assert.equal(sentBusinessMessages[0].text, 'On my way to help you now');
  assert.equal(conversation.messages.length, 1);
  assert.equal(conversation.messages[0].metadata.sentBy, 'agent');
});

test('handleAgentSelfMessage requires a #tag with more than one active handoff, and ignores untagged notes', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const c1 = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  const c2 = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  db.contacts.set(String(c1.userId), { _id: c1.userId, name: 'A', phoneNumber: '15550001111' });
  db.contacts.set(String(c2.userId), { _id: c2.userId, name: 'B', phoneNumber: '15552223333' });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: 'no idea who this goes to' });
  assert.equal(sentBusinessMessages.length, 0); // ambiguous - nothing sent
  assert.equal(sentSelfMessages.length, 1); // ...but the agent gets a disambiguation prompt
  assert.match(sentSelfMessages[0].text, /2 active handoffs/);

  const tag = String(c2._id).slice(-6);
  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: `#${tag} this one's for you` });
  assert.equal(sentBusinessMessages.length, 1);
  assert.equal(sentBusinessMessages[0].text, "this one's for you");
  assert.equal(c1.messages.length, 0);
  assert.equal(c2.messages.length, 1);
});

test('handleAgentSelfMessage transfers a handoff to a named active teammate', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const teammateId = objectId();
  const conversation = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  db.users.set(String(agentId), { _id: agentId, memberships: [{ businessId: conversation.businessId, status: 'active', role: 'agent' }] });
  db.users.set(String(teammateId), {
    _id: teammateId,
    firstName: 'Alex',
    lastName: 'Morgan',
    memberships: [{ businessId: conversation.businessId, status: 'active', role: 'agent' }],
  });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: '/transfer Alex Morgan' });

  assert.equal(String(conversation.assignedAgent), String(teammateId));
  assert.equal(conversation.handoffMode, 'human');
  assert.equal(sentBusinessMessages.length, 0);
  assert.ok(sentSelfMessages.some((message) => /transferred to Alex Morgan/.test(message.text)));
});

test('handleAgentSelfMessage can queue a conversation for a department', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const businessId = objectId();
  const conversation = makeConversation({
    businessId,
    phoneNumber: '15551234',
    handoffMode: 'human',
    assignedAgent: agentId,
  });
  db.users.set(String(agentId), {
    _id: agentId,
    memberships: [{ businessId, status: 'active', role: 'agent', departments: [] }],
  });
  db.businesses.set(String(businessId), { _id: businessId, departments: ['support'] });
  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, {
    ...fakeRegistry,
    isConnected: () => false,
  });

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: '/transfer department Support' });

  assert.equal(conversation.assignedAgent, null);
  assert.equal(conversation.assignedDepartment, 'support');
  assert.ok(sentBusinessMessages.some((message) => /team is unavailable/.test(message.text)));
  assert.ok(sentSelfMessages.some((message) => /queued for the support department/.test(message.text)));
});

test('handleAgentSelfMessage requires a conversation tag for transfers with multiple active handoffs', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const teammateId = objectId();
  const first = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  const second = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  db.users.set(String(agentId), { _id: agentId, memberships: [{ businessId: first.businessId, status: 'active', role: 'agent' }] });
  db.users.set(String(teammateId), {
    _id: teammateId,
    firstName: 'Alex',
    lastName: 'Morgan',
    memberships: [{ businessId: first.businessId, status: 'active', role: 'agent' }],
  });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: '/transfer Alex Morgan' });

  assert.equal(String(first.assignedAgent), String(agentId));
  assert.equal(String(second.assignedAgent), String(agentId));
  assert.match(sentSelfMessages[0].text, /Choose a conversation/);
});

test('queueConversationForDepartment keeps a handoff queued when no department teammate is online', async () => {
  const handoff = new HandoffService();
  const businessId = objectId();
  const conversation = makeConversation({ businessId });
  db.businesses.set(String(businessId), { _id: businessId, departments: ['support'] });
  Object.assign((await import('../src/core/whatsapp/SessionRegistry.js')).default, {
    ...fakeRegistry,
    isConnected: () => false,
  });

  const result = await handoff.queueConversationForDepartment({
    businessId,
    conversationId: conversation._id,
    department: 'support',
    transferredBy: objectId(),
  });

  assert.equal(result.queued, true);
  assert.equal(conversation.handoffMode, 'human');
  assert.equal(conversation.assignedAgent, null);
  assert.equal(conversation.assignedDepartment, 'support');
  assert.equal(await handoff.relayCustomerMessageIfHandedOff({
    businessId,
    conversation,
    fromName: 'Jane',
    text: 'Can you help?',
  }), true);
});

test('dispatchQueuedConversations assigns queued department chats when a teammate connects', async () => {
  const handoff = new HandoffService();
  const businessId = objectId();
  const agentId = objectId();
  const conversation = makeConversation({
    businessId,
    phoneNumber: '15551234',
    handoffMode: 'human',
    assignedAgent: null,
    assignedDepartment: 'support',
    status: 'escalated',
  });
  db.businesses.set(String(businessId), { _id: businessId, name: 'Acme', departments: ['support'] });
  db.contacts.set(String(conversation.userId), { _id: conversation.userId, name: 'Jane', phoneNumber: '15551234' });
  db.users.set(String(agentId), {
    _id: agentId,
    firstName: 'Alex',
    lastName: 'Morgan',
    memberships: [{ businessId, status: 'active', role: 'agent', departments: ['support'] }],
  });
  Object.assign((await import('../src/core/whatsapp/SessionRegistry.js')).default, fakeRegistry);

  await handoff.dispatchQueuedConversations(agentId);

  assert.equal(String(conversation.assignedAgent), String(agentId));
  assert.equal(conversation.assignedDepartment, 'support');
  assert.ok(sentSelfMessages.some((message) => /Conversation transferred to you/.test(message.text)));
  assert.ok(sentBusinessMessages.some((message) => /team is now available/.test(message.text)));
});

test('handleAgentSelfMessage /end hands every active conversation for that agent back to AI', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const c1 = makeConversation({ handoffMode: 'human', assignedAgent: agentId });
  const c2 = makeConversation({ handoffMode: 'human', assignedAgent: agentId });

  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: '/end' });

  assert.equal(c1.handoffMode, 'ai');
  assert.equal(c2.handoffMode, 'ai');
  assert.equal(c1.assignedAgent, null);
});

test('handleAgentSelfMessage is a no-op when the agent has no active handoff (a genuine personal self-note)', async () => {
  const handoff = new HandoffService();
  const agentId = objectId();
  const registryModule = (await import('../src/core/whatsapp/SessionRegistry.js')).default;
  Object.assign(registryModule, fakeRegistry);

  await handoff.handleAgentSelfMessage({ agentUserId: agentId, text: 'buy milk' });
  assert.equal(sentBusinessMessages.length, 0);
  assert.equal(sentSelfMessages.length, 0);
});
