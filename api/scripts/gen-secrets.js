import crypto from 'crypto';

const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');

console.log('# Paste these into your .env (never commit them)');
console.log(`JWT_SECRET=${hex(32)}`);
console.log(`JWT_REFRESH_SECRET=${hex(32)}`);
console.log(`ENCRYPTION_KEY=${hex(32)}`);
