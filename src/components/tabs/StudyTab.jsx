import { useState, useRef, useEffect } from 'react';
import TopicPicker from '../topic-picker/TopicPicker.jsx';
import CardViewer from '../card-viewer/CardViewer.jsx';
import SummaryScreen from '../card-viewer/SummaryScreen.jsx';
import { getCardsBySectionIds } from '../../data/courseLoader.js';
import { scheduleCard, sortByPriority, createEmptyCardState, GRADE_TO_RATING } from '../../utils/fsrs.js';

export default function StudyTab({ onStudying, stateMap, saveCardState }) {
  const [screen, setScreen] = useState('picker'); // 'picker' | 'study' | 'summary'

  useEffect(() => {
    onStudying?.(screen === 'study');
  }, [screen, onStudying]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const coursesRef = useRef(null);
  const selectedSectionIdsRef = useRef(null);

  function handleStart(selectedSectionIds, courses, timeLimit) {
    coursesRef.current = courses;
    selectedSectionIdsRef.current = selectedSectionIds;
    const pool = sortByPriority(
      getCardsBySectionIds(courses, selectedSectionIds),
      stateMap
    );
    if (pool.length === 0) return;
    setCards(pool);
    setCurrentIndex(0);
    setResults([]);
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

    if (currentIndex + 1 < cards.length && !(endTime && Date.now() >= endTime)) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setScreen('summary');
    }
  }

  function handleKeepGoing() {
    // Continue studying same cards from where they left off, no time limit
    setEndTime(null);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Re-sort the full pool for a fresh pass
      const pool = sortByPriority(
        getCardsBySectionIds(coursesRef.current, selectedSectionIdsRef.current),
        stateMap
      );
      if (pool.length === 0) return;
      setCards(pool);
      setCurrentIndex(0);
    }
    setScreen('study');
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
        onDone={() => setScreen('summary')}
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
      />
    );
  }

  return <TopicPicker key={pickerKey} onStart={handleStart} />;
}
