import { useState, useMemo, useRef, useEffect } from 'react';
import { loadCourses } from '../../data/courseLoader.js';
import useAnnounce from '../../hooks/useAnnounce.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function allSectionIds(courses) {
  const ids = new Set();
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        ids.add(section.id);
      }
    }
  }
  return ids;
}

function chapterSectionIds(chapter) {
  return chapter.sections.map((s) => s.id);
}

function courseSectionIds(course) {
  return course.chapters.flatMap(chapterSectionIds);
}

// tri-state: 'all' | 'some' | 'none'
function selectionState(ids, selected) {
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return 'none';
  if (count === ids.length) return 'all';
  return 'some';
}

// ── sub-components ────────────────────────────────────────────────────────────

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

function Checkbox({ state, onChange, label }) {
  const checked = state === 'all';
  const indeterminate = state === 'some';

  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={onChange}
      className={[
        'w-5 h-5 shrink-0 rounded border-2 cursor-pointer',
        'accent-[--color-brand]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
      ].join(' ')}
    />
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function TopicPicker({ onStart }) {
  const courses = useMemo(() => loadCourses(), []);
  const headingRef = useRef(null);
  const announce = useAnnounce();

  useEffect(() => {
    headingRef.current?.focus();
    announce('Select topics to study');
  }, [announce]);

  // Everything selected by default
  const [selected, setSelected] = useState(() => allSectionIds(courses));

  // Which courses/chapters are expanded
  const [openCourses, setOpenCourses] = useState(() => new Set(courses.map((c) => c.id)));
  const [openChapters, setOpenChapters] = useState(() => {
    const ids = new Set();
    for (const course of courses) {
      for (const chapter of course.chapters) ids.add(chapter.id);
    }
    return ids;
  });

  function toggleSet(setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSections(ids, currentState) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (currentState === 'all') {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const totalSelected = selected.size;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable tree */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-[--color-text] outline-none">
          Select topics
        </h2>
        {courses.length === 0 && (
          <p className="text-sm text-[--color-text-muted] text-center py-8">
            No courses found. Add course data to the Courses folder.
          </p>
        )}
        {courses.map((course) => {
          const cIds = courseSectionIds(course);
          const cState = selectionState(cIds, selected);
          const cOpen = openCourses.has(course.id);

          return (
            <div key={course.id} className="rounded-[--radius-md] border border-[--color-border] overflow-hidden">
              {/* Course row */}
              <div className="flex items-center gap-3 px-4 bg-[--color-surface-raised]" style={{ minHeight: 'var(--spacing-touch)' }}>
                <Checkbox
                  state={cState}
                  label={`Select all sections in ${course.name}`}
                  onChange={() => toggleSections(cIds, cState)}
                />
                <button
                  onClick={() => toggleSet(setOpenCourses, course.id)}
                  aria-expanded={cOpen}
                  className="flex-1 flex items-center justify-between gap-2 py-3 text-left font-semibold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                >
                  {course.name}
                  <ChevronIcon open={cOpen} />
                </button>
              </div>

              {/* Chapters */}
              {cOpen && (
                <div className="divide-y divide-[--color-border]">
                  {course.chapters.map((chapter) => {
                    const chIds = chapterSectionIds(chapter);
                    const chState = selectionState(chIds, selected);
                    const chOpen = openChapters.has(chapter.id);

                    return (
                      <div key={chapter.id}>
                        {/* Chapter row */}
                        <div className="flex items-center gap-3 pl-8 pr-4 bg-[--color-surface]" style={{ minHeight: 'var(--spacing-touch)' }}>
                          <Checkbox
                            state={chState}
                            label={`Select all sections in ${chapter.name}`}
                            onChange={() => toggleSections(chIds, chState)}
                          />
                          <button
                            onClick={() => toggleSet(setOpenChapters, chapter.id)}
                            aria-expanded={chOpen}
                            className="flex-1 flex items-center justify-between gap-2 py-3 text-left text-sm font-medium text-[--color-text] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded"
                          >
                            {chapter.name}
                            <ChevronIcon open={chOpen} />
                          </button>
                        </div>

                        {/* Sections */}
                        {chOpen && (
                          <div className="bg-[--color-surface-sunken] divide-y divide-[--color-border]">
                            {chapter.sections.map((section) => {
                              const sSelected = selected.has(section.id);
                              return (
                                <label
                                  key={section.id}
                                  className="flex items-center gap-3 pl-12 pr-4 cursor-pointer hover:bg-[--color-surface-raised] transition-colors"
                                  style={{ minHeight: 'var(--spacing-touch)' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={sSelected}
                                    onChange={() =>
                                      setSelected((prev) => {
                                        const next = new Set(prev);
                                        sSelected ? next.delete(section.id) : next.add(section.id);
                                        return next;
                                      })
                                    }
                                    className="w-5 h-5 shrink-0 rounded accent-[--color-brand] focus-visible:ring-2 focus-visible:ring-[--color-focus]"
                                  />
                                  <span className="text-sm text-[--color-text] py-3">
                                    {section.name}
                                  </span>
                                </label>
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

      {/* Sticky footer */}
      <div className="px-4 py-3 border-t border-[--color-border] bg-[--color-surface]">
        <button
          onClick={() => onStart(selected)}
          disabled={totalSelected === 0}
          className={[
            'w-full min-h-touch rounded-[--radius-md] font-semibold text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            totalSelected > 0
              ? 'bg-[--color-brand] hover:bg-[--color-brand-dark] text-white'
              : 'bg-[--color-surface-sunken] text-[--color-text-muted] cursor-not-allowed',
          ].join(' ')}
          aria-disabled={totalSelected === 0}
        >
          {totalSelected === 0
            ? 'Select topics to study'
            : `Study ${totalSelected} section${totalSelected === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}
