import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers.js';

setupEnv();
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

const { Business, User } = await import('../src/models/index.js');
const { GoogleAuthService } = await import('../src/services/googleAuthService.js');

const googlePayload = {
  sub: 'google-subject-123',
  email: 'person@example.com',
  email_verified: true,
  given_name: 'Google',
  family_name: 'Person',
};

test('Google credential verification enforces configured audience and verified email', async () => {
  let verificationOptions;
  const service = new GoogleAuthService({
    client: {
      verifyIdToken: async (options) => {
        verificationOptions = options;
        return { getPayload: () => googlePayload };
      },
    },
  });

  const profile = await service.verifyCredential('a'.repeat(32));

  assert.deepEqual(verificationOptions, {
    idToken: 'a'.repeat(32),
    audience: 'test-google-client-id',
  });
  assert.deepEqual(profile, {
    googleId: 'google-subject-123',
    email: 'person@example.com',
    firstName: 'Google',
    lastName: 'Person',
  });
});

test('Google login does not create an account for a new identity before payment', async () => {
  const service = new GoogleAuthService({
    client: { verifyIdToken: async () => ({ getPayload: () => googlePayload }) },
  });
  const originalFindOne = User.findOne;
  const originalFindByEmail = User.findByEmail;
  let emailLookups = 0;

  try {
    User.findOne = async () => null;
    User.findByEmail = async () => {
      emailLookups += 1;
      return null;
    };

    const result = await service.login('a'.repeat(32), '127.0.0.1', 'test-agent');
    assert.equal(result.registered, false);
    assert.equal(result.profile.email, 'person@example.com');
    assert.equal(emailLookups, 1);
    assert.equal(result.token, undefined);
  } finally {
    User.findOne = originalFindOne;
    User.findByEmail = originalFindByEmail;
  }
});

test('Google login links a verified email to an existing account and requests payment if no plan is active', async () => {
  const service = new GoogleAuthService({
    client: { verifyIdToken: async () => ({ getPayload: () => googlePayload }) },
  });
  const originalFindOne = User.findOne;
  const originalFindByEmail = User.findByEmail;
  const originalFindBusinesses = Business.find;
  const user = {
    _id: 'user-id',
    email: googlePayload.email,
    googleId: undefined,
    emailVerified: false,
    memberships: [{ role: 'owner', status: 'active', businessId: 'business-id' }],
    loginHistory: [],
    toObject() {
      return { _id: this._id, email: this.email, password: 'hidden' };
    },
    async save() {},
  };

  try {
    User.findOne = async () => null;
    User.findByEmail = async () => user;
    Business.find = async () => [{ subscription: { plan: 'none', status: 'none' } }];

    const result = await service.login('a'.repeat(32), '127.0.0.1', 'test-agent');
    assert.equal(user.googleId, googlePayload.sub);
    assert.equal(user.emailVerified, true);
    assert.equal(result.registered, true);
    assert.equal(result.requiresPayment, true);
    assert.ok(result.token);
    assert.ok(result.refreshToken);
    assert.equal(result.user.password, undefined);
  } finally {
    User.findOne = originalFindOne;
    User.findByEmail = originalFindByEmail;
    Business.find = originalFindBusinesses;
  }
});

test('Google sign-in rejects email claims that are not verified', async () => {
  const service = new GoogleAuthService({
    client: {
      verifyIdToken: async () => ({
        getPayload: () => ({ ...googlePayload, email_verified: false }),
      }),
    },
  });

  await assert.rejects(
    service.verifyCredential('a'.repeat(32)),
    /Google did not return a verified email address/
  );
});
