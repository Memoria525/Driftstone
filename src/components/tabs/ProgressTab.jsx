import { useState, useEffect, useRef, useMemo } from 'react';
import { loadCourses } from '../../data/courseLoader.js';
import { computeRetrievability } from '../../utils/fsrs.js';

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

function computeReadiness(cardIds, stateMap, now) {
  if (cardIds.length === 0) return 0;
  let sum = 0;
  for (const id of cardIds) {
    const s = stateMap.get(id);
    if (s) sum += computeRetrievability(s, now);
  }
  return sum / cardIds.length;
}

function ReadinessBar({ readiness, label }) {
  const pct = Math.round(readiness * 100);
  return (
    <div
      className="h-1.5 bg-[--color-surface-sunken] rounded-full overflow-hidden mt-1"
      role="img"
      aria-label={`${label} readiness: ${pct} percent`}
    >
      <div
        className="h-full bg-[--color-brand] rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ReadinessPct({ readiness }) {
  const pct = Math.round(readiness * 100);
  return (
    <span className="text-xs font-semibold text-[--color-brand]">
      {pct}%
    </span>
  );
}

export default function ProgressTab({ stateMap, stateLoading }) {
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
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
    requestAnimationFrame(() => headingRef.current?.focus());
  }, [loading]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalc timestamp when data arrives
  const now = useMemo(() => new Date(), [courses, stateMap]);

  const allCardIds = useMemo(() =>
    courses.flatMap(course =>
      course.chapters.flatMap(ch =>
        ch.sections.flatMap(sec => sec.cards.map(c => c.id))
      )
    ), [courses]);

  const totalCards = allCardIds.length;
  const overallReadiness = useMemo(() =>
    loading ? 0 : computeReadiness(allCardIds, stateMap, now),
    [loading, allCardIds, stateMap, now]
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[--color-text-muted] text-sm">
        Loading…
      </div>
    );
  }

  const studied = stateMap.size;
  const newCards = totalCards - studied;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* Overall readiness */}
        <div className="text-center">
          <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[--color-text] outline-none" aria-label={`Exam readiness: ${Math.round(overallReadiness * 100)} percent. ${studied} studied, ${newCards} new, ${totalCards} total.`}>
            Exam readiness
          </h2>
          <p className="text-4xl font-bold text-[--color-brand] mt-2">
            {Math.round(overallReadiness * 100)}%
          </p>
          <p className="text-sm text-[--color-text-muted] mt-1">
            {studied} studied · {newCards} new · {totalCards} total
          </p>
          <div className="max-w-xs mx-auto mt-3">
            <ReadinessBar readiness={overallReadiness} label="Overall" />
          </div>
        </div>

        {/* Per-topic breakdown */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[--color-text]">By topic</h3>
          {courses.map(course => {
            const courseCardIds = course.chapters.flatMap(ch =>
              ch.sections.flatMap(sec => sec.cards.map(c => c.id))
            );
            const courseReadiness = computeReadiness(courseCardIds, stateMap, now);
            const cOpen = openCourses.has(course.id);

            return (
              <div key={course.id} className="rounded-[--radius-md] border border-[--color-border] overflow-hidden">
                <button
                  onClick={() => toggleSet(setOpenCourses, course.id)}
                  aria-expanded={cOpen}
                  className="w-full flex flex-col gap-1 px-4 py-2 bg-[--color-surface-raised] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                  style={{ minHeight: 'var(--spacing-touch)' }}
                >
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span className="flex items-center gap-2 font-semibold text-sm">
                      <ChevronIcon open={cOpen} />
                      {course.name}
                    </span>
                    <ReadinessPct readiness={courseReadiness} />
                  </span>
                  <ReadinessBar readiness={courseReadiness} label={course.name} />
                </button>

                {cOpen && (
                  <div className="divide-y divide-[--color-border]">
                    {course.chapters.map(chapter => {
                      const chapterCardIds = chapter.sections.flatMap(sec =>
                        sec.cards.map(c => c.id)
                      );
                      const chapterReadiness = computeReadiness(chapterCardIds, stateMap, now);
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
                            <ReadinessPct readiness={chapterReadiness} />
                          </button>

                          {chOpen && (
                            <div className="bg-[--color-surface-sunken] divide-y divide-[--color-border]">
                              {chapter.sections.map(section => {
                                const sectionCardIds = section.cards.map(c => c.id);
                                const sectionReadiness = computeReadiness(sectionCardIds, stateMap, now);

                                return (
                                  <div
                                    key={section.id}
                                    className="flex items-center justify-between pl-14 pr-4"
                                    style={{ minHeight: 'var(--spacing-touch)' }}
                                  >
                                    <span className="text-sm text-[--color-text] py-3">
                                      {section.name}
                                    </span>
                                    <ReadinessPct readiness={sectionReadiness} />
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
