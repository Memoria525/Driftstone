import { useState, useRef, useEffect, useMemo } from 'react';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import { getRelatedCards } from '../../data/relatedCards.js';

// Steps through the flashcards for one outcome. A slider below the card widens
// the deck: fully left shows only this objective's cards; dragging right pulls
// in cards from other objectives, most-related first (see relatedCards.js —
// the relatedness is simulated placeholder data, not real embeddings).

export default function CardViewer({ file, breadcrumb, onBack }) {
  const baseCards = useMemo(() => file.cards || [], [file]);
  const related = useMemo(() => getRelatedCards(file), [file]);

  const [relatedCount, setRelatedCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const questionRef = useRef(null);
  const answerRef = useRef(null);

  // The deck: this objective's cards, then the N most-related foreign cards.
  const deck = useMemo(() => {
    const base = baseCards.map((card) => ({ card, breadcrumb, foreign: false, score: null }));
    const extra = related.slice(0, relatedCount).map((r) => ({
      card: r.card,
      breadcrumb: r.breadcrumb,
      foreign: true,
      score: r.score,
    }));
    return [...base, ...extra];
  }, [baseCards, related, relatedCount, breadcrumb]);

  // Clamp at render (never setState in an effect) so a shrinking deck can't
  // strand the pointer past the end.
  const safeIndex = Math.min(index, deck.length - 1);
  const entry = deck[safeIndex];

  // Move focus to the question whenever the visible card changes (VoiceOver).
  useEffect(() => {
    questionRef.current?.focus();
  }, [safeIndex]);

  // Move focus to the answer when it is revealed.
  useEffect(() => {
    if (revealed) answerRef.current?.focus();
  }, [revealed]);

  function go(delta) {
    setRevealed(false);
    setIndex(() => Math.min(deck.length - 1, Math.max(0, safeIndex + delta)));
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
  const atFirst = safeIndex === 0;
  const atLast = safeIndex === deck.length - 1;

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
        <span className="text-xs text-[--color-text-muted] shrink-0">{safeIndex + 1} / {deck.length}</span>
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
            aria-label={`Card ${safeIndex + 1} of ${deck.length}.${entry.foreign ? ' Related card.' : ''} ${card.question}`}
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
