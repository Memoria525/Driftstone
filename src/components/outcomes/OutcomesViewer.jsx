import { useState, useRef, useEffect } from 'react';
import { loadOutcomesTree } from '../../data/outcomesLoader.js';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import CardViewer from './CardViewer.jsx';

// ── Chevron ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ── Reading screen ────────────────────────────────────────────────────────────

function ReadingScreen({ file, breadcrumb, onBack, onStudy }) {
  const headingRef = useRef(null);
  const cardCount = file.cards?.length || 0;

  useEffect(() => {
    headingRef.current?.focus();
  }, [file.id]);

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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-[--color-text] outline-none"
        >
          {file.title}
        </h2>
        <p className="text-xs font-mono text-[--color-text-muted]">{file.name}</p>
        <div className="pt-2 space-y-2">{renderMarkdown(file.content)}</div>
      </div>

      {/* Study cards */}
      {cardCount > 0 && (
        <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface]">
          <button
            onClick={onStudy}
            className="w-full min-h-touch rounded-[--radius-md] font-semibold text-sm bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Study cards ({cardCount})
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tree ──────────────────────────────────────────────────────────────────────

export default function OutcomesViewer({ onReading }) {
  const tree = loadOutcomesTree();
  const headingRef = useRef(null);

  const [openModules, setOpenModules] = useState(() => new Set());
  const [openTopics, setOpenTopics] = useState(() => new Set());
  const [selected, setSelected] = useState(null); // { file, breadcrumb } | null
  const [studying, setStudying] = useState(false); // card viewer for `selected`

  useEffect(() => {
    onReading?.(selected !== null);
  }, [selected, onReading]);

  useEffect(() => {
    if (!selected) headingRef.current?.focus();
  }, [selected]);

  function toggle(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (selected && studying) {
    return (
      <CardViewer
        file={selected.file}
        breadcrumb={selected.breadcrumb}
        onBack={() => setStudying(false)}
      />
    );
  }

  if (selected) {
    return (
      <ReadingScreen
        file={selected.file}
        breadcrumb={selected.breadcrumb}
        onBack={() => setSelected(null)}
        onStudy={() => setStudying(true)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[--color-border] bg-[--color-surface]">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
          Anatomy Outcomes
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {tree.length === 0 && (
          <p className="text-sm text-[--color-text-muted] text-center py-8">No outcomes found.</p>
        )}

        {tree.map((mod) => {
          const mOpen = openModules.has(mod.id);
          return (
            <div key={mod.id} className="rounded-[--radius-md] border border-[--color-border] overflow-hidden">
              {/* Module row */}
              <button
                onClick={() => toggle(setOpenModules, mod.id)}
                aria-expanded={mOpen}
                className="w-full flex items-center justify-between gap-2 px-4 bg-[--color-surface-raised] text-left font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] focus-visible:ring-inset"
                style={{ minHeight: 'var(--spacing-touch)' }}
              >
                <span className="flex-1">{mod.name}</span>
                <ChevronIcon open={mOpen} />
              </button>

              {/* Topics */}
              {mOpen && (
                <div className="divide-y divide-[--color-border]">
                  {mod.topics.map((topic) => {
                    const tOpen = openTopics.has(topic.id);
                    return (
                      <div key={topic.id}>
                        <button
                          onClick={() => toggle(setOpenTopics, topic.id)}
                          aria-expanded={tOpen}
                          className="w-full flex items-center justify-between gap-2 pl-8 pr-4 bg-[--color-surface] text-left text-sm font-medium text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] focus-visible:ring-inset"
                          style={{ minHeight: 'var(--spacing-touch)' }}
                        >
                          <span className="flex-1">{topic.name}</span>
                          <ChevronIcon open={tOpen} />
                        </button>

                        {/* Files */}
                        {tOpen && (
                          <div className="bg-[--color-surface-sunken] divide-y divide-[--color-border]">
                            {topic.files.map((file) => (
                              <button
                                key={file.id}
                                onClick={() => {
                                  setStudying(false);
                                  setSelected({
                                    file,
                                    breadcrumb: `${mod.name} › ${topic.name}`,
                                  });
                                }}
                                className="w-full flex items-center gap-2 pl-12 pr-4 py-2 text-left hover:bg-[--color-surface-raised] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] focus-visible:ring-inset"
                                style={{ minHeight: 'var(--spacing-touch)' }}
                              >
                                <span className="flex-1 text-sm text-[--color-text]">{file.title}</span>
                                <span className="text-[10px] font-mono text-[--color-text-muted] shrink-0">{file.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
