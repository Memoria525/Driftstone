/**
 * Clear all card-related data from Firestore.
 *
 * Deletes all documents in:
 *   - cards
 *   - reviewed_cards
 *   - users/{uid}/cardState (all users)
 *
 * Usage: node scripts/clearCards.js
 * Requires: serviceAccountKey.json in project root.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deleteCollection(collectionPath) {
  const snap = await db.collection(collectionPath).get();
  if (snap.empty) {
    console.log(`  ${collectionPath}: 0 docs (empty)`);
    return 0;
  }

  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  ${collectionPath}: ${snap.size} docs deleted`);
  return snap.size;
}

async function main() {
  let total = 0;

  console.log('Clearing cards...');
  total += await deleteCollection('cards');

  console.log('Clearing reviewed_cards...');
  total += await deleteCollection('reviewed_cards');

  console.log('Clearing cardState for all users...');
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    total += await deleteCollection(`users/${userDoc.id}/cardState`);
  }

  console.log(`\nDone. ${total} documents deleted.`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
