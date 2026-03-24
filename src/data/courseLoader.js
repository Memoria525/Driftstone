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

let _cacheAll = null; // all cards including private

async function loadAllCourses() {
  if (_cacheAll) return _cacheAll;

  const snapshot = await getDocs(collection(db, 'cards'));
  const courseMap = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    const { course: courseName, chapter: chapterName, section: sectionName } = data;

    if (!courseName || !chapterName || !sectionName) return;

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
      isPrivate: data.isPrivate ?? false,
    });
  });

  // Convert to sorted arrays, filtering out empty sections/chapters/courses
  _cacheAll = Object.entries(courseMap)
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

  return _cacheAll;
}

// Filter out private cards, removing empty sections/chapters/courses
function filterPublished(courses) {
  return courses
    .map(course => ({
      ...course,
      chapters: course.chapters
        .map(chapter => ({
          ...chapter,
          sections: chapter.sections
            .map(section => ({
              ...section,
              cards: section.cards.filter(c => !c.isPrivate),
            }))
            .filter(s => s.cards.length > 0),
        }))
        .filter(ch => ch.sections.length > 0),
    }))
    .filter(c => c.chapters.length > 0);
}

/** Load published cards only (for study flow) */
export async function loadCourses() {
  const all = await loadAllCourses();
  return filterPublished(all);
}

/** Load all cards including private (for admin review) */
export async function loadAllCoursesAdmin() {
  return loadAllCourses();
}

/** Invalidate cache (call after admin edits a card) */
export function invalidateCache() {
  _cacheAll = null;
}

export function getCardsBySectionIds(courses, sectionIds) {
  const cards = [];
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        if (sectionIds.has(section.id)) {
          for (const card of section.cards) {
            cards.push({ ...card, courseName: course.name, chapterName: chapter.name, sectionName: section.name });
          }
        }
      }
    }
  }
  return cards;
}

export function getCardsByIds(courses, cardIds) {
  const cardMap = new Map();
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        for (const card of section.cards) {
          cardMap.set(card.id, { ...card, courseName: course.name, chapterName: chapter.name, sectionName: section.name });
        }
      }
    }
  }
  return cardIds.map((id) => cardMap.get(id)).filter(Boolean);
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
