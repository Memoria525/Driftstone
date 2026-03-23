import { useState, useRef, useEffect } from 'react';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import useAnnounce from '../../hooks/useAnnounce.js';

const GRADES = [
  { id: 'easy', label: 'Easy', color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'nailed', label: 'Nailed it', color: 'bg-emerald-500 hover:bg-emerald-600' },
  { id: 'close', label: 'Close', color: 'bg-amber-500 hover:bg-amber-600' },
  { id: 'missed', label: 'Missed it', color: 'bg-red-500 hover:bg-red-600' },
];

export default function CardViewer({ card, index, total, onGrade, onDone }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef(null);
  const announce = useAnnounce();

  // Reset state and announce when card changes
  useEffect(() => {
    setUserAnswer('');
    setShowHint(false);
    setRevealed(false);
    inputRef.current?.focus();
    announce(`Card ${index + 1} of ${total}. ${card.question}`);
  }, [card.id, index, total, card.question, announce]);

  function handleSubmit(e) {
    e.preventDefault();
    setRevealed(true);
    announce('Answer revealed. Grade your response.');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between text-xs text-[--color-text-muted] mb-2">
          <span>Card {index + 1} of {total}</span>
          <button
            onClick={onDone}
            className="text-xs font-medium text-[--color-text-muted] hover:text-[--color-text] min-h-touch flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
          >
            Done
          </button>
        </div>
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Card ${index + 1} of ${total}`}
          className="h-1.5 bg-[--color-surface-sunken] rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[--color-brand] rounded-full transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Question */}
        <div>
          <p className="text-sm font-medium text-[--color-text]">{card.question}</p>
        </div>

        {/* Hint */}
        {!revealed && (
          <div>
            {showHint ? (
              <p className="text-sm text-[--color-text-muted] italic">{card.hint}</p>
            ) : (
              <button
                onClick={() => setShowHint(true)}
                className="text-sm text-[--color-brand] font-medium min-h-touch flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
              >
                Show hint
              </button>
            )}
          </div>
        )}

        {/* Answer input */}
        {!revealed && (
          <form onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              aria-label="Your answer"
              placeholder="Type your answer..."
              rows={3}
              className={[
                'w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm',
                'bg-[--color-surface] text-[--color-text] placeholder:text-[--color-text-muted]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                'resize-none',
              ].join(' ')}
            />
            <button
              type="submit"
              className={[
                'mt-2 w-full min-h-touch rounded-[--radius-md] font-semibold text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white',
              ].join(' ')}
            >
              Reveal answer
            </button>
          </form>
        )}

        {/* Revealed section */}
        {revealed && (
          <div className="space-y-4">
            {/* User's answer */}
            {userAnswer.trim() && (
              <div className="rounded-[--radius-md] bg-[--color-surface-sunken] p-3">
                <p className="text-xs font-medium text-[--color-text-muted] mb-1">Your answer</p>
                <p className="text-sm text-[--color-text]">{userAnswer}</p>
              </div>
            )}

            {/* Correct answer */}
            <div className="rounded-[--radius-md] bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Correct answer</p>
              <p className="text-sm text-[--color-text]">{card.answer}</p>
            </div>

            {/* Explanation */}
            {card.explanation && (
              <div className="rounded-[--radius-md] bg-[--color-surface-raised] border border-[--color-border] p-3">
                <p className="text-xs font-medium text-[--color-text-muted] mb-1">Explanation</p>
                <div className="space-y-2">{renderMarkdown(card.explanation)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grade buttons (sticky footer) */}
      {revealed && (
        <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface]">
          <p className="text-xs text-[--color-text-muted] text-center mb-2">How did you do?</p>
          <div className="flex gap-2">
            {GRADES.map((grade) => (
              <button
                key={grade.id}
                onClick={() => onGrade(grade.id)}
                className={[
                  'flex-1 min-h-touch rounded-[--radius-md] font-semibold text-sm text-white transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                  grade.color,
                ].join(' ')}
              >
                {grade.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
