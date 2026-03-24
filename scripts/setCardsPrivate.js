#!/usr/bin/env node
// Flips isPrivate to true on all cards in the cards collection.
// Usage: node scripts/setCardsPrivate.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const snap = await db.collection('cards').get();
console.log(`Found ${snap.size} cards. Setting isPrivate = true...`);

let batch = db.batch();
let count = 0;
for (const doc of snap.docs) {
  batch.update(doc.ref, { isPrivate: true });
  count++;
  if (count % 500 === 0) {
    await batch.commit();
    console.log(`  Committed ${count} so far...`);
    batch = db.batch();
  }
}

if (count % 500 !== 0) {
  await batch.commit();
}

console.log(`Done. Set isPrivate = true on ${count} cards.`);
