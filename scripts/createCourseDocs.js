#!/usr/bin/env node
// Creates a doc in the 'courses' collection for each unique course name found in cards.
// All courses default to isPrivate: false (public).
// Usage: node scripts/createCourseDocs.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const snap = await db.collection('cards').get();
const courseNames = new Set();
for (const doc of snap.docs) {
  const name = doc.data().course;
  if (name) courseNames.add(name);
}

console.log(`Found ${courseNames.size} unique courses:`);
for (const name of courseNames) {
  console.log(`  - ${name}`);
}

const batch = db.batch();
let count = 0;
for (const name of courseNames) {
  const ref = db.collection('courses').doc(name);
  const existing = await ref.get();
  if (existing.exists) {
    console.log(`  Skipping "${name}" (already exists)`);
    continue;
  }
  batch.set(ref, { name, isPrivate: false });
  count++;
}

if (count > 0) {
  await batch.commit();
}

console.log(`Done. Created ${count} course docs (${courseNames.size - count} already existed).`);
