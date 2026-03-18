// Loads all course JSON files from /Courses/** at build time via Vite glob.
// Builds a tree: Course > Chapter > Section > cards[]

const modules = import.meta.glob('/Courses/**/*.json', { eager: true });

// Strip leading numbering from display names: "04 Tissues" → "Tissues", "4.2.1 Foo" → "Foo"
function stripNumber(name) {
  return name.replace(/^[\d.]+\s+/, '');
}

// Extract sort key from a path segment (the numeric prefix, e.g. "04", "4.2.1")
function sortKey(segment) {
  const match = segment.match(/^([\d.]+)/);
  if (!match) return segment;
  // Pad each numeric part so string sort works: "4.2.1" → "004.002.001"
  return match[1]
    .split('.')
    .map((n) => n.padStart(4, '0'))
    .join('.');
}

let _courses = null;

function getCourses() {
  if (!_courses) _courses = buildCourses();
  return _courses;
}

export { getCourses as loadCourses };

export function getCardsBySectionIds(sectionIds) {
  const courses = getCourses();
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

export function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCourses() {
  // Group by course → chapter
  const courseMap = {};

  for (const [path, mod] of Object.entries(modules)) {
    // path: /Courses/Anatomy and Physiology/04 Tissues/4.2.1 Epithelial Tissue.json
    const parts = path.replace('/Courses/', '').replace(/\.json$/, '').split('/');
    if (parts.length !== 3) continue; // skip unexpected depth

    const [courseName, chapterName, sectionName] = parts;

    if (!courseMap[courseName]) {
      courseMap[courseName] = { chapters: {} };
    }
    if (!courseMap[courseName].chapters[chapterName]) {
      courseMap[courseName].chapters[chapterName] = { sections: {} };
    }

    const rawCards = mod.cards ?? {};
    const cards = Object.entries(rawCards).map(([id, data]) => ({
      id,
      question: data[0],
      answer: data[1],
      hint: data[2],
      explanation: data[3],
    }));

    courseMap[courseName].chapters[chapterName].sections[sectionName] = {
      id: `${courseName}/${chapterName}/${sectionName}`,
      name: stripNumber(sectionName),
      sortKey: sortKey(sectionName),
      cards,
    };
  }

  // Convert to sorted arrays, filtering out empty sections/chapters/courses
  return Object.entries(courseMap)
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
}
