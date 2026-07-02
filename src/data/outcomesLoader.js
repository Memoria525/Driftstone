// Loads the "Cars Outcomes" folder tree at build time and exposes it as a
// nested Module > Topic > File structure for the Library viewer.
//
// The folder lives in the repo root, so we glob up out of src/. Vite inlines
// each markdown file's raw text into the bundle, which keeps the viewer fully
// client-side with no fetch/loading state.

const ROOT = 'Cars Outcomes';

const RAW = import.meta.glob('../../Cars Outcomes/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Companion flashcard files: `<same-base>.cards.json` next to each markdown
// file. Vite parses the JSON, so each value is the card array.
const CARDS = import.meta.glob('../../Cars Outcomes/**/*.cards.json', {
  import: 'default',
  eager: true,
});

// Map a markdown file's path to its parsed cards array (empty if none).
function cardsForMarkdown(mdPath) {
  const base = mdPath.replace(/\.md$/, '');
  const data = CARDS[`${base}.cards.json`];
  return Array.isArray(data) ? data : [];
}

// Natural sort so "A2" < "A10" and "Module A" < "Module C".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const byName = (a, b) => collator.compare(a.name, b.name);

// Pull a human title from the file: first `#`/`##` heading, else the filename.
function titleFromContent(content, fallback) {
  for (const line of content.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+)/);
    if (m) return m[1].trim();
  }
  return fallback;
}

function buildTree() {
  const modules = new Map();

  for (const [path, content] of Object.entries(RAW)) {
    const rel = path.split(`/${ROOT}/`)[1];
    if (!rel) continue;

    const parts = rel.split('/');
    if (parts.length < 3) continue; // expect module/topic/file.md

    const moduleName = parts[0];
    const topicName = parts[1];
    const fileName = parts.slice(2).join('/').replace(/\.md$/, '');

    if (!modules.has(moduleName)) {
      modules.set(moduleName, { id: moduleName, name: moduleName, topics: new Map() });
    }
    const mod = modules.get(moduleName);

    if (!mod.topics.has(topicName)) {
      mod.topics.set(topicName, { id: `${moduleName}/${topicName}`, name: topicName, files: [] });
    }
    const topic = mod.topics.get(topicName);

    topic.files.push({
      id: path,
      name: fileName,
      title: titleFromContent(content, fileName),
      content,
      cards: cardsForMarkdown(path),
    });
  }

  return [...modules.values()]
    .map((mod) => ({
      id: mod.id,
      name: mod.name,
      topics: [...mod.topics.values()]
        .map((topic) => ({
          ...topic,
          files: topic.files.sort(byName),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

let _tree = null;

export function loadOutcomesTree() {
  if (!_tree) _tree = buildTree();
  return _tree;
}
