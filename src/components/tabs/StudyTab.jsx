import { useState, useRef, useEffect } from 'react';
import TopicPicker from '../topic-picker/TopicPicker.jsx';
import CardViewer from '../card-viewer/CardViewer.jsx';
import SummaryScreen from '../card-viewer/SummaryScreen.jsx';
import { getCardsBySectionIds, getCardsByIds } from '../../data/courseLoader.js';
import useAuth from '../../hooks/useAuth.js';
import useAdmin from '../../hooks/useAdmin.js';
import { scheduleCard, sortByPriority, createEmptyCardState, GRADE_TO_RATING } from '../../utils/fsrs.js';

export default function StudyTab({ onStudying, stateMap, saveCardState }) {
  const { user } = useAuth();
  const isAdmin = useAdmin(user);
  const [screen, setScreen] = useState('picker'); // 'picker' | 'study' | 'summary'

  useEffect(() => {
    onStudying?.(screen === 'study');
  }, [screen, onStudying]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [pickerKey, setPickerKey] = useState(0);
  const coursesRef = useRef(null);

  function handleStart(selectedSectionIds, courses) {
    coursesRef.current = courses;
    const pool = sortByPriority(
      getCardsBySectionIds(courses, selectedSectionIds),
      stateMap
    );
    if (pool.length === 0) return;
    setCards(pool);
    setCurrentIndex(0);
    setResults([]);
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

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setScreen('summary');
    }
  }

  function handleStartDeck(cardIds, courses) {
    coursesRef.current = courses;
    const allCards = getCardsByIds(courses, cardIds);
    const pool = sortByPriority(allCards, stateMap);
    if (pool.length === 0) return;
    setCards(pool);
    setCurrentIndex(0);
    setResults([]);
    setScreen('study');
  }

  function handleRestart() {
    setPickerKey(k => k + 1);
    setScreen('picker');
  }

  if (screen === 'study' && cards.length > 0) {
    return (
      <CardViewer
        card={cards[currentIndex]}
        index={currentIndex}
        total={cards.length}
        onGrade={handleGrade}
        onDone={() => setScreen('summary')}
        isAdmin={isAdmin}
      />
    );
  }

  if (screen === 'summary') {
    return (
      <SummaryScreen
        results={results}
        total={cards.length}
        onRestart={handleRestart}
      />
    );
  }

  return <TopicPicker key={pickerKey} onStart={handleStart} onStartDeck={handleStartDeck} />;
}
