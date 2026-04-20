import { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, addDoc, writeBatch, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { loadAllCoursesAdmin, getCardsBySectionIds, shuffle, invalidateCache } from '../../data/courseLoader.js';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import useErrorLog from '../../hooks/useErrorLog.js';
import useReviewedCards from '../../hooks/useReviewedCards.js';
import useInspirations from '../../hooks/useInspirations.js';

const ISSUE_TAGS = [
  'Question',
  'Answer',
  'Explanation',
];

// ── Accordion wrapper ────────────────────────────────────────────────────────

function AccordionSection({ title, badge, open, onToggle, children }) {
  return (
    <div className="border-b border-[--color-border]">
      <button
        onClick={onToggle}
        className={[
          'w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          badge > 0 ? 'text-red-600' : 'text-[--color-text]',
        ].join(' ')}
        aria-expanded={open}
      >
        <span>{title}{badge > 0 ? ` (${badge})` : ''}</span>
        <span className="text-xs text-[--color-text-muted]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Error Log section ────────────────────────────────────────────────────────

function ErrorLogContent({ errors, clearAll }) {
  if (errors.length === 0) {
    return <p className="text-xs text-[--color-text-muted]">No errors logged.</p>;
  }
  return (
    <div className="space-y-2">
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
                <td className="py-1.5 text-red-600 break-words">{err.errorMessage}</td>
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
    </div>
  );
}

// ── Simplified topic picker for admin ────────────────────────────────────────

function AdminTopicPicker({ courses, onStart, reviewedMap }) {
  const [selected, setSelected] = useState(() => new Set());
  const [openCourses, setOpenCourses] = useState(() => new Set());
  const [openChapters, setOpenChapters] = useState(() => new Set());

  function toggleSet(setter, id) {
    setter(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSections(ids, allSelected) {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function sectionReviewStats(section) {
    const total = section.cards.length;
    let reviewed = 0;
    for (const card of section.cards) {
      if (reviewedMap.has(card.id)) reviewed++;
    }
    return { total, reviewed };
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[--color-text-muted]">Select sections to review cards</p>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {courses.map(course => {
          const cIds = course.chapters.flatMap(ch => ch.sections.map(s => s.id));
          const cAllSelected = cIds.every(id => selected.has(id));
          const cOpen = openCourses.has(course.id);
          return (
            <div key={course.id} className="rounded-[--radius-sm] border border-[--color-border] overflow-hidden">
              <div className="flex items-center gap-2 px-3 bg-[--color-surface-raised]" style={{ minHeight: 'var(--spacing-touch)' }}>
                <input
                  type="checkbox"
                  checked={cAllSelected}
                  aria-label={`Select all in ${course.name}`}
                  onChange={() => toggleSections(cIds, cAllSelected)}
                  className="w-4 h-4 shrink-0 accent-[--color-brand]"
                />
                <button
                  onClick={() => toggleSet(setOpenCourses, course.id)}
                  aria-expanded={cOpen}
                  className="flex-1 flex items-center justify-between text-xs font-semibold py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                >
                  {course.name}
                  <span className="text-[--color-text-muted]">{cOpen ? '▲' : '▼'}</span>
                </button>
              </div>
              {cOpen && course.chapters.map(chapter => {
                const chIds = chapter.sections.map(s => s.id);
                const chAllSelected = chIds.every(id => selected.has(id));
                const chOpen = openChapters.has(chapter.id);
                return (
                  <div key={chapter.id} className="border-t border-[--color-border]">
                    <div className="flex items-center gap-2 pl-6 pr-3 bg-[--color-surface]" style={{ minHeight: 'var(--spacing-touch)' }}>
                      <input
                        type="checkbox"
                        checked={chAllSelected}
                        aria-label={`Select all in ${chapter.name}`}
                        onChange={() => toggleSections(chIds, chAllSelected)}
                        className="w-4 h-4 shrink-0 accent-[--color-brand]"
                      />
                      <button
                        onClick={() => toggleSet(setOpenChapters, chapter.id)}
                        aria-expanded={chOpen}
                        className="flex-1 flex items-center justify-between text-xs font-medium py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                      >
                        {chapter.name}
                        <span className="text-[--color-text-muted]">{chOpen ? '▲' : '▼'}</span>
                      </button>
                    </div>
                    {chOpen && (
                      <div className="bg-[--color-surface-sunken]">
                        {chapter.sections.map(section => {
                          const sSelected = selected.has(section.id);
                          const { total, reviewed } = sectionReviewStats(section);
                          return (
                            <div
                              key={section.id}
                              className="flex items-center gap-2 pl-10 pr-3 border-t border-[--color-border]"
                              style={{ minHeight: 'var(--spacing-touch)' }}
                            >
                              <input
                                type="checkbox"
                                checked={sSelected}
                                aria-label={section.name}
                                onChange={() => {
                                  setSelected(prev => {
                                    const next = new Set(prev);
                                    sSelected ? next.delete(section.id) : next.add(section.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 shrink-0 accent-[--color-brand]"
                              />
                              <span className="flex-1 text-xs text-[--color-text]">{section.name}</span>
                              <span className="text-[10px] text-[--color-text-muted]">{reviewed}/{total}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onStart(selected, courses)}
        disabled={selected.size === 0}
        className={[
          'w-full min-h-touch rounded-[--radius-md] text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          selected.size > 0
            ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
            : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
        ].join(' ')}
      >
        {selected.size === 0 ? 'Select sections' : `Review ${selected.size} section${selected.size === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

// ── Issue picker popup ───────────────────────────────────────────────────────

function IssuePicker({ onConfirm, onCancel }) {
  const [selectedTags, setSelectedTags] = useState([]);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg bg-[--color-surface] rounded-t-2xl p-4 space-y-3">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
          What issues?
        </h3>
        <div className="flex flex-wrap gap-2">
          {ISSUE_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={selectedTags.includes(tag)}
              className={[
                'px-3 py-2 rounded-full text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                selectedTags.includes(tag)
                  ? 'bg-[--color-brand] text-white'
                  : 'bg-[--color-surface-sunken] text-[--color-text-muted]',
              ].join(' ')}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(selectedTags)}
            disabled={selectedTags.length === 0}
            className={[
              'flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              selectedTags.length > 0
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
            ].join(' ')}
          >
            Flag {selectedTags.length > 0 ? `(${selectedTags.length})` : ''}
          </button>
          <button
            onClick={onCancel}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inspiration modal ────────────────────────────────────────────────────────

function InspirationModal({ defaultText, onSave, onCancel }) {
  const [text, setText] = useState(defaultText);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg bg-[--color-surface] rounded-t-2xl p-4 space-y-3">
        <h3 tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
          Capture inspiration
        </h3>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          aria-label="Inspiration notes"
          className="w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onSave(text)}
            disabled={text.trim() === defaultText.trim()}
            className={[
              'flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              text.trim() !== defaultText.trim()
                ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
                : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
            ].join(' ')}
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card review viewer ───────────────────────────────────────────────────────

function CardReviewViewer({ card, index, total, onAccept, onIssues, onEditSave, onInspiration }) {
  const [showIssues, setShowIssues] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    question: card.question,
    answer: card.answer,
    explanation: card.explanation,
    replaceArray: '',
  });
  const [replaceError, setReplaceError] = useState('');
  const questionRef = useRef(null);

  useEffect(() => {
    questionRef.current?.focus();
  }, [card.id]);

  function handleEditSave() {
    let fields = editFields;
    if (editFields.replaceArray.trim()) {
      try {
        const parsed = JSON.parse(editFields.replaceArray);
        if (!Array.isArray(parsed) || parsed.length < 2) {
          setReplaceError('Expected an array with at least [question, answer]');
          return;
        }
        fields = {
          question: String(parsed[0] || ''),
          answer: String(parsed[1] || ''),
          explanation: String(parsed[2] || ''),
        };
      } catch {
        setReplaceError('Invalid JSON');
        return;
      }
    }
    const { replaceArray: _, ...saveFields } = fields;
    onEditSave(card.id, saveFields);
    setEditing(false);
    setReplaceError('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-[--color-border] bg-[--color-surface]">
        <div className="flex items-center justify-between text-xs text-[--color-text-muted]">
          <span>{card.courseName} &rsaquo; {card.chapterName} &rsaquo; {card.sectionName}</span>
          <span>{index + 1} / {total}</span>
        </div>
      </div>

      {/* Card content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {editing ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-[--color-text-muted]">Question</span>
              <textarea
                value={editFields.question}
                onChange={e => setEditFields(f => ({ ...f, question: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[--color-text-muted]">Answer</span>
              <textarea
                value={editFields.answer}
                onChange={e => setEditFields(f => ({ ...f, answer: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[--color-text-muted]">Explanation</span>
              <textarea
                value={editFields.explanation}
                onChange={e => setEditFields(f => ({ ...f, explanation: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[--color-text-muted]">Replace with array</span>
              <textarea
                value={editFields.replaceArray}
                onChange={e => { setEditFields(f => ({ ...f, replaceArray: e.target.value })); setReplaceError(''); }}
                rows={3}
                placeholder='["question", "answer", "explanation"]'
                className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] font-mono"
              />
              {replaceError && <p className="text-xs text-red-500 mt-1">{replaceError}</p>}
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleEditSave}
                className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setReplaceError(''); setEditFields({ question: card.question, answer: card.answer, explanation: card.explanation, replaceArray: '' }); }}
                className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-[--color-text-muted] mb-1">Question</p>
              <p ref={questionRef} tabIndex={-1} className="text-sm text-[--color-text] outline-none">{card.question}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[--color-text-muted] mb-1">Answer</p>
              <p className="text-sm text-[--color-text]">{card.answer}</p>
            </div>
            {card.explanation && (
              <div>
                <p className="text-xs font-medium text-[--color-text-muted] mb-1">Explanation</p>
                <div className="space-y-1">{renderMarkdown(card.explanation)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      {!editing && (
        <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface] space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Accept
            </button>
            <button
              onClick={() => setShowIssues(true)}
              className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-red-500 hover:bg-red-600 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Issues
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(m => !m)}
              aria-label="More actions"
              aria-expanded={showMenu}
              className="w-full min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              More ▾
            </button>
            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-[--radius-md] border border-[--color-border] bg-[--color-surface-raised] shadow-lg overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); setEditing(true); }}
                  className="w-full min-h-touch px-4 text-left text-sm text-[--color-text] hover:bg-[--color-surface-sunken] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-focus]"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    const json = JSON.stringify([card.question, card.answer, card.explanation]);
                    try {
                      await navigator.clipboard.writeText(json);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                    setShowMenu(false);
                  }}
                  className="w-full min-h-touch px-4 text-left text-sm text-[--color-text] hover:bg-[--color-surface-sunken] border-t border-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-focus]"
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowInspiration(true); }}
                  className="w-full min-h-touch px-4 text-left text-sm text-[--color-text] hover:bg-[--color-surface-sunken] border-t border-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-focus]"
                >
                  Inspiration
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showIssues && (
        <IssuePicker
          onConfirm={(tags) => { setShowIssues(false); onIssues(tags); }}
          onCancel={() => setShowIssues(false)}
        />
      )}

      {showInspiration && (
        <InspirationModal
          defaultText={`Course: ${card.courseName}\nChapter: ${card.chapterName}\nSection: ${card.sectionName}\nIdea: `}
          onSave={(text) => { setShowInspiration(false); onInspiration(text); }}
          onCancel={() => setShowInspiration(false)}
        />
      )}
    </div>
  );
}

// ── Review summary ───────────────────────────────────────────────────────────

function ReviewSummary({ results, onDone }) {
  const accepted = results.filter(r => r.status === 'accepted').length;
  const flagged = results.filter(r => r.status === 'issues').length;
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 space-y-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[--color-text] outline-none">
        Review complete
      </h2>
      <div className="text-sm text-[--color-text] space-y-1 text-center">
        <p>{results.length} cards reviewed</p>
        <p className="text-emerald-600">{accepted} accepted</p>
        {flagged > 0 && <p className="text-red-600">{flagged} flagged</p>}
      </div>
      <button
        onClick={onDone}
        className="min-h-touch px-8 rounded-[--radius-md] text-sm font-semibold bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
      >
        Done
      </button>
    </div>
  );
}

// ── Reviewed Cards browser ───────────────────────────────────────────────────

function ReviewedCardsContent({ courses, reviewedMap, onEditSave }) {
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editing, setEditing] = useState(null); // cardId being edited
  const [editFields, setEditFields] = useState({});

  // Build flat list of reviewed cards
  const allCards = courses.flatMap(course =>
    course.chapters.flatMap(chapter =>
      chapter.sections.flatMap(section =>
        section.cards
          .filter(card => reviewedMap.has(card.id))
          .map(card => ({
            ...card,
            courseName: course.name,
            chapterName: chapter.name,
            sectionName: section.name,
            review: reviewedMap.get(card.id),
          }))
      )
    )
  );

  const filtered = filter === 'all'
    ? allCards
    : allCards.filter(c => c.review.status === filter);

  function startEdit(card) {
    setEditing(card.id);
    setEditFields({
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
    });
  }

  function handleSavePublish(cardId) {
    onEditSave(cardId, editFields, { publish: true });
    setEditing(null);
  }

  if (allCards.length === 0) {
    return <p className="text-xs text-[--color-text-muted]">No reviewed cards yet.</p>;
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Filter reviewed cards" className="flex gap-2">
        {[
          { id: 'all', label: `All (${allCards.length})` },
          { id: 'accepted', label: `Accepted (${allCards.filter(c => c.review.status === 'accepted').length})` },
          { id: 'issues', label: `Issues (${allCards.filter(c => c.review.status === 'issues').length})` },
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

      <div className="max-h-80 overflow-y-auto space-y-1">
        {filtered.map(card => (
          <div key={card.id} className="border border-[--color-border] rounded-[--radius-sm] overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === card.id ? null : card.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              aria-expanded={expandedId === card.id}
            >
              <span className="flex-1 truncate text-[--color-text]">{card.question}</span>
              <span className={[
                'ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium',
                card.review.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
              ].join(' ')}>
                {card.review.status === 'accepted' ? '✓' : '✗'}
              </span>
            </button>
            {expandedId === card.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-[--color-border]">
                <p className="text-[10px] text-[--color-text-muted] pt-1">
                  {card.courseName} &rsaquo; {card.chapterName} &rsaquo; {card.sectionName}
                </p>
                {editing === card.id ? (
                  <div className="space-y-2">
                    {['question', 'answer', 'explanation'].map(field => (
                      <label key={field} className="block">
                        <span className="text-[10px] font-medium text-[--color-text-muted] capitalize">{field}</span>
                        <textarea
                          value={editFields[field]}
                          onChange={e => setEditFields(f => ({ ...f, [field]: e.target.value }))}
                          rows={2}
                          className="mt-0.5 w-full rounded-[--radius-sm] border border-[--color-border] px-2 py-1 text-xs bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                        />
                      </label>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditing(null)}
                        className="min-h-touch px-3 rounded-[--radius-md] text-xs text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSavePublish(card.id)}
                        className="flex-1 min-h-touch rounded-[--radius-md] text-xs font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                      >
                        Save &amp; Publish
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-xs">
                      <p><strong className="text-[--color-text-muted]">Q:</strong> <span className="text-[--color-text]">{card.question}</span></p>
                      <p><strong className="text-[--color-text-muted]">A:</strong> <span className="text-[--color-text]">{card.answer}</span></p>
                      {card.explanation && <div><strong className="text-[--color-text-muted] text-xs">Exp:</strong> <div className="space-y-1 mt-0.5">{renderMarkdown(card.explanation)}</div></div>}
                    </div>
                    {card.review.issues?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.review.issues.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">{tag}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => startEdit(card)}
                      className="min-h-touch px-3 rounded-[--radius-md] text-xs font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Course Settings ──────────────────────────────────────────────────────────

function CourseSettings({ courses, onToggle, onError }) {
  const [privates, setPrivates] = useState(() => {
    const set = new Set();
    for (const c of courses) {
      if (c.isPrivate) set.add(c.id);
    }
    return set;
  });

  async function toggle(course) {
    const newPrivate = !privates.has(course.id);
    setPrivates(prev => {
      const next = new Set(prev);
      newPrivate ? next.add(course.id) : next.delete(course.id);
      return next;
    });
    try {
      await setDoc(doc(db, 'courses', course.id), {
        name: course.name,
        number: course.number,
        isPrivate: newPrivate,
      });
      invalidateCache();
      onToggle?.();
    } catch (err) {
      console.error('Failed to update course privacy:', err);
      onError?.('Failed to update course privacy');
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-[--color-text-muted] mb-2">Private courses are only visible to admins in the study tab.</p>
      {courses.map(course => (
        <div key={course.id} className="flex items-center justify-between py-2">
          <span className="text-sm text-[--color-text]">{course.name}</span>
          <button
            onClick={() => toggle(course)}
            className={[
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              privates.has(course.id)
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700',
            ].join(' ')}
          >
            {privates.has(course.id) ? 'Private' : 'Public'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Location Picker (shared by QuickCardAdder and BatchUpload) ──────────────

function LocationPicker({ courses, onConfirm, onBack, confirmLabel, saving }) {
  const [courseId, setCourseId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [newChapter, setNewChapter] = useState('');
  const [newSection, setNewSection] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [addingChapter, setAddingChapter] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [coursePosition, setCoursePosition] = useState('');
  const [chapterPosition, setChapterPosition] = useState('');
  const [sectionPosition, setSectionPosition] = useState('');

  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  const selectedCourse = courses.find(c => c.id === courseId);
  const chaptersRaw = selectedCourse?.chapters || [];
  const selectedChapter = chaptersRaw.find(ch => ch.id === chapterId);
  const sectionsRaw = selectedChapter?.sections || [];

  const canConfirm = (() => {
    const hasCourse = addingCourse ? newCourse.trim() : courseId;
    const hasChapter = addingChapter ? newChapter.trim() : chapterId;
    const hasSection = addingSection ? newSection.trim() : sectionId;
    return hasCourse && hasChapter && hasSection;
  })();

  async function shiftItems(collectionName, parentField, parentId, atPosition) {
    const q = parentField
      ? query(collection(db, collectionName), where(parentField, '==', parentId))
      : query(collection(db, collectionName));
    const snap = await getDocs(q);
    const updates = [];
    snap.forEach(d => {
      if (d.data().number >= atPosition) {
        updates.push(updateDoc(doc(db, collectionName, d.id), { number: d.data().number + 1 }));
      }
    });
    await Promise.all(updates);
  }

  async function handleConfirm() {
    let finalCourseId = courseId;
    let finalChapterId = chapterId;
    let finalSectionId = sectionId;

    if (addingCourse && newCourse.trim()) {
      const maxNum = courses.reduce((max, c) => Math.max(max, c.number), 0);
      const insertNum = coursePosition === '' ? maxNum + 1 : Number(coursePosition);
      if (insertNum <= maxNum) await shiftItems('courses', null, null, insertNum);
      const ref = await addDoc(collection(db, 'courses'), {
        name: newCourse.trim(),
        number: insertNum,
        isPrivate: true,
      });
      finalCourseId = ref.id;
    }

    if (addingChapter && newChapter.trim() && finalCourseId) {
      const maxNum = chaptersRaw.reduce((max, ch) => Math.max(max, ch.number), 0);
      const insertNum = chapterPosition === '' ? maxNum + 1 : Number(chapterPosition);
      if (insertNum <= maxNum) await shiftItems('chapters', 'courseId', finalCourseId, insertNum);
      const ref = await addDoc(collection(db, 'chapters'), {
        name: newChapter.trim(),
        number: insertNum,
        courseId: finalCourseId,
      });
      finalChapterId = ref.id;
    }

    if (addingSection && newSection.trim() && finalChapterId) {
      const maxNum = sectionsRaw.reduce((max, s) => Math.max(max, s.number), 0);
      const insertNum = sectionPosition === '' ? maxNum + 1 : Number(sectionPosition);
      if (insertNum <= maxNum) await shiftItems('sections', 'chapterId', finalChapterId, insertNum);
      const ref = await addDoc(collection(db, 'sections'), {
        name: newSection.trim(),
        number: insertNum,
        chapterId: finalChapterId,
      });
      finalSectionId = ref.id;
    }

    if (!finalCourseId || !finalChapterId || !finalSectionId) return;
    onConfirm({ courseId: finalCourseId, chapterId: finalChapterId, sectionId: finalSectionId });
  }

  return (
    <div className="space-y-3">
      <h3 ref={headingRef} tabIndex={-1} className="text-xs font-semibold text-[--color-text] outline-none">
        Choose location
      </h3>

      {/* Course picker */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-[--color-text-muted]">Course</span>
        {addingCourse ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCourse}
                onChange={e => setNewCourse(e.target.value)}
                placeholder="New course name"
                className="flex-1 rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                autoFocus
              />
              <button
                onClick={() => { setAddingCourse(false); setNewCourse(''); setCoursePosition(''); }}
                className="min-h-touch px-3 text-xs text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                aria-label="Cancel new course"
              >
                Cancel
              </button>
            </div>
            <select
              value={coursePosition}
              onChange={e => setCoursePosition(e.target.value)}
              className="w-full min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              aria-label="Insert course at position"
            >
              <option value="">End of list</option>
              {courses.map(c => (
                <option key={c.id} value={c.number}>Before {c.number}. {c.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={courseId}
              onChange={e => { setCourseId(e.target.value); setChapterId(''); setSectionId(''); setAddingChapter(false); setAddingSection(false); }}
              className="flex-1 min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              aria-label="Select course"
            >
              <option value="">Select course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => { setAddingCourse(true); setCourseId(''); setChapterId(''); setSectionId(''); }}
              className="min-h-touch px-3 rounded-[--radius-md] text-xs font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Add new
            </button>
          </div>
        )}
      </div>

      {/* Chapter picker */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-[--color-text-muted]">Chapter</span>
        {addingChapter ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newChapter}
                onChange={e => setNewChapter(e.target.value)}
                placeholder="New chapter name"
                className="flex-1 rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                autoFocus
              />
              <button
                onClick={() => { setAddingChapter(false); setNewChapter(''); setChapterPosition(''); }}
                className="min-h-touch px-3 text-xs text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                aria-label="Cancel new chapter"
              >
                Cancel
              </button>
            </div>
            {chaptersRaw.length > 0 && (
              <select
                value={chapterPosition}
                onChange={e => setChapterPosition(e.target.value)}
                className="w-full min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                aria-label="Insert chapter at position"
              >
                <option value="">End of list</option>
                {chaptersRaw.map(ch => (
                  <option key={ch.id} value={ch.number}>Before {ch.number}. {ch.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={chapterId}
              onChange={e => { setChapterId(e.target.value); setSectionId(''); setAddingSection(false); }}
              disabled={!courseId && !addingCourse}
              className="flex-1 min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] disabled:opacity-50"
              aria-label="Select chapter"
            >
              <option value="">Select chapter…</option>
              {chaptersRaw.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setAddingChapter(true); setChapterId(''); setSectionId(''); }}
              className="min-h-touch px-3 rounded-[--radius-md] text-xs font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Add new
            </button>
          </div>
        )}
      </div>

      {/* Section picker */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-[--color-text-muted]">Section</span>
        {addingSection ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSection}
                onChange={e => setNewSection(e.target.value)}
                placeholder="New section name"
                className="flex-1 rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                autoFocus
              />
              <button
                onClick={() => { setAddingSection(false); setNewSection(''); setSectionPosition(''); }}
                className="min-h-touch px-3 text-xs text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                aria-label="Cancel new section"
              >
                Cancel
              </button>
            </div>
            {sectionsRaw.length > 0 && (
              <select
                value={sectionPosition}
                onChange={e => setSectionPosition(e.target.value)}
                className="w-full min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                aria-label="Insert section at position"
              >
                <option value="">End of list</option>
                {sectionsRaw.map(s => (
                  <option key={s.id} value={s.number}>Before {s.number}. {s.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              disabled={!chapterId && !addingChapter}
              className="flex-1 min-h-touch rounded-[--radius-md] border border-[--color-border] px-3 text-sm bg-[--color-surface] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] disabled:opacity-50"
              aria-label="Select section"
            >
              <option value="">Select section…</option>
              {sectionsRaw.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={() => { setAddingSection(true); setSectionId(''); }}
              className="min-h-touch px-3 rounded-[--radius-md] text-xs font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Add new
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm || saving}
          className={[
            'flex-1 min-h-touch rounded-[--radius-md] text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            canConfirm && !saving
              ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
              : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
          ].join(' ')}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ── Inspirations ─────────────────────────────────────────────────────────────

function InspirationsContent({ inspirations, onSave, onCreate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const TBC_TEMPLATE = 'Course: TBC\nChapter: TBC\nSection: TBC\nIdea: ';

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowAdd(true)}
        className="w-full min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
      >
        Add inspiration
      </button>

      {inspirations.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">No inspirations saved.</p>
      )}

      <div className="max-h-80 overflow-y-auto space-y-2">
        {inspirations.map(insp => (
          <div key={insp.id} className="border border-[--color-border] rounded-[--radius-sm] overflow-hidden">
            <button
              onClick={() => setExpandedId(prev => prev === insp.id ? null : insp.id)}
              aria-expanded={expandedId === insp.id}
              className="w-full min-h-touch px-3 py-2 text-left text-sm text-[--color-text] hover:bg-[--color-surface-sunken] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-focus]"
            >
              <p className="truncate">{insp.text.split('\n').pop()}</p>
            </button>
            {expandedId === insp.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-[--color-border]">
                <p className="text-sm text-[--color-text] whitespace-pre-wrap pt-2">{insp.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onCreate(insp.id)}
                    className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <InspirationModal
          defaultText={TBC_TEMPLATE}
          onSave={(text) => { setShowAdd(false); onSave(text); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ── Quick Card Adder ────────────────────────────────────────────────────────

function QuickCardAdder({ courses, onSave }) {
  const [step, setStep] = useState('fields'); // 'fields' | 'location'
  const [fields, setFields] = useState({ question: '', answer: '', explanation: '' });
  const [saving, setSaving] = useState(false);

  async function handleLocationConfirm({ courseId, chapterId, sectionId }) {
    setSaving(true);
    try {
      await onSave({
        question: fields.question,
        answer: fields.answer,
        explanation: fields.explanation,
        courseId,
        chapterId,
        sectionId,
        cardType: 'sa',
        isPrivate: true,
      });
      setFields({ question: '', answer: '', explanation: '' });
      setStep('fields');
    } finally {
      setSaving(false);
    }
  }

  if (step === 'location') {
    return (
      <LocationPicker
        courses={courses}
        onConfirm={handleLocationConfirm}
        onBack={() => setStep('fields')}
        confirmLabel={saving ? 'Saving…' : 'Save card'}
        saving={saving}
      />
    );
  }

  return (
    <div className="space-y-3">
      {['question', 'answer', 'explanation'].map(field => (
        <label key={field} className="block">
          <span className="text-xs font-medium text-[--color-text-muted] capitalize">{field}</span>
          <textarea
            value={fields[field]}
            onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))}
            rows={field === 'explanation' ? 4 : 2}
            className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          />
        </label>
      ))}
      <button
        onClick={() => setStep('location')}
        className={[
          'w-full min-h-touch rounded-[--radius-md] text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white',
        ].join(' ')}
      >
        Next
      </button>
    </div>
  );
}

// ── Batch Upload ────────────────────────────────────────────────────────────

function parseCardJson(raw) {
  // Strip markdown code fences
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  // Strip trailing commas before ] or }
  text = text.replace(/,\s*([}\]])/g, '$1');

  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of cards');
  }

  return parsed.map((entry, i) => {
    if (!Array.isArray(entry)) {
      throw new Error(`Card ${i + 1} is not an array`);
    }
    if (entry.length < 2) {
      throw new Error(`Card ${i + 1} needs at least question and answer`);
    }
    return {
      question: String(entry[0] || ''),
      answer: String(entry[1] || ''),
      explanation: String(entry[2] || ''),
    };
  });
}

function BatchUpload({ courses, onBatchSave }) {
  const [step, setStep] = useState('paste'); // 'paste' | 'preview' | 'location'
  const [rawText, setRawText] = useState('');
  const [parsedCards, setParsedCards] = useState([]);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [publishNow, setPublishNow] = useState(false);

  const previewRef = useRef(null);

  useEffect(() => {
    if (step === 'preview') previewRef.current?.focus();
  }, [step]);

  function handleParse() {
    setParseError('');
    try {
      const cards = parseCardJson(rawText);
      if (cards.length === 0) {
        setParseError('No cards found in the JSON');
        return;
      }
      setParsedCards(cards);
      setStep('preview');
    } catch (err) {
      setParseError(err.message);
    }
  }

  async function handleLocationConfirm({ courseId, chapterId, sectionId }) {
    setUploading(true);
    try {
      const cardDocs = parsedCards.map(card => ({
        ...card,
        courseId,
        chapterId,
        sectionId,
        cardType: 'sa',
        isPrivate: !publishNow,
      }));
      await onBatchSave(cardDocs);
      setRawText('');
      setParsedCards([]);
      setStep('paste');
    } finally {
      setUploading(false);
    }
  }

  if (step === 'location') {
    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-3 cursor-pointer"
          style={{ minHeight: 'var(--spacing-touch)' }}
          onClick={() => setPublishNow(p => !p)}
        >
          <input
            type="checkbox"
            checked={publishNow}
            onChange={() => setPublishNow(p => !p)}
            onClick={e => e.stopPropagation()}
            aria-label="Publish cards immediately (skip review)"
            className="w-5 h-5 shrink-0 accent-[--color-brand] focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          />
          <span className="text-xs text-[--color-text]">Publish immediately (skip review)</span>
        </div>
        <LocationPicker
          courses={courses}
          onConfirm={handleLocationConfirm}
          onBack={() => setStep('preview')}
          confirmLabel={uploading ? 'Uploading…' : `Upload ${parsedCards.length} card${parsedCards.length === 1 ? '' : 's'}`}
          saving={uploading}
        />
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-3">
        <p ref={previewRef} tabIndex={-1} className="text-xs font-semibold text-[--color-text] outline-none" aria-live="polite">
          {parsedCards.length} card{parsedCards.length === 1 ? '' : 's'} ready
        </p>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {parsedCards.map((card, i) => (
            <div key={i} className="px-3 py-2 rounded-[--radius-sm] bg-[--color-surface-sunken] text-xs text-[--color-text] truncate">
              <span className="text-[--color-text-muted] mr-1">{i + 1}.</span>
              {card.question}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('paste')}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm text-[--color-text-muted] hover:text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Back
          </button>
          <button
            onClick={() => setStep('location')}
            className={[
              'flex-1 min-h-touch rounded-[--radius-md] text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white',
            ].join(' ')}
          >
            Choose destination
          </button>
        </div>
      </div>
    );
  }

  // Step: paste
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-[--color-text-muted]">Card JSON</span>
        <textarea
          value={rawText}
          onChange={e => { setRawText(e.target.value); setParseError(''); }}
          rows={8}
          placeholder='[["question", "answer", "explanation"], ...]'
          aria-label="Paste card JSON"
          className="mt-1 w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 text-sm font-mono bg-[--color-surface] text-[--color-text] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        />
      </label>
      {parseError && (
        <p className="text-xs text-red-600" role="alert">{parseError}</p>
      )}
      <button
        onClick={handleParse}
        disabled={!rawText.trim()}
        className={[
          'w-full min-h-touch rounded-[--radius-md] text-sm font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
          rawText.trim()
            ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
            : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
        ].join(' ')}
      >
        Parse Cards
      </button>
    </div>
  );
}

// ── Concept Upload ───────────────────────────────────────────────────────────

function stripCodeFence(s) {
  // Remove leading/trailing ```json ... ``` or ``` ... ``` fences if present
  const fence = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/;
  const match = s.match(fence);
  return match ? match[1] : s;
}

function lenientJsonToStrict(src) {
  // Convert a string that may have curly quotes (“ ”) used as JSON string
  // delimiters, and other common Claude typos, into strict JSON.
  //
  // Quote handling (ASCII or curly): a quote is treated as a structural
  // delimiter only when it sits at a position the grammar allows:
  //   - opener: current char is a quote and we are outside a string
  //   - closer: current char is a quote inside a string AND the next
  //             non-whitespace char is one of , } ] : or end of input
  // Any other quote inside a string is treated as content. Curly content
  // quotes pass through (valid inside JSON strings); ASCII content quotes
  // get escaped as \".
  //
  // Escape handling (inside strings): a backslash may be followed by a
  // valid JSON escape char (" \ / b f n r t) or \uXXXX. Two repairs:
  //   - Stray whitespace between \ and a valid escape letter is stripped
  //     ("\  n" → "\n") — common Claude typo.
  //   - Backslashes not followed by a valid escape sequence are treated
  //     as literal backslashes and escaped as \\.
  const QUOTE = (c) => c === '"' || c === '\u201C' || c === '\u201D';
  const STRUCTURAL_AFTER = /[,}\]:]/;
  const VALID_ESC = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
  let out = '';
  let i = 0;
  let inString = false;
  while (i < src.length) {
    const c = src[i];
    if (!inString) {
      if (QUOTE(c)) {
        out += '"';
        inString = true;
        i++;
      } else {
        out += c;
        i++;
      }
      continue;
    }
    // Inside a string
    if (c === '\\') {
      // Figure out what the escape target is, skipping any stray whitespace.
      let k = i + 1;
      let target = src[k];
      if (target !== undefined && /\s/.test(target)) {
        while (k < src.length && /\s/.test(src[k])) k++;
        // If the char after the whitespace isn't a valid escape, fall back
        // to treating the original next char (the whitespace) as-is.
        if (k >= src.length || !(VALID_ESC.has(src[k]) || src[k] === 'u')) {
          k = i + 1;
        }
        target = src[k];
      }
      if (VALID_ESC.has(target)) {
        out += '\\' + target;
        i = k + 1;
      } else if (target === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(k + 1, k + 5))) {
        out += '\\u' + src.slice(k + 1, k + 5);
        i = k + 5;
      } else {
        // Not a valid escape — treat the backslash as a literal character.
        out += '\\\\';
        i += 1;
      }
      continue;
    }
    if (QUOTE(c)) {
      // Peek at the next non-whitespace char to decide if this is a closer
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (j >= src.length || STRUCTURAL_AFTER.test(src[j])) {
        out += '"';
        inString = false;
        i++;
      } else {
        if (c === '"') out += '\\"';
        else out += c;
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function posToLineCol(s, pos) {
  let line = 1, col = 1;
  for (let i = 0; i < pos && i < s.length; i++) {
    if (s[i] === '\n') { line++; col = 1; } else col++;
  }
  return { line, col };
}

function findFirstInvalidEscape(s) {
  const VALID = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') {
        const next = s[i + 1];
        if (!VALID.has(next)) return i;
        if (next === 'u') {
          const hex = s.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return i;
          i += 5;
        } else {
          i += 1;
        }
      } else if (c === '"') {
        inString = false;
      }
    } else if (c === '"') {
      inString = true;
    }
  }
  return -1;
}

function jsonErrorDetail(source, err) {
  const msg = String(err.message || err);
  // Try to extract a position from the error (V8 style: "at position N")
  const posMatch = msg.match(/position (\d+)/i);
  let pos = posMatch ? parseInt(posMatch[1], 10) : -1;

  // WebKit (Safari) doesn't include a position. For "Invalid escape character"
  // we can locate the first offender ourselves.
  if (pos < 0 && /invalid escape/i.test(msg)) {
    pos = findFirstInvalidEscape(source);
  }

  if (pos < 0) return msg;

  const { line, col } = posToLineCol(source, pos);
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
  const lineEnd = source.indexOf('\n', pos);
  const lineText = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
  const snippet = lineText.length > 120
    ? '…' + lineText.slice(Math.max(0, col - 40), col + 40) + '…'
    : lineText;
  return `${msg} (line ${line}, column ${col})\n${snippet}`;
}

function parseConceptJson(raw) {
  const stripped = stripCodeFence(raw.trim());
  if (!stripped) throw new Error('Paste the Yellow output JSON');
  let data;
  try {
    data = JSON.parse(stripped);
  } catch (err1) {
    // Retry after converting curly quotes to strict JSON
    const relaxed = lenientJsonToStrict(stripped);
    try {
      data = JSON.parse(relaxed);
    } catch (err2) {
      // Report the error against whichever source is most informative.
      // If the original had smart quotes, err2 is against the cleaned input.
      const hadSmart = /[\u201C\u201D]/.test(stripped);
      const detail = hadSmart
        ? jsonErrorDetail(relaxed, err2)
        : jsonErrorDetail(stripped, err1);
      throw new Error('Invalid JSON: ' + detail);
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected a JSON object keyed by concept ID');
  }
  const ids = Object.keys(data);
  if (ids.length === 0) throw new Error('No concepts found in the JSON');
  const idPattern = /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/;
  for (const id of ids) {
    if (!idPattern.test(id)) {
      throw new Error(`Invalid concept ID "${id}" — expected format XX.XX.XX.XX`);
    }
    const entry = data[id];
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Concept ${id} is not an object`);
    }
    if (typeof entry.Concept !== 'string' || !entry.Concept.trim()) {
      throw new Error(`Concept ${id} is missing a "Concept" name`);
    }
    if (typeof entry.text !== 'string' || !entry.text.trim()) {
      throw new Error(`Concept ${id} is missing "text"`);
    }
  }
  return data;
}

function ConceptUpload({ onUpload }) {
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);

  function handleParse() {
    setParseError('');
    try {
      setParsed(parseConceptJson(rawText));
    } catch (err) {
      setParsed(null);
      setParseError(err.message);
    }
  }

  async function handleUpload() {
    if (!parsed) return;
    setUploading(true);
    try {
      await onUpload(parsed);
      setRawText('');
      setParsed(null);
    } finally {
      setUploading(false);
    }
  }

  const ids = parsed ? Object.keys(parsed) : [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-[--color-text-muted]">
        Paste the JSON output from Yellow. Each concept is keyed by its full ID (e.g., <code>01.01.04.03</code>) and gets written to the <code>concepts</code> collection.
      </p>

      <label htmlFor="concept-upload-textarea" className="sr-only">Concept JSON</label>
      <textarea
        id="concept-upload-textarea"
        value={rawText}
        onChange={e => { setRawText(e.target.value); setParsed(null); setParseError(''); }}
        rows={10}
        placeholder='{"01.01.04.01": {"Concept": "...", "text": "..."}}'
        className="w-full p-2 text-xs font-mono rounded-[--radius-md] bg-[--color-surface-sunken] border border-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
      />

      {parseError && (
        <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono" role="alert">{parseError}</pre>
      )}

      {parsed && (
        <div className="text-xs text-[--color-text] bg-[--color-surface-sunken] rounded-[--radius-md] p-2 border border-[--color-border]">
          <p className="font-medium mb-1">Parsed {ids.length} concept{ids.length === 1 ? '' : 's'}:</p>
          <ul className="space-y-0.5 text-[--color-text-muted]">
            {ids.map(id => (
              <li key={id}><span className="font-mono">{id}</span> — {parsed[id].Concept}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {!parsed ? (
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm font-medium bg-[--color-brand] text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Parse
          </button>
        ) : (
          <>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="min-h-touch px-4 rounded-[--radius-md] text-sm font-medium bg-[--color-brand] text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              {uploading ? 'Uploading…' : `Upload ${ids.length} concept${ids.length === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={() => { setParsed(null); setParseError(''); }}
              disabled={uploading}
              className="min-h-touch px-4 rounded-[--radius-md] text-sm border border-[--color-border] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
            >
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Concept View/Edit ───────────────────────────────────────────────────────

function compareConceptIds(a, b) {
  const as = a.split('.').map(n => parseInt(n, 10));
  const bs = b.split('.').map(n => parseInt(n, 10));
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const av = Number.isFinite(as[i]) ? as[i] : 0;
    const bv = Number.isFinite(bs[i]) ? bs[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Validate that a new concept text string will render correctly for users.
// Returns null on success, or an error string on failure.
function validateConceptText(text) {
  if (typeof text !== 'string') return 'Text must be a string.';
  const trimmed = text.trim();
  if (!trimmed) return 'Text is empty.';
  // JSON round-trip catches lone surrogates and other unserializable characters.
  try {
    const roundTripped = JSON.parse(JSON.stringify({ text }));
    if (roundTripped.text !== text) return 'Text did not survive JSON round-trip.';
  } catch (err) {
    return `Text cannot be serialized as JSON: ${err.message}`;
  }
  // Balanced **bold** markers.
  const boldCount = (text.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) {
    return 'Unbalanced **bold** markers — one is missing its pair.';
  }
  // Actually render through the markdown renderer.
  try {
    const out = renderMarkdown(text);
    if (!out || (Array.isArray(out) && out.length === 0)) {
      return 'Text did not render to any visible content.';
    }
  } catch (err) {
    return `Markdown render error: ${err.message}`;
  }
  return null;
}

function ConceptViewEdit({ onToast }) {
  const [concepts, setConcepts] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [screen, setScreen] = useState('list'); // 'list' | 'detail' | 'replace'
  const [selectedId, setSelectedId] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftError, setDraftError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load concepts + backfill missing `accepted` flags.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'concepts'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const needBackfill = list.filter(c => c.accepted === undefined);
        if (needBackfill.length > 0) {
          const batch = writeBatch(db);
          for (const c of needBackfill) {
            batch.set(doc(db, 'concepts', c.id), {
              name: c.name ?? '',
              text: c.text ?? '',
              accepted: false,
            });
          }
          await batch.commit();
          for (const c of list) {
            if (c.accepted === undefined) c.accepted = false;
          }
        }
        if (mounted) setConcepts(list);
      } catch (err) {
        console.error('Failed to load concepts:', err);
        if (mounted) setLoadError(err.message || 'Failed to load concepts.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loadError) {
    return <p className="text-xs text-red-600" role="alert">{loadError}</p>;
  }
  if (concepts === null) {
    return <p className="text-xs text-[--color-text-muted]">Loading concepts…</p>;
  }
  if (concepts.length === 0) {
    return <p className="text-xs text-[--color-text-muted]">No concepts yet. Upload some under Concept Upload.</p>;
  }

  // Sort: unaccepted first (ID ascending), then accepted (ID ascending).
  const sorted = [...concepts].sort((x, y) => {
    if (x.accepted !== y.accepted) return x.accepted ? 1 : -1;
    return compareConceptIds(x.id, y.id);
  });

  const current = selectedId ? concepts.find(c => c.id === selectedId) : null;

  // ── List screen ──
  if (screen === 'list') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-[--color-text-muted] mb-2">
          {concepts.length} concept{concepts.length === 1 ? '' : 's'}. Tap to view or edit.
        </p>
        <ul className="space-y-1">
          {sorted.map(c => (
            <li key={c.id}>
              <button
                onClick={() => { setSelectedId(c.id); setScreen('detail'); }}
                className={[
                  'w-full text-left px-3 py-2 rounded-[--radius-sm] text-sm border border-[--color-border]',
                  'min-h-touch',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                  c.accepted
                    ? 'bg-[--color-surface-sunken] text-[--color-text-muted]'
                    : 'bg-[--color-surface] text-[--color-text]',
                ].join(' ')}
              >
                <span className="font-mono">{c.id}</span>
                {' — '}
                <span>{c.name}</span>
                {c.accepted && <span className="ml-2" aria-label="accepted">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Detail screen ──
  if (screen === 'detail' && current) {
    async function handleReplace() {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(current.text);
          onToast?.('Current text copied to clipboard', 'success');
        } else {
          onToast?.('Clipboard unavailable — copy the text manually');
        }
      } catch {
        onToast?.('Clipboard copy failed — copy the text manually');
      }
      setDraftText('');
      setDraftError('');
      setScreen('replace');
    }

    async function handleAccept() {
      if (current.accepted || saving) return;
      setSaving(true);
      try {
        await updateDoc(doc(db, 'concepts', current.id), { accepted: true });
        setConcepts(prev => prev.map(c => c.id === current.id ? { ...c, accepted: true } : c));
        onToast?.('Concept accepted', 'success');
      } catch (err) {
        console.error('Failed to accept concept:', err);
        onToast?.('Failed to accept concept');
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap text-xs text-[--color-text-muted]">
          <button
            onClick={() => { setScreen('list'); setSelectedId(null); }}
            className="min-h-touch px-3 rounded-[--radius-sm] border border-[--color-border] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            ← Back
          </button>
          <span className="font-mono">{current.id}</span>
          <span>—</span>
          <span className="font-medium text-[--color-text]">{current.name}</span>
        </div>

        <div className="p-3 rounded-[--radius-md] bg-[--color-surface-sunken] border border-[--color-border] space-y-2">
          {renderMarkdown(current.text)}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReplace}
            disabled={saving}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm border border-[--color-border] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Replace
          </button>
          <button
            onClick={handleAccept}
            disabled={current.accepted || saving}
            aria-label={current.accepted ? 'Already accepted' : 'Accept concept'}
            className={[
              'min-h-touch px-4 rounded-[--radius-md] text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
              current.accepted
                ? 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed'
                : 'bg-[--color-brand] text-white disabled:opacity-50',
            ].join(' ')}
          >
            {current.accepted ? 'Accepted ✓' : (saving ? 'Saving…' : 'Accept')}
          </button>
        </div>
      </div>
    );
  }

  // ── Replace screen ──
  if (screen === 'replace' && current) {
    async function handleSave() {
      const err = validateConceptText(draftText);
      if (err) {
        setDraftError(err);
        return;
      }
      setSaving(true);
      try {
        await updateDoc(doc(db, 'concepts', current.id), { text: draftText });
        setConcepts(prev => prev.map(c => c.id === current.id ? { ...c, text: draftText } : c));
        setDraftText('');
        setDraftError('');
        setScreen('detail');
        onToast?.('Concept text updated', 'success');
      } catch (err2) {
        console.error('Failed to save concept text:', err2);
        setDraftError(err2.message || 'Failed to save.');
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap text-xs text-[--color-text-muted]">
          <span className="font-mono">{current.id}</span>
          <span>—</span>
          <span className="font-medium text-[--color-text]">{current.name}</span>
        </div>
        <p className="text-xs text-[--color-text-muted]">
          The current text was copied to your clipboard. Paste and edit the new version below, then Save.
        </p>

        <label htmlFor="concept-edit-textarea" className="sr-only">New concept text</label>
        <textarea
          id="concept-edit-textarea"
          value={draftText}
          onChange={e => { setDraftText(e.target.value); setDraftError(''); }}
          rows={14}
          placeholder="Paste the edited text here…"
          className="w-full p-2 text-xs font-mono rounded-[--radius-md] bg-[--color-surface-sunken] border border-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        />

        {draftError && (
          <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono" role="alert">{draftError}</pre>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !draftText.trim()}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm font-medium bg-[--color-brand] text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setScreen('detail'); setDraftText(''); setDraftError(''); }}
            disabled={saving}
            className="min-h-touch px-4 rounded-[--radius-md] text-sm border border-[--color-border] text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Workflows ───────────────────────────────────────────────────────────────

const WORKFLOWS = [
  {
    id: 'card-creation',
    title: 'Card creation workflow',
    steps: [
      'Open a Claude chat and paste in a content design prompt (conversational or research-first)',
      'Iterate on the content outline until you\'re happy with the material',
      'Paste in the card generation style guide prompt',
      'Review proposed question stems, request changes as needed',
      'Approve the list — Claude outputs a JSON array of arrays',
      'In Driftstone admin, open Batch Upload and paste the JSON',
      'Preview the cards, pick the destination (course > chapter > section)',
      'Upload, then review the cards in Card Review before publishing',
    ],
  },
];

function Workflows() {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="space-y-1">
      {WORKFLOWS.map(wf => (
        <div key={wf.id}>
          <button
            onClick={() => setOpenId(openId === wf.id ? null : wf.id)}
            aria-expanded={openId === wf.id}
            className="w-full flex items-center justify-between text-sm text-left text-[--color-text] py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
            style={{ minHeight: 'var(--spacing-touch)' }}
          >
            {wf.title}
            <span className="text-xs text-[--color-text-muted]">{openId === wf.id ? '▲' : '▼'}</span>
          </button>
          {openId === wf.id && (
            <ol className="list-decimal list-inside space-y-1.5 pb-3 text-xs text-[--color-text] pl-1">
              {wf.steps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main AdminTab ────────────────────────────────────────────────────────────

export default function AdminTab({ user, isAdmin, onHideAdmin, onReviewing }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);
  const [toast, setToast] = useState(null);
  const { errors, loading: errorsLoading, clearAll } = useErrorLog(user, isAdmin);
  const { reviewedMap, loading: reviewLoading, saveReview } = useReviewedCards(user, isAdmin);
  const { inspirations, loading: inspirationsLoading, saveInspiration, deleteInspiration } = useInspirations(user, isAdmin);

  function showToast(msg, type = 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const [pendingInspirationId, setPendingInspirationId] = useState(null);

  // Card review flow state
  const [reviewScreen, setReviewScreen] = useState('picker'); // 'picker' | 'reviewing' | 'summary'
  const [reviewCards, setReviewCards] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewResults, setReviewResults] = useState([]);

  const headingRef = useRef(null);

  useEffect(() => {
    loadAllCoursesAdmin()
      .then(data => { setCourses(data); setLoading(false); })
      .catch(err => { console.error('Failed to load courses:', err); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!loading && !errorsLoading && !reviewLoading && !inspirationsLoading) {
      headingRef.current?.focus();
    }
  }, [loading, errorsLoading, reviewLoading, inspirationsLoading]);

  useEffect(() => {
    onReviewing?.(reviewScreen === 'reviewing' || reviewScreen === 'summary');
  }, [reviewScreen, onReviewing]);

  function toggleSection(id) {
    setOpenSection(prev => prev === id ? null : id);
  }

  // ── Card editing (writes to Firestore cards collection) ──

  async function handleEditSave(cardId, fields, { publish = false } = {}) {
    try {
      const update = {
        question: fields.question,
        answer: fields.answer,
        explanation: fields.explanation,
      };
      if (publish) update.isPrivate = false;

      await setDoc(doc(db, 'cards', cardId), update, { merge: true });

      if (publish) {
        await saveReview(cardId, 'accepted', []);
      }

      // Update local cache
      invalidateCache();
      const data = await loadAllCoursesAdmin();
      setCourses(data);

      // Update review cards in-flight if reviewing
      if (reviewScreen === 'reviewing') {
        setReviewCards(prev => prev.map(c =>
          c.id === cardId ? { ...c, ...fields } : c
        ));
      }
    } catch (err) {
      console.error('Failed to edit card:', err);
      showToast(publish ? 'Failed to save & publish' : 'Failed to save card edit');
    }
  }

  // ── Quick card add ──

  async function handleQuickAdd(cardData) {
    try {
      await addDoc(collection(db, 'cards'), cardData);
      invalidateCache();
      const data = await loadAllCoursesAdmin();
      setCourses(data);
      showToast('Card added', 'success');
      if (pendingInspirationId) {
        await deleteInspiration(pendingInspirationId);
        setPendingInspirationId(null);
      }
    } catch (err) {
      console.error('Failed to add card:', err);
      showToast('Failed to add card');
    }
  }

  async function handleBatchAdd(cardsArray) {
    try {
      const batch = writeBatch(db);
      for (const card of cardsArray) {
        const ref = doc(collection(db, 'cards'));
        batch.set(ref, card);
      }
      await batch.commit();
      invalidateCache();
      const data = await loadAllCoursesAdmin();
      setCourses(data);
      showToast(`${cardsArray.length} cards uploaded`, 'success');
    } catch (err) {
      console.error('Failed to batch upload:', err);
      showToast('Failed to upload cards');
    }
  }

  async function handleConceptUpload(conceptsObj) {
    try {
      const batch = writeBatch(db);
      const ids = Object.keys(conceptsObj);
      for (const id of ids) {
        const ref = doc(db, 'concepts', id);
        batch.set(ref, {
          name: conceptsObj[id].Concept,
          text: conceptsObj[id].text,
          accepted: false,
        });
      }
      await batch.commit();
      showToast(`${ids.length} concepts uploaded`, 'success');
    } catch (err) {
      console.error('Failed to upload concepts:', err);
      showToast('Failed to upload concepts');
    }
  }

  // ── Card review flow ──

  function handleStartReview(selected, allCourses) {
    const cards = getCardsBySectionIds(allCourses, selected)
      .filter(c => !reviewedMap.has(c.id));
    const shuffled = shuffle(cards);
    if (shuffled.length === 0) return;
    setReviewCards(shuffled);
    setReviewIndex(0);
    setReviewResults([]);
    setReviewScreen('reviewing');
  }

  async function handleAccept() {
    const card = reviewCards[reviewIndex];

    // Flip isPrivate to false
    try {
      await setDoc(doc(db, 'cards', card.id), { isPrivate: false }, { merge: true });
    } catch (err) {
      console.error('Failed to publish card:', err);
      showToast('Failed to publish card');
    }

    // Log review
    await saveReview(card.id, 'accepted', []);
    setReviewResults(prev => [...prev, { cardId: card.id, status: 'accepted' }]);
    advance();
  }

  async function handleIssues(tags) {
    const card = reviewCards[reviewIndex];
    await saveReview(card.id, 'issues', tags);
    setReviewResults(prev => [...prev, { cardId: card.id, status: 'issues', issues: tags }]);
    advance();
  }

  function advance() {
    if (reviewIndex + 1 < reviewCards.length) {
      setReviewIndex(reviewIndex + 1);
    } else {
      setReviewScreen('summary');
    }
  }

  async function handleInspiration(text) {
    await saveInspiration(text);
    showToast('Inspiration saved', 'success');
  }

  function handleReviewDone() {
    invalidateCache();
    loadAllCoursesAdmin().then(data => setCourses(data));
    setReviewScreen('picker');
  }

  if (loading || errorsLoading || reviewLoading || inspirationsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[--color-text-muted]" role="status">Loading...</p>
      </div>
    );
  }

  // Full-screen review mode
  if (reviewScreen === 'reviewing' && reviewCards.length > 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b border-[--color-border] flex justify-end">
          <button
            onClick={() => { setReviewScreen('summary'); }}
            className="text-xs text-[--color-text-muted] hover:text-[--color-text] min-h-touch px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
          >
            Done
          </button>
        </div>
        <CardReviewViewer
          card={reviewCards[reviewIndex]}
          index={reviewIndex}
          total={reviewCards.length}
          onAccept={handleAccept}
          onIssues={handleIssues}
          onEditSave={handleEditSave}
          onInspiration={handleInspiration}
        />
      </div>
    );
  }

  if (reviewScreen === 'summary') {
    return <ReviewSummary results={reviewResults} onDone={handleReviewDone} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toast && (
        <div className={`px-4 py-2 text-white text-xs text-center ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} role="alert">
          {toast.msg}
        </div>
      )}
      {/* Fixed header */}
      <div className="px-4 py-3 border-b border-[--color-border] bg-[--color-surface] flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
          Admin
        </h2>
        <button
          onClick={onHideAdmin}
          className="text-xs text-[--color-text-muted] hover:text-[--color-text] px-2 py-1 rounded-[--radius-sm] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
        >
          Hide admin
        </button>
      </div>

      {/* Accordion sections */}
      <div className="flex-1 overflow-y-auto">
        <AccordionSection
          title="Write Errors"
          badge={errors.length}
          open={openSection === 'errors'}
          onToggle={() => toggleSection('errors')}
        >
          <ErrorLogContent errors={errors} clearAll={clearAll} />
        </AccordionSection>

        <AccordionSection
          title="Card Review"
          badge={0}
          open={openSection === 'review'}
          onToggle={() => toggleSection('review')}
        >
          <AdminTopicPicker courses={courses} onStart={handleStartReview} reviewedMap={reviewedMap} />
        </AccordionSection>

        <AccordionSection
          title="Reviewed Cards"
          badge={0}
          open={openSection === 'reviewed'}
          onToggle={() => toggleSection('reviewed')}
        >
          <ReviewedCardsContent courses={courses} reviewedMap={reviewedMap} onEditSave={handleEditSave} />
        </AccordionSection>

        <AccordionSection
          title="Inspirations"
          badge={inspirations.length}
          open={openSection === 'inspirations'}
          onToggle={() => toggleSection('inspirations')}
        >
          <InspirationsContent
            inspirations={inspirations}
            onSave={saveInspiration}
            onCreate={(id) => { setPendingInspirationId(id); setOpenSection('adder'); }}
          />
        </AccordionSection>

        <AccordionSection
          title="Quick Card Adder"
          badge={0}
          open={openSection === 'adder'}
          onToggle={() => toggleSection('adder')}
        >
          <QuickCardAdder courses={courses} onSave={handleQuickAdd} />
        </AccordionSection>

        <AccordionSection
          title="Batch Upload"
          badge={0}
          open={openSection === 'batch'}
          onToggle={() => toggleSection('batch')}
        >
          <BatchUpload courses={courses} onBatchSave={handleBatchAdd} />
        </AccordionSection>

        <AccordionSection
          title="Concept Upload"
          badge={0}
          open={openSection === 'concepts'}
          onToggle={() => toggleSection('concepts')}
        >
          <ConceptUpload onUpload={handleConceptUpload} />
        </AccordionSection>

        <AccordionSection
          title="Concept Editor"
          badge={0}
          open={openSection === 'conceptEdit'}
          onToggle={() => toggleSection('conceptEdit')}
        >
          <ConceptViewEdit onToast={showToast} />
        </AccordionSection>

        <AccordionSection
          title="Course Settings"
          badge={0}
          open={openSection === 'courses'}
          onToggle={() => toggleSection('courses')}
        >
          <CourseSettings courses={courses} onError={showToast} />
        </AccordionSection>

        <AccordionSection
          title="Workflows"
          badge={0}
          open={openSection === 'workflows'}
          onToggle={() => toggleSection('workflows')}
        >
          <Workflows />
        </AccordionSection>
      </div>
    </div>
  );
}
