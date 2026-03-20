// Loads card data from Firestore and builds a course tree.
// Course > Chapter > Section > cards[]

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

// Strip leading numbering: "04 Tissues" → "Tissues", "4.2.1 Foo" → "Foo"
function stripNumber(name) {
  return name.replace(/^[\d.]+\s+/, '');
}

// Extract sort key: "4.2.1 Foo" → "004.002.001"
function sortKey(segment) {
  const match = segment.match(/^([\d.]+)/);
  if (!match) return segment;
  return match[1]
    .split('.')
    .map((n) => n.padStart(4, '0'))
    .join('.');
}

let _cache = null;

export async function loadCourses() {
  if (_cache) return _cache;

  const snapshot = await getDocs(collection(db, 'cards'));
  const courseMap = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    const { course: courseName, chapter: chapterName, section: sectionName } = data;

    if (!courseMap[courseName]) {
      courseMap[courseName] = { chapters: {} };
    }
    if (!courseMap[courseName].chapters[chapterName]) {
      courseMap[courseName].chapters[chapterName] = { sections: {} };
    }
    if (!courseMap[courseName].chapters[chapterName].sections[sectionName]) {
      courseMap[courseName].chapters[chapterName].sections[sectionName] = {
        id: `${courseName}/${chapterName}/${sectionName}`,
        name: stripNumber(sectionName),
        sortKey: sortKey(sectionName),
        cards: [],
      };
    }

    courseMap[courseName].chapters[chapterName].sections[sectionName].cards.push({
      id: doc.id,
      question: data.question,
      answer: data.answer,
      hint: data.hint || '',
      explanation: data.explanation || '',
    });
  });

  // Convert to sorted arrays, filtering out empty sections/chapters/courses
  _cache = Object.entries(courseMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([courseName, courseData]) => ({
      id: courseName,
      name: courseName,
      chapters: Object.entries(courseData.chapters)
        .sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)))
        .map(([chapterName, chapterData]) => ({
          id: `${courseName}/${chapterName}`,
          name: stripNumber(chapterName),
          sections: Object.values(chapterData.sections)
            .filter((s) => s.cards.length > 0)
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
        }))
        .filter((ch) => ch.sections.length > 0),
    }))
    .filter((c) => c.chapters.length > 0);

  return _cache;
}

export function getCardsBySectionIds(courses, sectionIds) {
  const cards = [];
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        if (sectionIds.has(section.id)) {
          cards.push(...section.cards);
        }
      }
    }
  }
  return cards;
}

export function getCardsByIds(courses, cardIds) {
  const idSet = new Set(cardIds);
  const cards = [];
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        for (const card of section.cards) {
          if (idSet.has(card.id)) {
            cards.push(card);
          }
        }
      }
    }
  }
  return cards;
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
