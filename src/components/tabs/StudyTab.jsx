import { useState, useRef, useEffect } from 'react';
import TopicPicker from '../topic-picker/TopicPicker.jsx';
import CardViewer from '../card-viewer/CardViewer.jsx';
import SummaryScreen from '../card-viewer/SummaryScreen.jsx';
import { getCardsBySectionIds, getCardsByIds, loadCoursesForUser, shuffle } from '../../data/courseLoader.js';
import { scheduleCard, sortByPriority, createEmptyCardState, GRADE_TO_RATING } from '../../utils/fsrs.js';

export default function StudyTab({ onStudying, stateMap, saveCardState, dueCount, isAdmin, hideAdmin }) {
  const [screen, setScreen] = useState('picker'); // 'picker' | 'study' | 'summary'

  useEffect(() => {
    onStudying?.(screen === 'study');
  }, [screen, onStudying]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const coursesRef = useRef(null);
  const selectedSectionIdsRef = useRef(null);

  function handleStart(selectedSectionIds, courses, timeLimit, mode = 'review') {
    coursesRef.current = courses;
    selectedSectionIdsRef.current = selectedSectionIds;
    const allCards = getCardsBySectionIds(courses, selectedSectionIds);
    const pool = mode === 'full' ? shuffle(allCards) : sortByPriority(allCards, stateMap);
    if (pool.length === 0) return;
    setCards(pool);
    setCurrentIndex(0);
    setResults([]);
    setTimedOut(false);
    setEndTime(timeLimit ? Date.now() + timeLimit * 60 * 1000 : null);
    setScreen('study');
  }

  function handleGrade(grade) {
    const card = cards[currentIndex];
    const newResults = [...results, { cardId: card.id, grade }];
    setResults(newResults);

    // Compute and persist FSRS state
    const rating = GRADE_TO_RATING[grade];
    const currentState = stateMap.get(card.id) || createEmptyCardState(card.id);
    const newState = scheduleCard(currentState, rating);
    saveCardState(card.id, newState);

    const timeExpired = endTime && Date.now() >= endTime;
    if (currentIndex + 1 < cards.length && !timeExpired) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setTimedOut(!!timeExpired);
      setScreen('summary');
    }
  }

  async function handleReviewDue() {
    const now = new Date();
    const dueIds = [];
    for (const [cardId, s] of stateMap) {
      if (s.state !== 'new' && s.due <= now) dueIds.push(cardId);
    }
    if (dueIds.length === 0) return;

    try {
      const courses = await loadCoursesForUser(isAdmin, hideAdmin);
      const dueCards = getCardsByIds(courses, dueIds);
      // Sort most overdue first
      dueCards.sort((a, b) => {
        const sa = stateMap.get(a.id);
        const sb = stateMap.get(b.id);
        return (sa.due - now) - (sb.due - now);
      });

      if (dueCards.length === 0) return;
      setCards(dueCards);
      setCurrentIndex(0);
      setResults([]);
      setTimedOut(false);
      setEndTime(null);
      setScreen('study');
    } catch (err) {
      console.error('Failed to load due cards:', err);
    }
  }

  async function handleKeepGoing() {
    // Continue studying same cards from where they left off, no time limit
    setEndTime(null);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
      setScreen('study');
    } else if (coursesRef.current && selectedSectionIdsRef.current) {
      // Re-sort the full pool for a fresh pass (normal study flow)
      const pool = sortByPriority(
        getCardsBySectionIds(coursesRef.current, selectedSectionIdsRef.current),
        stateMap
      );
      if (pool.length === 0) return;
      setCards(pool);
      setCurrentIndex(0);
      setScreen('study');
    } else {
      // Due review session — re-pull due cards
      await handleReviewDue();
    }
  }

  function handleRestart() {
    setPickerKey(k => k + 1);
    setEndTime(null);
    setScreen('picker');
  }

  if (screen === 'study' && cards.length > 0) {
    return (
      <CardViewer
        key={cards[currentIndex].id}
        card={cards[currentIndex]}
        index={currentIndex}
        total={cards.length}
        onGrade={handleGrade}
        onDone={() => { setTimedOut(false); setScreen('summary'); }}
        endTime={endTime}
      />
    );
  }

  if (screen === 'summary') {
    return (
      <SummaryScreen
        results={results}
        total={cards.length}
        onRestart={handleRestart}
        onKeepGoing={handleKeepGoing}
        timedOut={timedOut}
      />
    );
  }

  return <TopicPicker key={pickerKey} onStart={handleStart} dueCount={dueCount} onReviewDue={handleReviewDue} stateMap={stateMap} isAdmin={isAdmin} hideAdmin={hideAdmin} />;
}
