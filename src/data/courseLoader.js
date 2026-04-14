// Loads card data from Firestore and builds a course tree.
// Course > Chapter > Section > cards[]
//
// New model: courses, chapters, sections are separate collections.
// Cards reference them via courseId, chapterId, sectionId.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

let _cacheAll = null;

async function loadAllCourses() {
  if (_cacheAll) return _cacheAll;

  // Load all four collections in parallel
  const [courseSnap, chapterSnap, sectionSnap, cardSnap] = await Promise.all([
    getDocs(collection(db, 'courses')),
    getDocs(collection(db, 'chapters')),
    getDocs(collection(db, 'sections')),
    getDocs(collection(db, 'cards')),
  ]);

  // Build lookup maps
  const coursesById = new Map();
  for (const d of courseSnap.docs) {
    coursesById.set(d.id, { ...d.data(), id: d.id, chapters: [] });
  }

  const chaptersById = new Map();
  for (const d of chapterSnap.docs) {
    chaptersById.set(d.id, { ...d.data(), id: d.id, sections: [] });
  }

  const sectionsById = new Map();
  for (const d of sectionSnap.docs) {
    sectionsById.set(d.id, { ...d.data(), id: d.id, cards: [] });
  }

  // Place cards into sections
  for (const d of cardSnap.docs) {
    const data = d.data();
    const section = sectionsById.get(data.sectionId);
    if (!section) continue;
    section.cards.push({
      id: d.id,
      question: data.question,
      answer: data.answer,
      explanation: data.explanation || '',
      isPrivate: data.isPrivate ?? false,
      cardType: data.cardType || 'sa',
    });
  }

  // Place sections into chapters
  for (const section of sectionsById.values()) {
    const chapter = chaptersById.get(section.chapterId);
    if (!chapter) continue;
    chapter.sections.push(section);
  }

  // Place chapters into courses
  for (const chapter of chaptersById.values()) {
    const course = coursesById.get(chapter.courseId);
    if (!course) continue;
    course.chapters.push(chapter);
  }

  // Sort and filter empty, build final tree
  _cacheAll = [...coursesById.values()]
    .sort((a, b) => a.number - b.number)
    .map(course => ({
      id: course.id,
      name: course.name,
      number: course.number,
      isPrivate: course.isPrivate ?? false,
      chapters: course.chapters
        .sort((a, b) => a.number - b.number)
        .map(chapter => ({
          id: chapter.id,
          name: chapter.name,
          number: chapter.number,
          sections: chapter.sections
            .sort((a, b) => a.number - b.number)
            .map(section => ({
              id: section.id,
              name: section.name,
              number: section.number,
              cards: section.cards,
            }))
            .filter(s => s.cards.length > 0),
        }))
        .filter(ch => ch.sections.length > 0),
    }))
    .filter(c => c.chapters.length > 0);

  return _cacheAll;
}

// Filter out private cards, removing empty sections/chapters/courses
function filterPublishedCards(courses) {
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

// Filter out entire private courses
function filterPrivateCourses(courses) {
  return courses.filter(c => !c.isPrivate);
}

/**
 * Load courses for a user.
 * - Non-admin: published cards only, no private courses
 * - Admin (not hiding): published cards + private courses visible
 * - Admin (hiding): same as non-admin
 */
export async function loadCoursesForUser(isAdmin = false, hideAdmin = false) {
  const all = await loadAllCourses();
  const published = filterPublishedCards(all);

  if (isAdmin && !hideAdmin) {
    return published;
  }

  return filterPrivateCourses(published);
}

/** Load all cards including private (for admin card review tab) */
export async function loadAllCoursesAdmin() {
  return loadAllCourses();
}

/** Invalidate cache (call after admin edits a card or course settings) */
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

/** Get all visible card IDs from a course tree */
export function getAllCardIds(courses) {
  const ids = new Set();
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        for (const card of section.cards) {
          ids.add(card.id);
        }
      }
    }
  }
  return ids;
}

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
