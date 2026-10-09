import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setupEnv } from './helpers.js';

setupEnv();

const { BaileysSession } = await import('../src/core/whatsapp/BaileysSession.js');
const { default: WhatsAppSession } = await import('../src/models/WhatsAppSession.js');
const businessId = '507f1f77bcf86cd799439011';

test('Baileys session emits text from disappearing-message wrappers', async () => {
  const events = new EventEmitter();
  const session = new BaileysSession('business', businessId, events);
  const received = [];
  events.on('message', (message) => received.push(message));

  await session.handleMessagesUpsert({
    type: 'notify',
    messages: [{
      key: {
        remoteJid: '2348000000000@s.whatsapp.net',
        fromMe: false,
      },
      message: {
        ephemeralMessage: {
          message: { conversation: 'Please help me with my order' },
        },
      },
      pushName: 'Customer',
    }],
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].text, 'Please help me with my order');
  assert.equal(received[0].ownerType, 'business');
  assert.equal(received[0].ownerId, businessId);
  assert.equal(received[0].from, '2348000000000');
});

test('Baileys session records inbound activity for status checks', async () => {
  const events = new EventEmitter();
  const session = new BaileysSession('business', businessId, events);
  const originalUpdateOne = WhatsAppSession.updateOne;
  const updates = [];
  WhatsAppSession.updateOne = async (...args) => updates.push(args);

  try {
    await session.handleMessagesUpsert({
      type: 'notify',
      messages: [{
        key: { remoteJid: '2348000000000@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Can I get help?' },
      }],
    });

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0][0], { ownerType: 'business', ownerId: businessId });
    assert.equal(updates[0][1].$set.lastInboundType, 'text');
    assert.ok(updates[0][1].$set.lastInboundAt instanceof Date);
  } finally {
    WhatsAppSession.updateOne = originalUpdateOne;
  }
});

test('Baileys agent activity tracks only its Message Yourself thread', async () => {
  const session = new BaileysSession('agent', businessId, new EventEmitter());
  session.sock = { user: { id: '2348000000000@s.whatsapp.net' } };
  const originalUpdateOne = WhatsAppSession.updateOne;
  const updates = [];
  WhatsAppSession.updateOne = async (...args) => updates.push(args);

  try {
    await session.handleMessagesUpsert({
      type: 'notify',
      messages: [
        {
          key: { remoteJid: '2348111111111@s.whatsapp.net', fromMe: false },
          message: { conversation: 'Private customer chat' },
        },
        {
          key: { remoteJid: '2348000000000@s.whatsapp.net', fromMe: true },
          message: { conversation: 'Reply to handoff' },
        },
      ],
    });

    assert.equal(updates.length, 1);
    assert.equal(updates[0][0].ownerType, 'agent');
    assert.equal(updates[0][1].$set.lastInboundType, 'text');
  } finally {
    WhatsAppSession.updateOne = originalUpdateOne;
  }
});

test('Baileys session does not open a second socket when already connected', async () => {
  const session = new BaileysSession('business', businessId, new EventEmitter());
  session.sock = { user: { id: '2348000000000@s.whatsapp.net' } };

  await session.connect();

  assert.equal(session.auth, null);
  assert.equal(session.connecting, false);
});

test('Baileys session does not reconnect after an intentional unlink', async () => {
  const session = new BaileysSession('business', businessId, new EventEmitter());
  session.intentionalDisconnect = true;

  await session.connect();

  assert.equal(session.auth, null);
  assert.equal(session.connecting, false);
});

test('Baileys session emits text from extended disappearing-message wrappers and classifies non-text messages', async () => {
  const events = new EventEmitter();
  const session = new BaileysSession('business', businessId, events);
  const received = [];
  events.on('message', (message) => received.push(message));

  await session.handleMessagesUpsert({
    type: 'notify',
    messages: [
      {
        key: { remoteJid: '2348000000001@s.whatsapp.net', fromMe: false },
        message: {
          ephemeralMessage: {
            message: {
              extendedTextMessage: { text: 'I need support' },
            },
          },
        },
      },
      {
        key: { remoteJid: '2348000000002@s.whatsapp.net', fromMe: false },
        message: { imageMessage: { mimetype: 'image/jpeg' } },
      },
      {
        key: { remoteJid: '2348000000003@s.whatsapp.net', fromMe: false },
        message: { audioMessage: { mimetype: 'audio/ogg', ptt: true } },
      },
      {
        key: { remoteJid: '2348000000004@s.whatsapp.net', fromMe: false },
        message: { locationMessage: { degreesLatitude: 1.2, degreesLongitude: 3.4 } },
      },
      {
        key: { remoteJid: '2348000000005@s.whatsapp.net', fromMe: false },
        message: { stickerMessage: { mimetype: 'image/webp' } },
      },
      {
        key: { remoteJid: '2348000000006@s.whatsapp.net', fromMe: false },
        message: { reactionMessage: { text: '👍' } },
      },
      {
        key: {
          remoteJid: '2348000000007@lid',
          remoteJidAlt: '2348000000007@s.whatsapp.net',
          fromMe: false,
        },
        message: { pollCreationMessage: { name: 'Which option?' } },
      },
      {
        key: { remoteJid: '12345@g.us', fromMe: false },
        message: { conversation: 'Group messages are ignored' },
      },
    ],
  });

  assert.equal(received.length, 7);
  assert.equal(received[0].text, 'I need support');
  assert.deepEqual(received.slice(1).map(({ type, text }) => ({ type, text })), [
    { type: 'image', text: '[Image]' },
    { type: 'ptt', text: '[Voice message]' },
    { type: 'location', text: '[Location: Shared location (1.2, 3.4)]' },
    { type: 'sticker', text: '[Sticker]' },
    { type: 'reaction', text: '[Reaction: 👍]' },
    { type: 'other', text: '[pollCreation]' },
  ]);
  assert.equal(received[6].from, '2348000000007');
});
