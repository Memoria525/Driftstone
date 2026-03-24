import { useState, useEffect, useRef } from 'react';
import { loadCourses } from '../../data/courseLoader.js';
import useCardNotes from '../../hooks/useCardNotes.js';
import useErrorLog from '../../hooks/useErrorLog.js';

const QUICK_TAGS = [
  'Bad hint',
  'Bad explanation',
  'Unclear question',
  'Wrong answer',
  'Duplicate card',
  'Needs image',
];

function CardNote({ card, note, onSave, onDelete }) {
  const [tags, setTags] = useState(note?.tags || []);
  const [freeText, setFreeText] = useState(note?.freeText || '');
  const [dirty, setDirty] = useState(false);

  function toggleTag(tag) {
    setTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      setDirty(true);
      return next;
    });
  }

  function handleSave() {
    onSave(card.id, tags, freeText);
    setDirty(false);
  }

  function handleClear() {
    setTags([]);
    setFreeText('');
    setDirty(false);
    onDelete(card.id);
  }

  const hasNote = tags.length > 0 || freeText.trim().length > 0;

  return (
    <div className="border border-[--color-border] rounded-[--radius-md] overflow-hidden">
      {/* Card content */}
      <div className="px-4 py-3 bg-[--color-surface-raised] space-y-2">
        <p className="text-xs text-[--color-text-muted] truncate">
          {card.courseName} &rsaquo; {card.chapterName} &rsaquo; {card.sectionName}
        </p>
        <p className="text-sm font-medium text-[--color-text]">{card.question}</p>
        <p className="text-sm text-[--color-text]">{card.answer}</p>
        {card.hint && (
          <p className="text-xs text-[--color-text-muted] italic">Hint: {card.hint}</p>
        )}
      </div>

      {/* Note editor */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={tags.includes(tag)}
              className={[
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                tags.includes(tag)
                  ? 'bg-[--color-brand] text-white'
                  : 'bg-[--color-surface-sunken] text-[--color-text-muted]',
              ].join(' ')}
            >
              {tag}
            </button>
          ))}
        </div>
        <textarea
          value={freeText}
          onChange={(e) => { setFreeText(e.target.value); setDirty(true); }}
          placeholder="Additional notes..."
          rows={2}
          className={[
            'w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm',
            'bg-[--color-surface] text-[--color-text] placeholder:text-[--color-text-muted]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            'resize-none',
          ].join(' ')}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!dirty && !!note}
            className={[
              'flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              dirty || !note
                ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
                : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
            ].join(' ')}
          >
            Save
          </button>
          {hasNote && (
            <button
              onClick={handleClear}
              className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorLog({ errors, clearAll }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[--color-border]">
      <button
        onClick={() => setOpen(!open)}
        className={[
          'w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          errors.length > 0 ? 'text-red-600' : 'text-[--color-text]',
        ].join(' ')}
        aria-expanded={open}
      >
        <span>Write Errors {errors.length > 0 && `(${errors.length})`}</span>
        <span className="text-xs text-[--color-text-muted]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {errors.length === 0 ? (
            <p className="text-xs text-[--color-text-muted]">No errors logged.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[--color-text-muted] border-b border-[--color-border]">
                      <th className="pb-1 pr-3 font-medium">Time</th>
                      <th className="pb-1 pr-3 font-medium">User</th>
                      <th className="pb-1 pr-3 font-medium">Card</th>
                      <th className="pb-1 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map(err => (
                      <tr key={err.id} className="border-b border-[--color-border] last:border-0">
                        <td className="py-1.5 pr-3 text-[--color-text-muted] whitespace-nowrap">
                          {err.timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-1.5 pr-3 text-[--color-text] font-mono truncate max-w-[80px]">
                          {err.userId?.slice(0, 8)}…
                        </td>
                        <td className="py-1.5 pr-3 text-[--color-text] font-mono truncate max-w-[80px]">
                          {err.cardId?.slice(0, 8)}…
                        </td>
                        <td className="py-1.5 text-red-600 break-words">
                          {err.errorMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={clearAll}
                className="min-h-touch px-4 rounded-[--radius-md] text-xs text-red-600 hover:text-red-700 border border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              >
                Clear all errors
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTab({ user, isAdmin, onHideAdmin }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'noted' | 'unnoted'
  const { notesMap, loading: notesLoading, saveNote, deleteNote } = useCardNotes(user, isAdmin);
  const { errors, loading: errorsLoading, clearAll } = useErrorLog(user, isAdmin);
  const headingRef = useRef(null);

  useEffect(() => {
    loadCourses()
      .then(data => {
        setCourses(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load courses:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && !notesLoading && !errorsLoading) {
      headingRef.current?.focus();
    }
  }, [loading, notesLoading, errorsLoading]);

  if (loading || notesLoading || errorsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[--color-text-muted]" role="status">Loading cards...</p>
      </div>
    );
  }

  // Build flat card list with enrichment
  const allCards = courses.flatMap(course =>
    course.chapters.flatMap(chapter =>
      chapter.sections.flatMap(section =>
        section.cards.map(card => ({
          ...card,
          courseName: course.name,
          chapterName: chapter.name,
          sectionName: section.name,
        }))
      )
    )
  );

  // Filter
  let filtered = allCards;
  if (filter === 'noted') {
    filtered = filtered.filter(c => notesMap.has(c.id));
  } else if (filter === 'unnoted') {
    filtered = filtered.filter(c => !notesMap.has(c.id));
  }

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c =>
      c.question.toLowerCase().includes(q) ||
      c.answer.toLowerCase().includes(q) ||
      c.sectionName.toLowerCase().includes(q) ||
      c.chapterName.toLowerCase().includes(q)
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Error log */}
      <ErrorLog errors={errors} clearAll={clearAll} />

      {/* Header */}
      <div className="px-4 py-3 space-y-2 border-b border-[--color-border] bg-[--color-surface]">
        <div className="flex items-center justify-between">
          <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
            Card Review ({notesMap.size} noted)
          </h2>
          <button
            onClick={onHideAdmin}
            className="text-xs text-[--color-text-muted] hover:text-[--color-text] px-2 py-1 rounded-[--radius-sm] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Hide admin
          </button>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          aria-label="Search cards"
          className={[
            'w-full min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm',
            'bg-[--color-surface] text-[--color-text] placeholder:text-[--color-text-muted]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          ].join(' ')}
        />
        <div role="group" aria-label="Filter cards" className="flex gap-2">
          {[
            { id: 'all', label: `All (${allCards.length})` },
            { id: 'noted', label: `Noted (${notesMap.size})` },
            { id: 'unnoted', label: `Unnoted` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={[
                'flex-1 min-h-touch rounded-[--radius-md] text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                filter === f.id
                  ? 'bg-[--color-surface-sunken] text-[--color-text] border-2 border-[--color-brand]'
                  : 'bg-[--color-surface-sunken] text-[--color-text-muted] border border-[--color-border]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <p className="text-xs text-[--color-text-muted]">{filtered.length} cards</p>
        {filtered.slice(0, 50).map(card => (
          <CardNote
            key={card.id}
            card={card}
            note={notesMap.get(card.id)}
            onSave={saveNote}
            onDelete={deleteNote}
          />
        ))}
        {filtered.length > 50 && (
          <p className="text-xs text-[--color-text-muted] text-center py-4">
            Showing first 50 of {filtered.length} cards. Use search to narrow results.
          </p>
        )}
        {filtered.length === 0 && (
          <p className="text-sm text-[--color-text-muted] text-center py-8">
            No cards match your search.
          </p>
        )}
      </div>
    </div>
  );
}
