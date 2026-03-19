import { useState, useEffect, useRef } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useCardState from '../../hooks/useCardState.js';
import { loadCourses } from '../../data/courseLoader.js';
import useAnnounce from '../../hooks/useAnnounce.js';

const CATEGORIES = [
  { id: 'overdue', label: 'Overdue', color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'dueToday', label: 'Due today', color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'upcoming', label: 'Next 7 days', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

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

function toggleSet(setter, id) {
  setter(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}

function computeCounts(stateMap, totalCards) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const counts = { overdue: 0, dueToday: 0, upcoming: 0, studied: 0 };

  for (const s of stateMap.values()) {
    counts.studied++;
    const due = s.due;
    if (due < startOfToday) counts.overdue++;
    else if (due < endOfToday) counts.dueToday++;
    else if (due < weekFromNow) counts.upcoming++;
  }

  counts.newCards = totalCards - counts.studied;
  return counts;
}

function countCardsForIds(cardIds, stateMap) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  let overdue = 0;
  let dueToday = 0;

  for (const id of cardIds) {
    const s = stateMap.get(id);
    if (!s) continue;
    const due = s.due;
    if (due < startOfToday) overdue++;
    else if (due < endOfToday) dueToday++;
  }

  return { overdue, dueToday };
}

function DueBadges({ overdue, dueToday }) {
  if (overdue === 0 && dueToday === 0) return null;
  return (
    <span className="flex gap-2 text-xs font-semibold">
      {overdue > 0 && <span className="text-red-600">{overdue} overdue</span>}
      {dueToday > 0 && <span className="text-amber-600">{dueToday} due</span>}
    </span>
  );
}

export default function ProgressTab() {
  const { user } = useAuth();
  const { stateMap, loading: stateLoading } = useCardState(user);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const announce = useAnnounce();
  const headingRef = useRef(null);

  const [openCourses, setOpenCourses] = useState(() => new Set());
  const [openChapters, setOpenChapters] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    loadCourses().then(data => {
      if (cancelled) return;
      setCourses(data);
      setCoursesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const loading = stateLoading || coursesLoading;

  useEffect(() => {
    if (loading) return;
    headingRef.current?.focus();
  }, [loading]);

  let totalCards = 0;
  for (const c of courses) {
    for (const ch of c.chapters) {
      for (const sec of ch.sections) {
        totalCards += sec.cards.length;
      }
    }
  }

  const counts = loading ? null : computeCounts(stateMap, totalCards);
  const overdue = counts?.overdue ?? 0;
  const dueToday = counts?.dueToday ?? 0;

  useEffect(() => {
    if (!counts) return;
    const dueNow = overdue + dueToday;
    announce(`${dueNow} card${dueNow === 1 ? '' : 's'} due for review.`);
  }, [counts, overdue, dueToday, announce]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[--color-text-muted] text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="text-center">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[--color-text] outline-none">
            Review progress
          </h2>
          <p className="text-sm text-[--color-text-muted] mt-1">
            {counts.studied} studied · {counts.newCards} new
          </p>
        </div>

        <div className="space-y-2">
          {CATEGORIES.map(cat => (
            <div key={cat.id} className={`flex items-center justify-between rounded-[--radius-md] px-4 ${cat.bg}`} style={{ minHeight: 'var(--spacing-touch)' }}>
              <span className={`text-sm font-medium ${cat.color}`}>{cat.label}</span>
              <span className={`text-sm font-semibold ${cat.color}`}>{counts[cat.id]}</span>
            </div>
          ))}
        </div>

        {/* Per-topic breakdown */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[--color-text]">By topic</h3>
          {courses.map(course => {
            const courseCardIds = course.chapters.flatMap(ch =>
              ch.sections.flatMap(sec => sec.cards.map(c => c.id))
            );
            const courseDue = countCardsForIds(courseCardIds, stateMap);
            const cOpen = openCourses.has(course.id);

            return (
              <div key={course.id} className="rounded-[--radius-md] border border-[--color-border] overflow-hidden">
                <button
                  onClick={() => toggleSet(setOpenCourses, course.id)}
                  aria-expanded={cOpen}
                  className="w-full flex items-center justify-between gap-2 px-4 bg-[--color-surface-raised] text-left font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                  style={{ minHeight: 'var(--spacing-touch)' }}
                >
                  <span className="flex items-center gap-2">
                    <ChevronIcon open={cOpen} />
                    {course.name}
                  </span>
                  <DueBadges {...courseDue} />
                </button>

                {cOpen && (
                  <div className="divide-y divide-[--color-border]">
                    {course.chapters.map(chapter => {
                      const chapterCardIds = chapter.sections.flatMap(sec =>
                        sec.cards.map(c => c.id)
                      );
                      const chapterDue = countCardsForIds(chapterCardIds, stateMap);
                      const chOpen = openChapters.has(chapter.id);

                      return (
                        <div key={chapter.id}>
                          <button
                            onClick={() => toggleSet(setOpenChapters, chapter.id)}
                            aria-expanded={chOpen}
                            className="w-full flex items-center justify-between gap-2 pl-8 pr-4 bg-[--color-surface] text-left text-sm font-medium text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                            style={{ minHeight: 'var(--spacing-touch)' }}
                          >
                            <span className="flex items-center gap-2">
                              <ChevronIcon open={chOpen} />
                              {chapter.name}
                            </span>
                            <DueBadges {...chapterDue} />
                          </button>

                          {chOpen && (
                            <div className="bg-[--color-surface-sunken] divide-y divide-[--color-border]">
                              {chapter.sections.map(section => {
                                const sectionCardIds = section.cards.map(c => c.id);
                                const sectionDue = countCardsForIds(sectionCardIds, stateMap);

                                return (
                                  <div
                                    key={section.id}
                                    className="flex items-center justify-between pl-14 pr-4"
                                    style={{ minHeight: 'var(--spacing-touch)' }}
                                  >
                                    <span className="text-sm text-[--color-text] py-3">
                                      {section.name}
                                    </span>
                                    <DueBadges {...sectionDue} />
                                  </div>
                                );
                              })}
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
    </div>
  );
}
