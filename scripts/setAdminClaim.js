#!/usr/bin/env node
// Sets or revokes the admin custom claim for a user by email.
// Usage: node scripts/setAdminClaim.js <email> [revoke]

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);

const email = process.argv[2];
const revoke = process.argv[3] === 'revoke';

if (!email) {
  console.error('Usage: node scripts/setAdminClaim.js <email> [revoke]');
  process.exit(1);
}

try {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: !revoke });
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin for ${email} (uid: ${user.uid})`);
  console.log('User must sign out and back in for the claim to take effect.');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
