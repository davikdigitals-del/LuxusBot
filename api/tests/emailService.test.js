import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { EmailService } = await import('../src/services/emailService.js');

const gmailApiEmailConfig = {
  provider: 'gmail-api',
  user: 'sender@gmail.com',
  from: 'Luxus Bot <sender@gmail.com>',
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  googleRefreshToken: 'refresh-token',
};

test('Gmail API sends mail via OAuth HTTPS and preserves plain-text and HTML bodies', async () => {
  const calls = [];
  const service = new EmailService({
    email: gmailApiEmailConfig,
    appUrl: 'https://app.example.com',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://oauth2.googleapis.com/token') {
        return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 3600 }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'gmail-message-id' }) };
    },
  });

  const result = await service.sendTeamInvitation('invitee@example.com', {
    businessName: 'Acme',
    inviterName: 'Taylor',
    role: 'agent',
    department: 'Support',
    inviteToken: 'invite-token',
  });
  await service.sendPasswordResetEmail('person@example.com', 'reset-token');

  assert.equal(result.id, 'gmail-message-id');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(calls[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(calls[2].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');

  const raw = JSON.parse(calls[1].options.body).raw;
  const mime = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(mime, /To: invitee@example\.com/);
  assert.match(mime, /Subject: Luxus Bot \| Invitation to join Acme/);
  assert.match(mime, /text\/html; charset=UTF-8/);
  const [plainPart, htmlPart] = mime.split('Content-Transfer-Encoding: base64\r\n\r\n').slice(1);
  const plainText = Buffer.from(plainPart.split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
  const htmlText = Buffer.from(htmlPart.split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
  assert.match(plainText, /Accept the invitation:/);
  assert.match(htmlText, /accept-invitation\?token=invite-token/);

  const resetMime = Buffer.from(JSON.parse(calls[2].options.body).raw, 'base64url').toString('utf8');
  assert.match(resetMime, /Subject: Luxus Bot \| Password reset request/);
  const resetParts = resetMime.split('Content-Transfer-Encoding: base64\r\n\r\n').slice(1);
  const resetText = Buffer.from(resetParts[0].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
  assert.match(resetText, /reset-password\?token=reset-token/);
});

test('Gmail API access token is reused until it is near expiry', async () => {
  let tokenRequests = 0;
  const service = new EmailService({
    email: gmailApiEmailConfig,
    fetchImpl: async (url) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        tokenRequests += 1;
        return { ok: true, status: 200, json: async () => ({ access_token: 'access-token', expires_in: 3600 }) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'sent' }) };
    },
  });

  await service.sendEmail('first@example.com', 'First', '<p>First</p>', 'First');
  await service.sendEmail('second@example.com', 'Second', '<p>Second</p>', 'Second');

  assert.equal(tokenRequests, 1);
});

test('unconfigured email sending throws instead of reporting a false success', async () => {
  const service = new EmailService({
    email: { provider: 'gmail-api', user: 'sender@gmail.com' },
    fetchImpl: async () => {
      throw new Error('Fetch must not run without OAuth configuration');
    },
  });

  await assert.rejects(
    service.sendPasswordResetEmail('person@example.com', 'reset-token'),
    /Email service is not configured/
  );
});

test('Gmail API errors are surfaced to callers', async () => {
  const service = new EmailService({
    email: gmailApiEmailConfig,
    fetchImpl: async (url) => url === 'https://oauth2.googleapis.com/token'
      ? { ok: true, status: 200, json: async () => ({ access_token: 'access-token' }) }
      : { ok: false, status: 403, json: async () => ({ error: { message: 'Gmail API is disabled' } }) },
  });

  await assert.rejects(
    service.sendPasswordResetEmail('person@example.com', 'reset-token'),
    /Gmail API send failed: Gmail API is disabled/
  );
});
