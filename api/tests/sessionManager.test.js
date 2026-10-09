import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { Conversation } = await import('../src/models/index.js');
const { default: SessionManager } = await import('../src/core/memory/sessionManager.js');

test('SessionManager.addMessage saves the message and returns the conversation', async () => {
  const originalFindOne = Conversation.findOne;
  const saved = [];
  const conversation = {
    messages: [],
    context: {},
    addMessage(role, content, messageType, metadata) {
      this.messages.push({ role, content, messageType, metadata });
    },
    async save() {
      saved.push(this.messages.at(-1));
    },
  };

  try {
    Conversation.findOne = async () => conversation;
    const manager = new SessionManager();

    const result = await manager.addMessage('session-id', 'user', 'Hello', 'text');

    assert.equal(result, conversation);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0], {
      role: 'user',
      content: 'Hello',
      messageType: 'text',
      metadata: {},
    });
  } finally {
    Conversation.findOne = originalFindOne;
  }
});

test('SessionManager.addMessage surfaces missing conversations instead of silently dropping messages', async () => {
  const originalFindOne = Conversation.findOne;

  try {
    Conversation.findOne = async () => null;
    const manager = new SessionManager();

    await assert.rejects(
      () => manager.addMessage('missing-session', 'user', 'Hello'),
      /No active conversation found/
    );
  } finally {
    Conversation.findOne = originalFindOne;
  }
});

test('SessionManager.addMessage surfaces database save errors', async () => {
  const originalFindOne = Conversation.findOne;

  try {
    Conversation.findOne = async () => ({
      messages: [],
      addMessage() {},
      async save() {
        throw new Error('database unavailable');
      },
    });
    const manager = new SessionManager();

    await assert.rejects(
      () => manager.addMessage('session-id', 'user', 'Hello'),
      /database unavailable/
    );
  } finally {
    Conversation.findOne = originalFindOne;
  }
});
