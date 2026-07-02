import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import { getRelatedCards } from '../../data/relatedCards.js';

// Steps through the flashcards for one outcome, presented in random order. A
// slider widens the deck: fully left shows only this objective's cards;
// dragging right adds cards from other objectives, most-related first (see
// relatedCards.js — relatedness is simulated placeholder data). Relatedness
// decides which cards are in the pool; the pool is then shuffled for study.

const keyOf = (card) => card.card_id || card.question;

// Deterministic string -> [0, 1) hash (FNV-1a), for a stable shuffle key.
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export default function CardViewer({ file, breadcrumb, onBack }) {
  const baseCards = useMemo(() => file.cards || [], [file]);
  const related = useMemo(() => getRelatedCards(file), [file]);

  const [relatedCount, setRelatedCount] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Per-mount random seed → a stable, deterministic shuffle key per card. Keeps
  // the order fixed across renders and slider changes (new cards slot into
  // random positions; cards already in the deck don't move), and reshuffles
  // when the outcome is reopened. State (not a ref) is safe to read in render.
  const [seed] = useState(() => Math.random());
  const rank = useCallback((card) => hash01(`${seed}|${keyOf(card)}`), [seed]);

  // Track the visible card by identity so a growing/shrinking deck keeps it put.
  const [currentKey, setCurrentKey] = useState(() => {
    const first = [...baseCards].sort((a, b) => rank(a) - rank(b))[0];
    return first ? keyOf(first) : null;
  });

  const deck = useMemo(() => {
    const base = baseCards.map((card) => ({ card, breadcrumb, foreign: false, score: null }));
    const extra = related.slice(0, relatedCount).map((r) => ({
      card: r.card,
      breadcrumb: r.breadcrumb,
      foreign: true,
      score: r.score,
    }));
    return [...base, ...extra].sort((a, b) => rank(a.card) - rank(b.card));
  }, [baseCards, related, relatedCount, breadcrumb, rank]);

  let currentIndex = deck.findIndex((e) => keyOf(e.card) === currentKey);
  if (currentIndex < 0) currentIndex = 0;
  const entry = deck[currentIndex];
  const currentCardKey = entry ? keyOf(entry.card) : null;

  const questionRef = useRef(null);
  const answerRef = useRef(null);

  // Move focus to the question whenever the visible card changes (VoiceOver).
  useEffect(() => {
    questionRef.current?.focus();
  }, [currentCardKey]);

  // Move focus to the answer when it is revealed.
  useEffect(() => {
    if (revealed) answerRef.current?.focus();
  }, [revealed]);

  function go(delta) {
    setRevealed(false);
    const next = Math.min(deck.length - 1, Math.max(0, currentIndex + delta));
    setCurrentKey(keyOf(deck[next].card));
  }

  function onSlide(e) {
    setRevealed(false);
    setRelatedCount(Number(e.target.value));
  }

  if (!entry) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b border-[--color-border] bg-[--color-surface]">
          <button
            onClick={onBack}
            className="min-h-touch px-3 rounded-[--radius-md] text-sm text-[--color-text] border border-[--color-border] hover:bg-[--color-surface-sunken] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            ← Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-[--color-text-muted]">No flashcards for this outcome.</p>
        </div>
      </div>
    );
  }

  const card = entry.card;
  const atFirst = currentIndex === 0;
  const atLast = currentIndex === deck.length - 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[--color-border] bg-[--color-surface] flex items-center gap-3">
        <button
          onClick={onBack}
          className="min-h-touch px-3 rounded-[--radius-md] text-sm text-[--color-text] border border-[--color-border] hover:bg-[--color-surface-sunken] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        >
          ← Back
        </button>
        <p className="flex-1 text-xs text-[--color-text-muted] truncate">{entry.breadcrumb}</p>
        <span className="text-xs text-[--color-text-muted] shrink-0">{currentIndex + 1} / {deck.length}</span>
      </div>

      {/* Card body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {entry.foreign && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
              Related · ~{entry.score.toFixed(2)}
            </span>
          )}
          {card.is_private && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
              Private
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-[--color-text-muted] mb-1">Question</p>
          <p
            ref={questionRef}
            tabIndex={-1}
            className="text-base font-medium text-[--color-text] outline-none"
            aria-label={`Card ${currentIndex + 1} of ${deck.length}.${entry.foreign ? ' Related card.' : ''} ${card.question}`}
          >
            {card.question}
          </p>
        </div>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="w-full min-h-touch rounded-[--radius-md] font-semibold text-sm bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Reveal answer
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[--radius-md] bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Answer</p>
              <p
                ref={answerRef}
                tabIndex={-1}
                className="text-sm text-[--color-text] outline-none"
                aria-label={`Answer. ${card.answer}`}
              >
                {card.answer}
              </p>
            </div>

            {card.explanation && (
              <div className="rounded-[--radius-md] bg-[--color-surface-raised] border border-[--color-border] p-3">
                <p className="text-xs font-medium text-[--color-text-muted] mb-1">Explanation</p>
                <div className="space-y-2">{renderMarkdown(card.explanation)}</div>
              </div>
            )}

            {card.learning_objective && (
              <p className="text-xs text-[--color-text-muted]">
                <span className="font-medium">Objective:</span> {card.learning_objective}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Relatedness slider */}
      {related.length > 0 && (
        <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface] space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[--color-text-muted]">
            <span>Focus</span>
            <span aria-live="polite">
              {relatedCount === 0
                ? 'This objective only'
                : `+ ${relatedCount} related card${relatedCount === 1 ? '' : 's'}`}
            </span>
            <span>Explore</span>
          </div>
          <input
            type="range"
            min={0}
            max={related.length}
            value={relatedCount}
            onChange={onSlide}
            aria-label="Include related cards from other objectives"
            aria-valuetext={
              relatedCount === 0
                ? 'This objective only'
                : `${relatedCount} related card${relatedCount === 1 ? '' : 's'} included`
            }
            className="w-full accent-[--color-brand] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
          />
          <p className="text-[10px] text-[--color-text-muted] text-center">
            Relatedness is simulated placeholder data.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface] flex gap-2">
        <button
          onClick={() => go(-1)}
          disabled={atFirst}
          className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        >
          ← Previous
        </button>
        <button
          onClick={() => go(1)}
          disabled={atLast}
          className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
