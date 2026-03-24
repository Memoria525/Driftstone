import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { loadAllCoursesAdmin, getCardsBySectionIds, shuffle, invalidateCache } from '../../data/courseLoader.js';
import renderMarkdown from '../../utils/renderMarkdown.jsx';
import useErrorLog from '../../hooks/useErrorLog.js';
import useReviewedCards from '../../hooks/useReviewedCards.js';

const ISSUE_TAGS = [
  'Bad hint',
  'Bad explanation',
  'Unclear question',
  'Wrong answer',
  'Duplicate card',
  'Needs image',
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

// ── Card review viewer ───────────────────────────────────────────────────────

function CardReviewViewer({ card, index, total, onAccept, onIssues, onEditSave }) {
  const [showIssues, setShowIssues] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    question: card.question,
    answer: card.answer,
    hint: card.hint,
    explanation: card.explanation,
  });
  const questionRef = useRef(null);

  useEffect(() => {
    questionRef.current?.focus();
  }, [card.id]);

  function handleEditSave() {
    onEditSave(card.id, editFields);
    setEditing(false);
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
              <span className="text-xs font-medium text-[--color-text-muted]">Hint</span>
              <textarea
                value={editFields.hint}
                onChange={e => setEditFields(f => ({ ...f, hint: e.target.value }))}
                rows={2}
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
            <div className="flex gap-2">
              <button
                onClick={handleEditSave}
                className="flex-1 min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditFields({ question: card.question, answer: card.answer, hint: card.hint, explanation: card.explanation }); }}
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
            {card.hint && (
              <div>
                <p className="text-xs font-medium text-[--color-text-muted] mb-1">Hint</p>
                <p className="text-sm text-[--color-text] italic">{card.hint}</p>
              </div>
            )}
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
          <button
            onClick={() => setEditing(true)}
            className="w-full min-h-touch rounded-[--radius-md] text-sm font-medium bg-[--color-surface-sunken] text-[--color-text] hover:bg-[--color-border] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
          >
            Edit
          </button>
        </div>
      )}

      {showIssues && (
        <IssuePicker
          onConfirm={(tags) => { setShowIssues(false); onIssues(tags); }}
          onCancel={() => setShowIssues(false)}
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
      hint: card.hint,
      explanation: card.explanation,
    });
  }

  function handleSave(cardId) {
    onEditSave(cardId, editFields);
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
                    {['question', 'answer', 'hint', 'explanation'].map(field => (
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
                        onClick={() => handleSave(card.id)}
                        className="flex-1 min-h-touch rounded-[--radius-md] text-xs font-medium bg-[--color-brand] hover:bg-[--color-brand-dark] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="min-h-touch px-3 rounded-[--radius-md] text-xs text-[--color-text-muted] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-xs">
                      <p><strong className="text-[--color-text-muted]">Q:</strong> <span className="text-[--color-text]">{card.question}</span></p>
                      <p><strong className="text-[--color-text-muted]">A:</strong> <span className="text-[--color-text]">{card.answer}</span></p>
                      {card.hint && <p><strong className="text-[--color-text-muted]">Hint:</strong> <span className="text-[--color-text] italic">{card.hint}</span></p>}
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

// ── Main AdminTab ────────────────────────────────────────────────────────────

export default function AdminTab({ user, isAdmin, onHideAdmin, onReviewing }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);
  const { errors, loading: errorsLoading, clearAll } = useErrorLog(user, isAdmin);
  const { reviewedMap, loading: reviewLoading, saveReview } = useReviewedCards(user, isAdmin);

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
    if (!loading && !errorsLoading && !reviewLoading) {
      headingRef.current?.focus();
    }
  }, [loading, errorsLoading, reviewLoading]);

  useEffect(() => {
    onReviewing?.(reviewScreen === 'reviewing');
  }, [reviewScreen, onReviewing]);

  function toggleSection(id) {
    setOpenSection(prev => prev === id ? null : id);
  }

  // ── Card editing (writes to Firestore cards collection) ──

  async function handleEditSave(cardId, fields) {
    try {
      await setDoc(doc(db, 'cards', cardId), {
        question: fields.question,
        answer: fields.answer,
        hint: fields.hint,
        explanation: fields.explanation,
      }, { merge: true });

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
    }
  }

  // ── Card review flow ──

  function handleStartReview(selected, allCourses) {
    const cards = getCardsBySectionIds(allCourses, selected);
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

  function handleReviewDone() {
    invalidateCache();
    loadAllCoursesAdmin().then(data => setCourses(data));
    setReviewScreen('picker');
  }

  if (loading || errorsLoading || reviewLoading) {
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
        />
      </div>
    );
  }

  if (reviewScreen === 'summary') {
    return <ReviewSummary results={reviewResults} onDone={handleReviewDone} />;
  }

  return (
    <div className="flex flex-col h-full">
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
      </div>
    </div>
  );
}
