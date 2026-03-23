/**
 * Upload cards from local JSON files to Firestore.
 *
 * Usage: node scripts/uploadCards.js
 *
 * Reads all JSON files from the Courses directory, splits each card
 * into its own Firestore document in the "cards" collection.
 *
 * Document ID = the card ID (e.g., "01.04.02.01.001sa")
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to a
 * Firebase service account key, OR firebase-admin will use default credentials.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

// Walk the Courses directory
const coursesDir = new URL('../Courses', import.meta.url).pathname;

function walkJsonFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
    } else if (entry.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFilePath(filePath) {
  // Extract course, chapter, section from the file path
  // e.g., .../Courses/Anatomy and Physiology/04 Tissues/4.2.1 Epithelial Tissue - An Overview.json
  const parts = filePath.split('/Courses/')[1];
  const segments = parts.split('/');

  const course = segments[0]; // "Anatomy and Physiology"
  const chapter = segments[1]; // "04 Tissues"
  const sectionFile = basename(segments[2], '.json'); // "4.2.1 Epithelial Tissue - An Overview"

  return { course, chapter, section: sectionFile };
}

async function upload() {
  const jsonFiles = walkJsonFiles(coursesDir);
  console.log(`Found ${jsonFiles.length} JSON files`);

  let totalCards = 0;
  let batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 500; // Firestore batch limit

  for (const filePath of jsonFiles) {
    const { course, chapter, section } = parseFilePath(filePath);
    const fileContent = JSON.parse(readFileSync(filePath, 'utf8'));
    const cards = fileContent.cards || {};

    for (const [cardId, cardArray] of Object.entries(cards)) {
      const [question, answer, hint, explanation, isShortAnswer, isPrivate, hasBeenReviewed, points] = cardArray;

      const docRef = db.collection('cards').doc(cardId);
      batch.set(docRef, {
        question,
        answer,
        hint: hint || '',
        explanation: explanation || '',
        isShortAnswer: isShortAnswer ?? true,
        isPrivate: isPrivate ?? false,
        hasBeenReviewed: hasBeenReviewed ?? false,
        points: points ?? 0,
        course,
        chapter,
        section,
      });

      batchCount++;
      totalCards++;

      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} cards...`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} cards`);
  }

  console.log(`\nDone! Uploaded ${totalCards} cards to Firestore.`);
}

upload().catch(console.error);
