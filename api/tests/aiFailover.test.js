import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupEnv } from './helpers.js';

setupEnv();

const { Conversation, User, Business } = await import('../src/models/index.js');
const { default: sessionRegistry } = await import('../src/core/whatsapp/SessionRegistry.js');
const { default: handoffService } = await import('../src/core/handoff/HandoffService.js');
const { handOffBecauseAiDown, AI_DOWN_HANDOFF_NOTICE, AI_DOWN_NO_AGENT_NOTICE } = await import('../src/services/routingService.js');

const objectId = () => new mongoose.Types.ObjectId();
const businessId = objectId();

const makeUser = (role, status = 'active') => ({ _id: objectId(), memberships: [{ businessId, role, status }] });

let users, online, openChats, transfers, queuedDepartments, configuredDepartment;

beforeEach(() => {
  users = []; online = new Set(); openChats = new Map(); transfers = []; queuedDepartments = []; configuredDepartment = '';
  User.find = async () => users;
  Conversation.countDocuments = async ({ assignedAgent }) => openChats.get(String(assignedAgent)) || 0;
  Business.findById = () => ({
    select: async () => ({ routing: { humanRequestDepartment: configuredDepartment, customerUnavailableNotice: 'Our team is offline.' } }),
  });
  sessionRegistry.isConnected = (_type, id) => online.has(String(id));
  handoffService.transferConversation = async (args) => { transfers.push(args); return {}; };
  handoffService.queueConversationForDepartment = async (args) => {
    queuedDepartments.push(args);
    return { queued: false, conversation: args };
  };
});

const makeConversation = () => ({ _id: objectId(), status: 'active', saved: 0, async save() { this.saved++; } });

test('AI down: chat goes to the online team member with the fewest open chats', async () => {
  const busy = makeUser('agent'); const free = makeUser('agent');
  users = [busy, free]; online = new Set([String(busy._id), String(free._id)]);
  openChats.set(String(busy._id), 4);

  const res = await handOffBecauseAiDown({ businessId, conversation: makeConversation(), reason: 'AI provider error' });

  assert.equal(res.handedOff, true);
  assert.equal(res.notice, AI_DOWN_HANDOFF_NOTICE);
  assert.equal(transfers.length, 1);
  assert.equal(String(transfers[0].agentId), String(free._id));
  assert.match(transfers[0].note, /AI unavailable/);
});

test('AI down: offline members and non-handler roles are skipped', async () => {
  const offline = makeUser('agent'); const viewer = makeUser('viewer'); const owner = makeUser('owner');
  users = [offline, viewer, owner]; online = new Set([String(viewer._id), String(owner._id)]);

  const res = await handOffBecauseAiDown({ businessId, conversation: makeConversation(), reason: 'plan quota reached' });

  assert.equal(res.handedOff, true);
  assert.equal(String(transfers[0].agentId), String(owner._id));
});

test('AI down routes to the configured department instead of choosing an individual teammate', async () => {
  configuredDepartment = 'support';
  const conversation = makeConversation();
  handoffService.queueConversationForDepartment = async (args) => {
    queuedDepartments.push(args);
    return { queued: true, conversation };
  };

  const res = await handOffBecauseAiDown({ businessId, conversation, reason: 'AI provider error' });

  assert.equal(res.queued, true);
  assert.equal(res.department, 'support');
  assert.equal(res.notice, 'Our team is offline.');
  assert.equal(queuedDepartments.length, 1);
  assert.equal(queuedDepartments[0].department, 'support');
  assert.equal(transfers.length, 0);
});

test('AI down with nobody online: chat is flagged, customer is told the team was notified', async () => {
  users = [makeUser('agent')]; // offline
  const conversation = makeConversation();

  const res = await handOffBecauseAiDown({ businessId, conversation, reason: 'AI provider error' });

  assert.equal(res.handedOff, false);
  assert.equal(res.notice, AI_DOWN_NO_AGENT_NOTICE);
  assert.equal(transfers.length, 0);
  assert.equal(conversation.status, 'escalated');
  assert.equal(conversation.saved, 1);
});

test('AI down never throws, even when the transfer fails', async () => {
  const agent = makeUser('agent'); users = [agent]; online = new Set([String(agent._id)]);
  handoffService.transferConversation = async () => { throw new Error('db down'); };

  const res = await handOffBecauseAiDown({ businessId, conversation: makeConversation(), reason: 'x' });

  assert.equal(res.handedOff, false);
  assert.equal(res.notice, AI_DOWN_NO_AGENT_NOTICE);
});

test('AI down without a conversation still returns a customer notice', async () => {
  const res = await handOffBecauseAiDown({ businessId, conversation: null, reason: 'x' });
  assert.equal(res.handedOff, false);
  assert.equal(res.notice, AI_DOWN_NO_AGENT_NOTICE);
});
