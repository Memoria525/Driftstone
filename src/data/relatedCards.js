// PROTOTYPE relatedness — no real embeddings.
//
// Given the current outcome file (the study "anchor"), this ranks every card
// from *other* outcomes by a simulated similarity score. It stands in for a
// precomputed embedding-neighbour list: swap `simulatedScore` for a lookup
// into real cosine-similarity data later and the UI doesn't change.
//
// The fake score is deterministic (stable across renders) and deliberately
// plausible: cards in the same module score higher, keyword overlap with the
// anchor nudges it up, and a hashed spread keeps the ordering varied.

import { loadOutcomesTree } from './outcomesLoader.js';

// Deterministic string -> [0, 1) hash (FNV-1a).
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'is', 'are', 'how', 'what',
  'which', 'does', 'do', 'for', 'on', 'with', 'that', 'this', 'its', 'it', 'as',
  'by', 'be', 'from', 'into', 'than', 'when', 'why', 'give', 'name',
]);

function keywords(text) {
  const words = (text.toLowerCase().match(/[a-z]+/g) || [])
    .filter((w) => w.length > 3 && !STOP.has(w));
  return new Set(words);
}

function overlap(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

function simulatedScore(anchorId, anchorKeywords, anchorModule, candidate) {
  const card = candidate.card;
  // Base spread: stable pseudo-random in [0, 0.5).
  let score = hash01(`${anchorId}::${card.card_id || card.question}`) * 0.5;
  // Same module reads as "closely related".
  if (candidate.moduleName === anchorModule) score += 0.32;
  // Shared vocabulary between the anchor objective and the card.
  score += 0.18 * overlap(anchorKeywords, keywords(`${card.question} ${card.answer || ''}`));
  return Math.min(0.99, score);
}

/**
 * Rank every card outside `currentFile` by simulated relatedness to it.
 * Returns [{ card, breadcrumb, fileTitle, score }], most related first.
 */
export function getRelatedCards(currentFile) {
  const tree = loadOutcomesTree();

  let anchorModule = null;
  const others = [];

  for (const mod of tree) {
    for (const topic of mod.topics) {
      for (const f of topic.files) {
        if (f.id === currentFile.id) {
          anchorModule = mod.name;
          continue; // don't rank the anchor's own cards
        }
        for (const card of f.cards || []) {
          others.push({
            card,
            moduleName: mod.name,
            breadcrumb: `${mod.name} › ${topic.name}`,
            fileTitle: f.title,
          });
        }
      }
    }
  }

  const anchorKeywords = keywords(`${currentFile.title} ${currentFile.name}`);

  return others
    .map((o) => ({
      card: o.card,
      breadcrumb: o.breadcrumb,
      fileTitle: o.fileTitle,
      score: simulatedScore(currentFile.id, anchorKeywords, anchorModule, o),
    }))
    .sort((a, b) => b.score - a.score);
}
