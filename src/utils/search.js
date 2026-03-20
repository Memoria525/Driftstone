// Lightweight stemmer: strips common English suffixes for disambiguation.
// "apples" → "appl", "apple" → "appl", "running" → "run", etc.
function stem(word) {
  word = word.toLowerCase();
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('zes') || word.endsWith('xes')) return word.slice(0, -2);
  if (word.endsWith('ches') || word.endsWith('shes')) return word.slice(0, -2);
  if (word.endsWith('ness')) return word.slice(0, -4);
  if (word.endsWith('ment')) return word.slice(0, -4);
  if (word.endsWith('tion') || word.endsWith('sion')) return word.slice(0, -3);
  if (word.endsWith('ling') && word.length > 4) return word.slice(0, -3);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ied') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

// Tokenize a string into stemmed words
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 1)
    .map(stem);
}

const SEARCHABLE_FIELDS = ['question', 'answer', 'hint', 'explanation'];

/**
 * Search cards across question, answer, hint, and explanation.
 * Uses stemming so "apples" matches "apple", "running" matches "run", etc.
 * Returns cards with matched fields highlighted.
 */
export function searchCards(cards, query) {
  if (!query || query.trim().length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results = [];

  for (const card of cards) {
    const matchedFields = [];
    let score = 0;

    for (const field of SEARCHABLE_FIELDS) {
      const text = card[field];
      if (!text) continue;

      const fieldTokens = tokenize(text);
      const matched = queryTokens.every((qt) =>
        fieldTokens.some((ft) => ft.startsWith(qt) || qt.startsWith(ft))
      );

      if (matched) {
        matchedFields.push(field);
        // Weight question matches higher
        score += field === 'question' ? 3 : field === 'answer' ? 2 : 1;
      }
    }

    if (matchedFields.length > 0) {
      results.push({ card, matchedFields, score });
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Highlight matching terms in text. Returns array of {text, highlight} segments.
 */
export function highlightMatches(text, query) {
  if (!text || !query) return [{ text: text || '', highlight: false }];

  const queryWords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 1);

  if (queryWords.length === 0) return [{ text, highlight: false }];

  // Build regex that matches any query word (with flexible endings)
  const patterns = queryWords.map((w) => {
    const stemmed = stem(w);
    return `${stemmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`;
  });
  const regex = new RegExp(`(${patterns.join('|')})`, 'gi');

  const segments = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    segments.push({ text: match[0], highlight: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}
