import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
process.env.GITHUB_CLIENT_ID = 'github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
process.env.DISCORD_CLIENT_ID = 'discord-client-id';
process.env.DISCORD_CLIENT_SECRET = 'discord-client-secret';

const { SocialAuthService } = await import('../src/services/socialAuthService.js');
const { User, Business } = await import('../src/models/index.js');

test('GitHub authorization uses the expected callback, scopes, and signed state value', () => {
  const service = new SocialAuthService();
  const url = new URL(service.getAuthorizationUrl(
    'github',
    'csrf-state',
    'https://api.example.com/api/auth/github/callback'
  ));

  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('client_id'), 'github-client-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://api.example.com/api/auth/github/callback');
  assert.equal(url.searchParams.get('scope'), 'read:user user:email');
  assert.equal(url.searchParams.get('state'), 'csrf-state');
});

test('GitHub profile requires a verified primary email from the emails endpoint', async () => {
  const service = new SocialAuthService({
    fetchImpl: async (url) => {
      if (url === 'https://github.com/login/oauth/access_token') {
        return { ok: true, json: async () => ({ access_token: 'provider-access-token' }) };
      }
      if (url === 'https://api.github.com/user') {
        return { ok: true, json: async () => ({ id: 42, name: 'Taylor Smith', avatar_url: 'https://avatars.example/taylor.png' }) };
      }
      return {
        ok: true,
        json: async () => [
          { email: 'unverified@example.com', primary: true, verified: false },
          { email: 'taylor@example.com', primary: true, verified: true },
        ],
      };
    },
  });

  const profile = await service.fetchProfile('github', 'oauth-code', 'https://api.example.com/callback');

  assert.deepEqual(profile, {
    provider: 'github',
    providerId: '42',
    email: 'taylor@example.com',
    firstName: 'Taylor',
    lastName: 'Smith',
    avatar: 'https://avatars.example/taylor.png',
  });
});

test('Discord profile rejects unverified emails', async () => {
  const service = new SocialAuthService({
    fetchImpl: async (url) => url === 'https://discord.com/api/oauth2/token'
      ? { ok: true, json: async () => ({ access_token: 'provider-access-token' }) }
      : { ok: true, json: async () => ({ id: '123', username: 'taylor', email: 'taylor@example.com', verified: false }) },
  });

  await assert.rejects(
    () => service.fetchProfile('discord', 'oauth-code', 'https://api.example.com/callback'),
    /verified email/
  );
});

test('social signup tickets are signed, provider-bound, and expire or reject tampering', () => {
  const service = new SocialAuthService();
  const profile = {
    provider: 'discord',
    providerId: '123',
    email: 'taylor@example.com',
    firstName: 'Taylor',
    lastName: 'Smith',
  };
  const ticket = service.createSignupTicket(profile);

  assert.deepEqual(service.verifySignupTicket(ticket), profile);
  assert.throws(() => service.verifySignupTicket(`${ticket}x`), /expired|invalid/i);
  assert.throws(() => service.verifyTicket(ticket, 'social-oauth'), /Invalid social sign-in ticket/);
});

test('social login links a verified matching email to its provider identifier', async () => {
  const service = new SocialAuthService();
  const originalFindOne = User.findOne;
  const originalFindByEmail = User.findByEmail;
  const originalBusinessFind = Business.find;
  const user = {
    _id: 'user-id',
    email: 'taylor@example.com',
    emailVerified: true,
    status: 'active',
    memberships: [],
    loginHistory: [],
    toObject: () => ({ _id: 'user-id', email: 'taylor@example.com' }),
    async save() {},
  };

  try {
    User.findOne = async () => null;
    User.findByEmail = async () => user;
    Business.find = async () => [];
    const result = await service.completeLogin(
      service.createOAuthTicket({
        provider: 'github',
        providerId: '42',
        email: 'taylor@example.com',
        firstName: 'Taylor',
        lastName: 'Smith',
      }),
      '127.0.0.1',
      'test',
    );

    assert.equal(user.githubId, '42');
    assert.equal(result.registered, true);
    assert.equal(result.requiresPayment, false);
    assert.ok(result.token);
    assert.ok(result.refreshToken);
  } finally {
    User.findOne = originalFindOne;
    User.findByEmail = originalFindByEmail;
    Business.find = originalBusinessFind;
  }
});

test('new social users receive a paid-signup ticket without creating an account', async () => {
  const service = new SocialAuthService();
  const originalFindOne = User.findOne;
  const originalFindByEmail = User.findByEmail;

  try {
    User.findOne = async () => null;
    User.findByEmail = async () => null;
    const result = await service.completeLogin(
      service.createOAuthTicket({
        provider: 'discord',
        providerId: '123',
        email: 'new-user@example.com',
        firstName: 'New',
        lastName: 'User',
      }),
      '127.0.0.1',
      'test',
    );

    assert.equal(result.registered, false);
    assert.deepEqual(service.verifySignupTicket(result.signupTicket), {
      provider: 'discord',
      providerId: '123',
      email: 'new-user@example.com',
      firstName: 'New',
      lastName: 'User',
    });
  } finally {
    User.findOne = originalFindOne;
    User.findByEmail = originalFindByEmail;
  }
});
