#!/usr/bin/env node
// Deletes all cardState docs for a user, resetting their FSRS progress.
// Usage: node scripts/resetCardState.js <email>

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/resetCardState.js <email>');
  process.exit(1);
}

try {
  const user = await auth.getUserByEmail(email);
  const snap = await db.collection('users').doc(user.uid).collection('cardState').get();
  console.log(`Found ${snap.size} cardState docs for ${email} (${user.uid})`);

  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Deleted ${count} so far...`);
      batch = db.batch();
    }
  }
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`Done. Deleted ${count} cardState docs.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
