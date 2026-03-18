import { useState } from 'react';
import TopicPicker from '../topic-picker/TopicPicker.jsx';
import CardViewer from '../card-viewer/CardViewer.jsx';
import SummaryScreen from '../card-viewer/SummaryScreen.jsx';
import { getCardsBySectionIds, shuffle } from '../../data/courseLoader.js';

export default function StudyTab() {
  const [screen, setScreen] = useState('picker'); // 'picker' | 'study' | 'summary'
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);

  function handleStart(selectedSectionIds) {
    const pool = shuffle(getCardsBySectionIds(selectedSectionIds));
    if (pool.length === 0) return;
    setCards(pool);
    setCurrentIndex(0);
    setResults([]);
    setScreen('study');
  }

  function handleGrade(grade) {
    const newResults = [...results, { cardId: cards[currentIndex].id, grade }];
    setResults(newResults);

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setScreen('summary');
    }
  }

  function handleRestart() {
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

  return <TopicPicker key={screen} onStart={handleStart} />;
}
