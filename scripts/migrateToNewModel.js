#!/usr/bin/env node
/**
 * Migrate Firestore from flat card model to hierarchical collections.
 *
 * BEFORE:
 *   cards/{encodedId}  — { course, chapter, section, question, answer, ... }
 *   courses/{name}     — { name, isPrivate }
 *
 * AFTER:
 *   courses/{autoId}   — { name, number, isPrivate }
 *   chapters/{autoId}  — { name, number, courseId }
 *   sections/{autoId}  — { name, number, chapterId }
 *   cards/{autoId}     — { question, answer, explanation, courseId, chapterId, sectionId, cardType, isPrivate }
 *
 * Also clears reviewed_cards and all users' cardState (test data).
 *
 * Usage: node scripts/migrateToNewModel.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const MAX_BATCH = 500;

async function deleteCollection(path) {
  const snap = await db.collection(path).get();
  if (snap.empty) return 0;
  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % MAX_BATCH === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % MAX_BATCH !== 0) await batch.commit();
  return count;
}

async function main() {
  // 1. Read all existing cards
  console.log('Reading existing cards...');
  const cardSnap = await db.collection('cards').get();
  const oldCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Found ${oldCards.length} cards`);

  // 2. Read existing courses
  console.log('Reading existing courses...');
  const courseSnap = await db.collection('courses').get();
  const oldCourses = new Map();
  for (const d of courseSnap.docs) {
    oldCourses.set(d.data().name, d.data());
  }
  console.log(`  Found ${oldCourses.size} courses`);

  // 3. Build hierarchy from cards
  // course name → { chapters: { chapterName → { sections: Set<sectionName> } } }
  const hierarchy = {};
  for (const card of oldCards) {
    const { course, chapter, section } = card;
    if (!course || !chapter || !section) continue;
    if (!hierarchy[course]) hierarchy[course] = {};
    if (!hierarchy[course][chapter]) hierarchy[course][chapter] = new Set();
    hierarchy[course][chapter].add(section);
  }

  // 4. Parse card IDs to extract existing numbers where possible
  function parseCardId(id) {
    const match = id.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)sa$/);
    if (!match) return null;
    return {
      courseNum: parseInt(match[1], 10),
      chapterNum: parseInt(match[2], 10),
      sectionNum: parseInt(match[3], 10),
      cardNum: parseInt(match[4], 10),
    };
  }

  // Try to derive numbers from existing card IDs for each level
  // Course numbers: find the most common course number used by cards in that course
  const courseNumbers = {};
  const chapterNumbers = {};  // key: "courseName/chapterName"
  const sectionNumbers = {};  // key: "courseName/chapterName/sectionName"

  for (const card of oldCards) {
    const parsed = parseCardId(card.id);
    if (!parsed) continue;
    const { course, chapter, section } = card;

    // Track course numbers
    if (!courseNumbers[course]) courseNumbers[course] = {};
    courseNumbers[course][parsed.courseNum] = (courseNumbers[course][parsed.courseNum] || 0) + 1;

    // Track chapter numbers
    const chKey = `${course}/${chapter}`;
    if (!chapterNumbers[chKey]) chapterNumbers[chKey] = {};
    chapterNumbers[chKey][parsed.chapterNum] = (chapterNumbers[chKey][parsed.chapterNum] || 0) + 1;

    // Track section numbers
    const secKey = `${course}/${chapter}/${section}`;
    if (!sectionNumbers[secKey]) sectionNumbers[secKey] = {};
    sectionNumbers[secKey][parsed.sectionNum] = (sectionNumbers[secKey][parsed.sectionNum] || 0) + 1;
  }

  // Pick the most common number for each
  function mostCommon(counts) {
    if (!counts) return null;
    let best = null, bestCount = 0;
    for (const [num, count] of Object.entries(counts)) {
      if (count > bestCount) { best = parseInt(num, 10); bestCount = count; }
    }
    return best;
  }

  // 5. Create new courses collection
  console.log('\nCreating new courses...');
  const courseIdMap = new Map(); // courseName → new doc ID
  let courseNum = 0;
  const sortedCourses = Object.keys(hierarchy).sort();
  let batch = db.batch();
  let batchCount = 0;

  for (const courseName of sortedCourses) {
    const num = mostCommon(courseNumbers[courseName]) ?? ++courseNum;
    if (num > courseNum) courseNum = num;
    const isPrivate = oldCourses.get(courseName)?.isPrivate ?? false;
    const ref = db.collection('courses').doc();
    courseIdMap.set(courseName, ref.id);
    batch.set(ref, { name: courseName, number: num, isPrivate });
    batchCount++;
    console.log(`  ${courseName} → number: ${num}, id: ${ref.id}`);
  }

  // 6. Create chapters collection
  console.log('\nCreating chapters...');
  const chapterIdMap = new Map(); // "courseName/chapterName" → new doc ID
  for (const courseName of sortedCourses) {
    const chapters = Object.keys(hierarchy[courseName]).sort();
    let chNum = 0;
    for (const chapterName of chapters) {
      const chKey = `${courseName}/${chapterName}`;
      const num = mostCommon(chapterNumbers[chKey]) ?? ++chNum;
      if (num > chNum) chNum = num;
      const ref = db.collection('chapters').doc();
      chapterIdMap.set(chKey, ref.id);
      batch.set(ref, {
        name: chapterName,
        number: num,
        courseId: courseIdMap.get(courseName),
      });
      batchCount++;
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
      console.log(`  ${chKey} → number: ${num}`);
    }
  }

  // 7. Create sections collection
  console.log('\nCreating sections...');
  const sectionIdMap = new Map(); // "courseName/chapterName/sectionName" → new doc ID
  for (const courseName of sortedCourses) {
    for (const chapterName of Object.keys(hierarchy[courseName]).sort()) {
      const chKey = `${courseName}/${chapterName}`;
      const sections = [...hierarchy[courseName][chapterName]].sort();
      let secNum = 0;
      for (const sectionName of sections) {
        const secKey = `${courseName}/${chapterName}/${sectionName}`;
        const num = mostCommon(sectionNumbers[secKey]) ?? ++secNum;
        if (num > secNum) secNum = num;
        const ref = db.collection('sections').doc();
        sectionIdMap.set(secKey, ref.id);
        batch.set(ref, {
          name: sectionName,
          number: num,
          chapterId: chapterIdMap.get(chKey),
        });
        batchCount++;
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
        console.log(`  ${secKey} → number: ${num}`);
      }
    }
  }

  // Commit remaining hierarchy docs
  if (batchCount > 0) {
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  // 8. Delete old cards and create new ones with auto-IDs
  console.log('\nDeleting old cards...');
  const oldCardCount = await deleteCollection('cards');
  console.log(`  Deleted ${oldCardCount} old card docs`);

  console.log('\nCreating new cards with auto-IDs...');
  let newCardCount = 0;
  for (const card of oldCards) {
    const { course, chapter, section } = card;
    const secKey = `${course}/${chapter}/${section}`;
    const chKey = `${course}/${chapter}`;

    const courseId = courseIdMap.get(course);
    const chapterId = chapterIdMap.get(chKey);
    const sectionId = sectionIdMap.get(secKey);

    if (!courseId || !chapterId || !sectionId) {
      console.warn(`  Skipping card ${card.id}: missing hierarchy ref`);
      continue;
    }

    // Extract card type from old ID
    const typeMatch = card.id.match(/(sa|mc)$/);
    const cardType = typeMatch ? typeMatch[1] : 'sa';

    const ref = db.collection('cards').doc();
    batch.set(ref, {
      question: card.question || '',
      answer: card.answer || '',
      explanation: card.explanation || '',
      courseId,
      chapterId,
      sectionId,
      cardType,
      isPrivate: card.isPrivate ?? false,
    });
    batchCount++;
    newCardCount++;

    if (batchCount >= MAX_BATCH) {
      await batch.commit();
      console.log(`  Committed batch (${newCardCount} cards so far)...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`  Created ${newCardCount} new card docs`);

  // 9. Delete old courses (keyed by name)
  console.log('\nDeleting old course docs (keyed by name)...');
  const oldCourseSnap = await db.collection('courses').get();
  batch = db.batch();
  batchCount = 0;
  let deletedOldCourses = 0;
  for (const d of oldCourseSnap.docs) {
    // Only delete docs that were created before migration (no 'number' field)
    // Actually, the new ones we just created have 'number'. Old ones don't.
    // But we already deleted old cards and recreated courses. The old course docs
    // are the ones with the course name as their doc ID.
    if (!d.data().number) {
      batch.delete(d.ref);
      batchCount++;
      deletedOldCourses++;
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`  Deleted ${deletedOldCourses} old course docs`);

  // 10. Clear reviewed_cards (test data)
  console.log('\nClearing reviewed_cards (test data)...');
  const reviewedCount = await deleteCollection('reviewed_cards');
  console.log(`  Deleted ${reviewedCount} reviewed_cards docs`);

  // 11. Clear all cardState subcollections
  console.log('\nClearing user cardState (test data)...');
  const usersSnap = await db.collection('users').get();
  let stateCount = 0;
  for (const userDoc of usersSnap.docs) {
    const stateSnap = await db.collection('users').doc(userDoc.id).collection('cardState').get();
    if (stateSnap.empty) continue;
    batch = db.batch();
    batchCount = 0;
    for (const d of stateSnap.docs) {
      batch.delete(d.ref);
      batchCount++;
      stateCount++;
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
  }
  console.log(`  Deleted ${stateCount} cardState docs`);

  // 12. Clear errors (test data)
  console.log('\nClearing errors (test data)...');
  const errCount = await deleteCollection('errors');
  console.log(`  Deleted ${errCount} error docs`);

  console.log('\n✓ Migration complete!');
  console.log(`  Courses: ${courseIdMap.size}`);
  console.log(`  Chapters: ${chapterIdMap.size}`);
  console.log(`  Sections: ${sectionIdMap.size}`);
  console.log(`  Cards: ${newCardCount}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
});
