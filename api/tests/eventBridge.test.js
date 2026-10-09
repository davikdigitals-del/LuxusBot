import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { wireEventBridge } = await import('../src/core/whatsapp/eventBridge.js');
const { default: sessionRegistry } = await import('../src/core/whatsapp/SessionRegistry.js');
const { default: handoffService } = await import('../src/core/handoff/HandoffService.js');

const messageListener = () => sessionRegistry.events.listeners('message').at(-1);

test('event bridge forwards customer message type and media to the business handler', async () => {
  const received = [];
  wireEventBridge({ processMessage: async (message) => received.push(message) });

  await messageListener()({
    ownerType: 'business',
    ownerId: 'business-id',
    from: '2348000000000',
    text: '[Image]',
    type: 'image',
    media: { caption: '' },
    remoteJid: '2348000000000@s.whatsapp.net',
    fromMe: false,
    pushName: 'Customer',
    messageKey: { id: 'message-id' },
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].businessId, 'business-id');
  assert.equal(received[0].type, 'image');
  assert.deepEqual(received[0].media, { caption: '' });
});

test('event bridge ignores business self messages and group chats', async () => {
  let calls = 0;
  wireEventBridge({ processMessage: async () => { calls += 1; } });
  const handleMessage = messageListener();

  await handleMessage({
    ownerType: 'business',
    ownerId: 'business-id',
    remoteJid: '2348000000000@s.whatsapp.net',
    fromMe: true,
  });
  await handleMessage({
    ownerType: 'business',
    ownerId: 'business-id',
    remoteJid: '12345@g.us',
    fromMe: false,
  });

  assert.equal(calls, 0);
});

test('event bridge forwards agent self-chat replies to handoff handling', async () => {
  const originalHandle = handoffService.handleAgentSelfMessage;
  const originalConsume = sessionRegistry.consumeOwnSelfMessage;
  const received = [];
  handoffService.handleAgentSelfMessage = async (message) => received.push(message);
  sessionRegistry.consumeOwnSelfMessage = () => false;
  wireEventBridge({ processMessage: async () => {} });

  try {
    await messageListener()({
      ownerType: 'agent',
      ownerId: 'agent-id',
      fromMe: true,
      isSelfChat: true,
      text: 'I will help',
    });

    assert.deepEqual(received, [{ agentUserId: 'agent-id', text: 'I will help' }]);
  } finally {
    handoffService.handleAgentSelfMessage = originalHandle;
    sessionRegistry.consumeOwnSelfMessage = originalConsume;
  }
});
