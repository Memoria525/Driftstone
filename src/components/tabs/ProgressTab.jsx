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

function countCards(stateMap, totalCards) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(endOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

  const counts = { overdue: 0, dueToday: 0, upcoming: 0, studied: 0 };

  for (const s of stateMap.values()) {
    counts.studied++;
    const due = s.due;
    if (due < startOfToday) {
      counts.overdue++;
    } else if (due < endOfToday) {
      counts.dueToday++;
    } else if (due < weekFromNow) {
      counts.upcoming++;
    }
  }

  counts.newCards = totalCards - counts.studied;
  return counts;
}

export default function ProgressTab() {
  const { user } = useAuth();
  const { stateMap, loading: stateLoading } = useCardState(user);
  const [totalCards, setTotalCards] = useState(0);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const announce = useAnnounce();
  const headingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadCourses().then(courses => {
      if (cancelled) return;
      let count = 0;
      for (const c of courses) {
        for (const ch of c.chapters) {
          for (const sec of ch.sections) {
            count += sec.cards.length;
          }
        }
      }
      setTotalCards(count);
      setCoursesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const loading = stateLoading || coursesLoading;

  useEffect(() => {
    if (loading) return;
    headingRef.current?.focus();
  }, [loading]);

  const counts = loading ? null : countCards(stateMap, totalCards);
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
      </div>
    </div>
  );
}
