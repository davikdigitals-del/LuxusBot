import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();

const { default: User } = await import('../src/models/User.js');
const { default: authService } = await import('../src/services/authService.js');
const { default: emailService } = await import('../src/services/emailService.js');

test('password reset distinguishes unregistered addresses and sends registered accounts a link', async () => {
  const originalFindByEmail = User.findByEmail;
  const originalSendPasswordResetEmail = emailService.sendPasswordResetEmail;
  const sentEmails = [];
  const user = {
    email: 'registered@example.com',
    async save() {},
  };

  try {
    User.findByEmail = async (email) => email === user.email ? user : null;
    emailService.sendPasswordResetEmail = async (email, token) => {
      sentEmails.push({ email, token });
      return { accepted: [email] };
    };

    const missing = await authService.requestPasswordReset('missing@example.com');
    assert.equal(missing.registered, false);
    assert.equal(missing.message, 'Email is not registered');
    assert.equal(sentEmails.length, 0);

    const registered = await authService.requestPasswordReset(user.email);
    assert.equal(registered.registered, true);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].email, user.email);
    assert.equal(sentEmails[0].token, user.passwordResetToken);
    assert.ok(user.passwordResetExpires > Date.now());
  } finally {
    User.findByEmail = originalFindByEmail;
    emailService.sendPasswordResetEmail = originalSendPasswordResetEmail;
  }
});
