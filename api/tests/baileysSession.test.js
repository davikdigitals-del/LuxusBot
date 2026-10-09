import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setupEnv } from './helpers.js';

setupEnv();

const { BaileysSession } = await import('../src/core/whatsapp/BaileysSession.js');

test('Baileys session emits text from disappearing-message wrappers', () => {
  const events = new EventEmitter();
  const session = new BaileysSession('business', 'business-id', events);
  const received = [];
  events.on('message', (message) => received.push(message));

  session.handleMessagesUpsert({
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
  assert.equal(received[0].ownerId, 'business-id');
  assert.equal(received[0].from, '2348000000000');
});

test('Baileys session emits text from extended disappearing-message wrappers and classifies non-text messages', () => {
  const events = new EventEmitter();
  const session = new BaileysSession('business', 'business-id', events);
  const received = [];
  events.on('message', (message) => received.push(message));

  session.handleMessagesUpsert({
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
