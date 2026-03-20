/**
 * Set or revoke the admin custom claim for a Firebase user.
 *
 * Usage:
 *   node scripts/setAdminClaim.js <uid>            # grant admin
 *   node scripts/setAdminClaim.js --revoke <uid>   # revoke admin
 *
 * Requires: serviceAccountKey.json in the project root.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Initialize Firebase Admin (same pattern as uploadCards.js)
const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth(app);

// Parse CLI args
const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const uid = args.find((arg) => !arg.startsWith('--'));

if (!uid) {
  console.error('Usage: node scripts/setAdminClaim.js [--revoke] <uid>');
  process.exit(1);
}

async function run() {
  if (revoke) {
    // Remove admin claim by setting it to null
    await auth.setCustomUserClaims(uid, { admin: null });
    console.log(`Revoked admin claim for user ${uid}`);
  } else {
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log(`Set admin claim for user ${uid}`);
  }

  // Verify
  const user = await auth.getUser(uid);
  console.log('Current custom claims:', user.customClaims);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
