import { useState, useRef, useEffect } from 'react';
import renderMarkdown from '../../utils/renderMarkdown.jsx';

// Steps through the flashcards attached to one outcome file. Each card reveals
// its answer and explanation on demand. Private cards are shown but badged.

export default function CardViewer({ file, breadcrumb, onBack }) {
  const cards = file.cards || [];
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const questionRef = useRef(null);
  const answerRef = useRef(null);

  const card = cards[index];

  // Move focus to the question whenever the card changes (VoiceOver).
  useEffect(() => {
    questionRef.current?.focus();
  }, [index]);

  // Move focus to the answer when it is revealed.
  useEffect(() => {
    if (revealed) answerRef.current?.focus();
  }, [revealed]);

  function go(delta) {
    setRevealed(false);
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
  }

  if (!card) {
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

  const atFirst = index === 0;
  const atLast = index === cards.length - 1;

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
        <p className="flex-1 text-xs text-[--color-text-muted] truncate">{breadcrumb}</p>
        <span className="text-xs text-[--color-text-muted] shrink-0">{index + 1} / {cards.length}</span>
      </div>

      {/* Card body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {card.is_private && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
            Private
          </span>
        )}

        <div>
          <p className="text-xs font-medium text-[--color-text-muted] mb-1">Question</p>
          <p
            ref={questionRef}
            tabIndex={-1}
            className="text-base font-medium text-[--color-text] outline-none"
            aria-label={`Card ${index + 1} of ${cards.length}. ${card.question}`}
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
