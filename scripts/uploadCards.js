/**
 * Upload cards from local JSON files to Firestore.
 *
 * Usage: node scripts/uploadCards.js
 *
 * Reads all JSON files from the Courses directory, creates/finds
 * course/chapter/section docs, then writes cards with auto-IDs.
 *
 * Requires: serviceAccountKey.json in project root.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

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
  const parts = filePath.split('/Courses/')[1];
  const segments = parts.split('/');
  return {
    course: segments[0],
    chapter: segments[1],
    section: basename(segments[2], '.json'),
  };
}

async function upload() {
  const jsonFiles = walkJsonFiles(coursesDir);
  console.log(`Found ${jsonFiles.length} JSON files`);

  // Build hierarchy lookup: find or create course/chapter/section docs
  const courseMap = new Map();  // name → { id, number }
  const chapterMap = new Map(); // "course/chapter" → { id, number }
  const sectionMap = new Map(); // "course/chapter/section" → { id, number }

  // Load existing hierarchy
  const [courseSnap, chapterSnap, sectionSnap] = await Promise.all([
    db.collection('courses').get(),
    db.collection('chapters').get(),
    db.collection('sections').get(),
  ]);

  for (const d of courseSnap.docs) {
    courseMap.set(d.data().name, { id: d.id, number: d.data().number });
  }
  // Build reverse lookups for chapters/sections using their parent IDs + names
  for (const d of chapterSnap.docs) {
    const data = d.data();
    // Find course name for this chapter's courseId
    const courseName = [...courseMap.entries()].find(([, v]) => v.id === data.courseId)?.[0];
    if (courseName) {
      const key = `${courseName}/${data.name}`;
      chapterMap.set(key, { id: d.id, number: data.number, courseId: data.courseId });
    }
  }
  for (const d of sectionSnap.docs) {
    const data = d.data();
    // Find chapter for this section
    const chapterEntry = [...chapterMap.entries()].find(([, v]) => v.id === data.chapterId);
    if (chapterEntry) {
      const key = `${chapterEntry[0]}/${data.name}`;
      sectionMap.set(key, { id: d.id, number: data.number, chapterId: data.chapterId });
    }
  }

  let totalCards = 0;
  let batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 500;

  for (const filePath of jsonFiles) {
    const { course, chapter, section } = parseFilePath(filePath);

    // Find or create course
    if (!courseMap.has(course)) {
      const maxNum = [...courseMap.values()].reduce((max, c) => Math.max(max, c.number), 0);
      const ref = db.collection('courses').doc();
      const num = maxNum + 1;
      batch.set(ref, { name: course, number: num, isPrivate: false });
      batchCount++;
      courseMap.set(course, { id: ref.id, number: num });
      console.log(`  Created course: ${course} (number: ${num})`);
    }
    const courseId = courseMap.get(course).id;

    // Find or create chapter
    const chKey = `${course}/${chapter}`;
    if (!chapterMap.has(chKey)) {
      const siblings = [...chapterMap.entries()].filter(([k]) => k.startsWith(`${course}/`));
      const maxNum = siblings.reduce((max, [, v]) => Math.max(max, v.number), 0);
      const ref = db.collection('chapters').doc();
      const num = maxNum + 1;
      batch.set(ref, { name: chapter, number: num, courseId });
      batchCount++;
      chapterMap.set(chKey, { id: ref.id, number: num, courseId });
      console.log(`  Created chapter: ${chKey} (number: ${num})`);
    }
    const chapterId = chapterMap.get(chKey).id;

    // Find or create section
    const secKey = `${course}/${chapter}/${section}`;
    if (!sectionMap.has(secKey)) {
      const siblings = [...sectionMap.entries()].filter(([k]) => k.startsWith(`${chKey}/`));
      const maxNum = siblings.reduce((max, [, v]) => Math.max(max, v.number), 0);
      const ref = db.collection('sections').doc();
      const num = maxNum + 1;
      batch.set(ref, { name: section, number: num, chapterId });
      batchCount++;
      sectionMap.set(secKey, { id: ref.id, number: num, chapterId });
      console.log(`  Created section: ${secKey} (number: ${num})`);
    }
    const sectionId = sectionMap.get(secKey).id;

    // Upload cards
    const fileContent = JSON.parse(readFileSync(filePath, 'utf8'));
    const cards = fileContent.cards || {};

    for (const [, cardArray] of Object.entries(cards)) {
      const [question, answer, explanation, , isPrivate] = cardArray;

      const docRef = db.collection('cards').doc();
      batch.set(docRef, {
        question,
        answer,
        explanation: explanation || '',
        courseId,
        chapterId,
        sectionId,
        cardType: 'sa',
        isPrivate: isPrivate ?? false,
      });

      batchCount++;
      totalCards++;

      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} docs...`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} docs`);
  }

  console.log(`\nDone! Uploaded ${totalCards} cards to Firestore.`);
  console.log(`  Courses: ${courseMap.size}, Chapters: ${chapterMap.size}, Sections: ${sectionMap.size}`);
}

upload().catch(console.error);
