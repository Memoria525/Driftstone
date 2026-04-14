#!/usr/bin/env node
// Deletes ALL card-related Firestore data: cards, chapters, sections, courses,
// and all users' cardState subcollections.
// Usage: node scripts/clearAllCards.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) {
    console.log(`  ${name}: 0 docs (skipped)`);
    return 0;
  }

  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 500 !== 0) {
    await batch.commit();
  }
  console.log(`  ${name}: ${count} docs deleted`);
  return count;
}

async function deleteAllCardState() {
  const usersSnap = await db.collection('users').get();
  let total = 0;
  for (const userDoc of usersSnap.docs) {
    const csSnap = await userDoc.ref.collection('cardState').get();
    if (csSnap.empty) continue;

    let batch = db.batch();
    let count = 0;
    for (const doc of csSnap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 500 !== 0) {
      await batch.commit();
    }
    console.log(`  users/${userDoc.id}/cardState: ${count} docs deleted`);
    total += count;
  }
  return total;
}

try {
  console.log('Clearing all card-related Firestore data...\n');

  let total = 0;
  for (const col of ['cards', 'sections', 'chapters', 'courses']) {
    total += await deleteCollection(col);
  }

  console.log('');
  total += await deleteAllCardState();

  console.log(`\nDone. ${total} total docs deleted.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
