import { useEffect, useRef } from 'react';

const GRADE_INFO = {
  good: { label: 'Got it 👍', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  again: { label: 'Missed it 👎', color: 'text-red-600', bg: 'bg-red-50' },
};

export default function SummaryScreen({ results, total, onRestart, onKeepGoing }) {
  const headingRef = useRef(null);

  const counts = { good: 0, again: 0 };
  for (const r of results) {
    counts[r.grade]++;
  }

  useEffect(() => {
    headingRef.current?.focus();
  }, [results.length, total]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[--color-text] outline-none" aria-label={`Session complete. ${results.length} of ${total} cards reviewed.`}>Session complete</h2>
          <p className="text-sm text-[--color-text-muted] mt-1">
            {results.length} of {total} cards reviewed
          </p>
        </div>

        {/* Grade breakdown */}
        <div className="space-y-2">
          {Object.entries(GRADE_INFO).map(([id, info]) => {
            const count = counts[id];
            const reviewed = results.length;
            const pct = reviewed > 0 ? Math.round((count / reviewed) * 100) : 0;
            return (
              <div key={id} className={`flex items-center justify-between rounded-[--radius-md] px-4 ${info.bg}`} style={{ minHeight: 'var(--spacing-touch)' }}>
                <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
                <span className={`text-sm font-semibold ${info.color}`}>{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface] space-y-2">
        <button
          onClick={onKeepGoing}
          className={[
            'w-full min-h-touch rounded-[--radius-md] font-semibold text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white',
          ].join(' ')}
        >
          Keep Going
        </button>
        <button
          onClick={onRestart}
          className={[
            'w-full min-h-touch rounded-[--radius-md] font-semibold text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            'text-[--color-text-muted] hover:text-[--color-text]',
          ].join(' ')}
        >
          Done
        </button>
      </div>
    </div>
  );
}
