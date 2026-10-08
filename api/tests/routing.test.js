import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { classifyMessage } = await import('../src/utils/routingRules.js');
const { default: routingService } = await import('../src/services/routingService.js');
const { default: handoffService } = await import('../src/core/handoff/HandoffService.js');
const { Business, User } = await import('../src/models/index.js');

const routing = {
  rules: [
    { department: 'billing', keywords: ['refund', 'invoice', 'charged'] },
    { department: 'sales', keywords: ['pricing', 'quote'] },
  ],
  humanRequestDepartment: 'support',
};

test('matches a keyword to its department', () => {
  assert.equal(classifyMessage(routing, 'I want a refund please').department, 'billing');
  assert.equal(classifyMessage(routing, 'What is your pricing?').department, 'sales');
});

test('first matching rule wins', () => {
  assert.equal(classifyMessage(routing, 'refund and pricing').department, 'billing');
});

test('longer keywords also match their common endings', () => {
  assert.equal(classifyMessage(routing, 'refunded yesterday').department, 'billing');
  assert.equal(classifyMessage(routing, 'two invoices are wrong').department, 'billing');
});

test('short keywords and unrelated words do not over-match', () => {
  assert.equal(classifyMessage({ rules: [{ department: 'billing', keywords: ['pay'] }] }, 'my paypal broke'), null);
  assert.equal(classifyMessage(routing, 'the refundamentals of design'), null);
});

test('asking for a human goes to the human-request department', () => {
  assert.equal(classifyMessage(routing, 'Can I speak to a human?').department, 'support');
  assert.equal(classifyMessage(routing, 'is there a live agent').department, 'support');
});

test('ordinary messages are not routed', () => {
  assert.equal(classifyMessage(routing, 'hello there'), null);
  assert.equal(classifyMessage({ rules: [] }, ''), null);
});

test('notifies the customer and flags the conversation when no department member is online', async () => {
  const originalFindById = Business.findById;
  const originalUserFind = User.find;
  const originalQueue = handoffService.queueConversationForDepartment;
  const conversation = {
    _id: '507f1f77bcf86cd799439012',
    status: 'active',
    handoffMode: 'ai',
    transferNote: '',
    async save() { this.saved = true; },
  };
  let queuedDepartment;

  Business.findById = () => ({
    select: async () => ({
      routing: {
        enabled: true,
        customerUnavailableNotice: 'Our support team is offline. Please leave a message.',
        rules: [{ department: 'support', keywords: ['human'] }],
        humanRequestDepartment: 'support',
      },
    }),
  });
  User.find = async () => [];
  handoffService.queueConversationForDepartment = async (input) => {
    queuedDepartment = input.department;
    conversation.status = 'escalated';
    conversation.handoffMode = 'human';
    conversation.assignedDepartment = input.department;
    conversation.transferNote = input.note;
    await conversation.save();
    return { queued: true, conversation };
  };

  try {
    const result = await routingService.routeIfNeeded({
      businessId: '507f1f77bcf86cd799439011',
      conversation,
      text: 'I want to speak to a human',
    });

    assert.equal(result.routed, true);
    assert.equal(result.unavailable, true);
    assert.equal(result.notice, 'Our support team is offline. Please leave a message.');
    assert.equal(conversation.status, 'escalated');
    assert.equal(conversation.handoffMode, 'human');
    assert.equal(conversation.assignedDepartment, 'support');
    assert.equal(queuedDepartment, 'support');
    assert.equal(conversation.saved, true);
  } finally {
    Business.findById = originalFindById;
    User.find = originalUserFind;
    handoffService.queueConversationForDepartment = originalQueue;
  }
});
