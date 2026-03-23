// FSRS-5 (Free Spaced Repetition Scheduler) — pure functions, no side effects.

const DECAY = -0.5;
const FACTOR = 19 / 81; // ≈ 0.2346
const DESIRED_RETENTION = 0.9;

// FSRS-5 default parameters (w0–w18)
const W = [
  0.40255, 1.18385, 3.173, 15.69105, // w0-w3: initial stability per rating
  7.1949,   // w4: initial difficulty baseline
  0.5345,   // w5: initial difficulty grade scaling
  1.4604,   // w6: difficulty delta from grade
  0.0046,   // w7: mean reversion weight
  1.54575,  // w8: recall stability multiplier
  0.1192,   // w9: stability decay exponent
  1.01925,  // w10: retrievability sensitivity
  1.9395,   // w11: post-lapse stability base
  0.11,     // w12: difficulty effect on lapse
  0.29605,  // w13: stability effect on lapse
  2.2698,   // w14: retrievability effect on lapse
  0.2315,   // w15: hard penalty
  2.9898,   // w16: easy bonus
  0.51655,  // w17: same-day review scaling
  0.6621,   // w18: same-day review grade offset
];

export const GRADE_TO_RATING = { missed: 1, close: 2, nailed: 3, easy: 4 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// --- Public API ---

export function createEmptyCardState(cardId) {
  return {
    cardId,
    difficulty: 0,
    stability: 0,
    due: new Date(0), // epoch — always due
    lastReview: null,
    state: 'new',
    reps: 0,
    lapses: 0,
  };
}

export function computeRetrievability(cardState, now = new Date()) {
  if (!cardState.lastReview || cardState.state === 'new') return 0;
  if (!cardState.stability || cardState.stability <= 0) return 0;
  const elapsedDays = (now - cardState.lastReview) / (1000 * 60 * 60 * 24);
  if (elapsedDays < 0) return 1;
  return Math.pow(1 + (FACTOR * elapsedDays) / cardState.stability, DECAY);
}

export function scheduleCard(cardState, rating, now = new Date()) {
  const next = { ...cardState, lastReview: now };

  if (cardState.state === 'new') {
    // First review — initialize D and S
    next.difficulty = initialDifficulty(rating);
    next.stability = initialStability(rating);
    next.reps = 1;
    next.lapses = rating === 1 ? 1 : 0;
    next.state = rating === 1 ? 'relearning' : 'learning';
  } else {
    const R = computeRetrievability(cardState, now);

    // Update difficulty
    next.difficulty = nextDifficulty(cardState.difficulty, rating);

    if (rating === 1) {
      // Again — lapse
      next.stability = stabilityAfterLapse(cardState.difficulty, cardState.stability, R);
      next.lapses = cardState.lapses + 1;
      next.state = 'relearning';
    } else {
      // Hard (2) or Good (3) — successful recall
      next.stability = stabilityAfterRecall(
        cardState.difficulty, cardState.stability, R, rating
      );
      next.state = 'review';
    }
    next.reps = cardState.reps + 1;
  }

  // Clamp stability floor
  next.stability = Math.max(next.stability, 0.1);

  // Compute next due date from interval
  const interval = nextInterval(next.stability);
  next.due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return next;
}

export function sortByPriority(cards, stateMap, now = new Date()) {
  const due = [];
  const unseen = [];

  for (const card of cards) {
    const s = stateMap.get(card.id);
    if (!s || s.state === 'new') {
      unseen.push(card);
    } else {
      due.push(card);
    }
  }

  // Sort due cards: most overdue first
  due.sort((a, b) => {
    const sa = stateMap.get(a.id);
    const sb = stateMap.get(b.id);
    return (sa.due - now) - (sb.due - now);
  });

  return [...due, ...unseen];
}

// --- Internal formulas ---

function initialStability(rating) {
  return W[Math.min(rating, 4) - 1]; // w0=Again, w1=Hard, w2=Good, w3=Easy
}

function initialDifficulty(rating) {
  return clamp(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(D, rating) {
  const deltaD = -W[6] * (rating - 3);
  const Dprime = D + deltaD * ((10 - D) / 9);
  const D0_default = clamp(W[4] - Math.exp(W[5] * 2) + 1, 1, 10); // D_0(Good)
  return clamp(W[7] * D0_default + (1 - W[7]) * Dprime, 1, 10);
}

function stabilityAfterRecall(D, S, R, rating) {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return S * (1 + Math.exp(W[8]) * (11 - D) *
    Math.pow(S, -W[9]) *
    (Math.exp(W[10] * (1 - R)) - 1) *
    hardPenalty * easyBonus);
}

function stabilityAfterLapse(D, S, R) {
  const newS = W[11] * Math.pow(D, -W[12]) *
    (Math.pow(S + 1, W[13]) - 1) *
    Math.exp(W[14] * (1 - R));
  return Math.min(newS, S); // never exceed pre-lapse stability
}

function nextInterval(stability) {
  const interval = (stability / FACTOR) *
    (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}
