import { useState, useRef, useEffect } from 'react';
import renderMarkdown from '../../utils/renderMarkdown.jsx';

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
  const questionRef = useRef(null);
  const answerRef = useRef(null);

  // Reset state and focus question when card changes
  useEffect(() => {
    setUserAnswer('');
    setShowHint(false);
    setRevealed(false);
    questionRef.current?.focus();
  }, [card.id]);

  function handleSubmit(e) {
    e.preventDefault();
    setRevealed(true);
    // Focus answer after React renders the revealed section
    requestAnimationFrame(() => answerRef.current?.focus());
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between text-xs text-[--color-text-muted]">
          <span>Card {index + 1} of {total}</span>
          <button
            onClick={onDone}
            className="text-xs font-medium text-[--color-text-muted] hover:text-[--color-text] min-h-touch flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
          >
            Done
          </button>
        </div>
        {card.sectionName && (
          <p className="text-xs text-[--color-text-muted] truncate">
            {card.courseName} › {card.chapterName} › {card.sectionName}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Question */}
        <div>
          <p ref={questionRef} tabIndex={-1} className="text-sm font-medium text-[--color-text] outline-none" aria-label={`Card ${index + 1} of ${total}. ${card.question}`}>{card.question}</p>
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
              <p ref={answerRef} tabIndex={-1} className="text-sm text-[--color-text] outline-none" aria-label={`Correct answer. ${card.answer}`}>{card.answer}</p>
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
