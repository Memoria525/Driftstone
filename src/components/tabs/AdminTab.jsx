import { useState, useEffect, useRef, useMemo } from 'react';
import { loadCourses } from '../../data/courseLoader.js';
import { searchCards, highlightMatches } from '../../utils/search.js';
import useAnnounce from '../../hooks/useAnnounce.js';
import useAuth from '../../hooks/useAuth.js';
import useCardState from '../../hooks/useCardState.js';
import useSavedDecks from '../../hooks/useSavedDecks.js';
import CardViewer from '../card-viewer/CardViewer.jsx';
import SummaryScreen from '../card-viewer/SummaryScreen.jsx';
import { scheduleCard, sortByPriority, createEmptyCardState, GRADE_TO_RATING } from '../../utils/fsrs.js';

function getAllCards(courses) {
  const cards = [];
  for (const course of courses) {
    for (const chapter of course.chapters) {
      for (const section of chapter.sections) {
        for (const card of section.cards) {
          cards.push({
            ...card,
            courseName: course.name,
            chapterName: chapter.name,
            sectionName: section.name,
          });
        }
      }
    }
  }
  return cards;
}

function HighlightedText({ text, query }) {
  const segments = highlightMatches(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className="bg-yellow-200 text-[--color-text] rounded px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

const FIELD_LABELS = {
  question: 'Question',
  answer: 'Answer',
  hint: 'Hint',
  explanation: 'Explanation',
};

function SearchResult({ result, query, isExpanded, onToggle }) {
  const { card, matchedFields } = result;

  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={[
          'w-full text-left px-4 py-3 min-h-touch',
          'border-b border-[--color-border]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] focus-visible:ring-inset',
          'hover:bg-[--color-surface-sunken] transition-colors',
        ].join(' ')}
      >
        <p className="text-sm font-medium text-[--color-text] line-clamp-2">
          <HighlightedText text={card.question} query={query} />
        </p>
        <p className="text-xs text-[--color-text-muted] mt-1">
          {card.courseName} › {card.chapterName} › {card.sectionName}
        </p>
        <div className="flex gap-1 mt-1">
          {matchedFields.map((f) => (
            <span
              key={f}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-[--color-brand]/10 text-[--color-brand] font-medium"
            >
              {FIELD_LABELS[f]}
            </span>
          ))}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-[--color-surface-sunken] border-b border-[--color-border] space-y-3">
          {['question', 'answer', 'hint', 'explanation'].map((field) => {
            const text = card[field];
            if (!text) return null;
            return (
              <div key={field}>
                <p className="text-xs font-medium text-[--color-text-muted] mb-0.5">
                  {FIELD_LABELS[field]}
                </p>
                <p className="text-sm text-[--color-text]">
                  <HighlightedText text={text} query={query} />
                </p>
              </div>
            );
          })}
          <p className="text-xs text-[--color-text-muted] font-mono">{card.id}</p>
        </div>
      )}
    </li>
  );
}

export default function AdminTab({ onStudying }) {
  const { user } = useAuth();
  const { stateMap, saveCardState } = useCardState(user);
  const { saveDeck } = useSavedDecks(user);
  const [allCards, setAllCards] = useState([]);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [screen, setScreen] = useState('search'); // 'search' | 'study' | 'summary'

  useEffect(() => {
    onStudying?.(screen === 'study');
  }, [screen, onStudying]);
  const [studyCards, setStudyCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [studyResults, setStudyResults] = useState([]);
  const [savingDeck, setSavingDeck] = useState(false);
  const inputRef = useRef(null);
  const announce = useAnnounce();

  useEffect(() => {
    loadCourses().then((courses) => {
      setAllCards(getAllCards(courses));
    });
  }, []);

  const results = useMemo(() => searchCards(allCards, query), [allCards, query]);

  // Announce result count after typing pauses
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      announce(`${results.length} card${results.length === 1 ? '' : 's'} found`);
    }, 500);
    return () => clearTimeout(timer);
  }, [results.length, query, announce]);

  function handleClear() {
    setQuery('');
    setExpandedId(null);
    inputRef.current?.focus();
  }

  function handleCreateDeck() {
    const cards = sortByPriority(
      results.map((r) => r.card),
      stateMap
    );
    if (cards.length === 0) return;
    setStudyCards(cards);
    setCurrentIndex(0);
    setStudyResults([]);
    setScreen('study');
  }

  function handleGrade(grade) {
    const card = studyCards[currentIndex];
    const newResults = [...studyResults, { cardId: card.id, grade }];
    setStudyResults(newResults);

    const rating = GRADE_TO_RATING[grade];
    const currentState = stateMap.get(card.id) || createEmptyCardState(card.id);
    const newState = scheduleCard(currentState, rating);
    saveCardState(card.id, newState);

    if (currentIndex + 1 < studyCards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setScreen('summary');
    }
  }

  function handleBackToSearch() {
    setScreen('search');
  }

  async function handleSaveDeck() {
    const name = prompt('Deck name:');
    if (!name || !name.trim()) return;
    setSavingDeck(true);
    const cardIds = results.map((r) => r.card.id);
    await saveDeck(name.trim(), cardIds);
    setSavingDeck(false);
    announce(`Deck "${name.trim()}" saved with ${cardIds.length} cards`);
  }

  // Study screen
  if (screen === 'study' && studyCards.length > 0) {
    return (
      <CardViewer
        card={studyCards[currentIndex]}
        index={currentIndex}
        total={studyCards.length}
        onGrade={handleGrade}
        onDone={() => setScreen('summary')}
        isAdmin
      />
    );
  }

  // Summary screen
  if (screen === 'summary') {
    return (
      <SummaryScreen
        results={studyResults}
        total={studyCards.length}
        onRestart={handleBackToSearch}
      />
    );
  }

  // Search screen
  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-4 pt-4 pb-2">
        <label htmlFor="admin-search" className="text-sm font-semibold text-[--color-text] mb-2 block">
          Search Cards
        </label>
        <div className="relative">
          <input
            id="admin-search"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpandedId(null);
            }}
            placeholder="Search questions, answers, hints, explanations…"
            autoComplete="off"
            className={[
              'w-full rounded-[--radius-md] border border-[--color-border] px-3 py-2 pr-10 text-sm',
              'bg-[--color-surface] text-[--color-text] placeholder:text-[--color-text-muted]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
            ].join(' ')}
          />
          {query && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className={[
                'absolute right-1 top-1/2 -translate-y-1/2',
                'min-h-touch min-w-touch flex items-center justify-center',
                'text-[--color-text-muted] hover:text-[--color-text]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] rounded',
              ].join(' ')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results count and Create deck button */}
      {query.trim() && (
        <div className="px-4 py-1 flex items-center justify-between">
          <p className="text-xs text-[--color-text-muted]" aria-live="polite">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>
          {results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleSaveDeck}
                disabled={savingDeck}
                className={[
                  'text-xs font-semibold px-3 min-h-touch flex items-center rounded-[--radius-md]',
                  'border border-[--color-brand] text-[--color-brand] hover:bg-[--color-brand]/10 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                  savingDeck ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {savingDeck ? 'Saving…' : 'Save deck'}
              </button>
              <button
                onClick={handleCreateDeck}
                className={[
                  'text-xs font-semibold px-3 min-h-touch flex items-center rounded-[--radius-md]',
                  'text-white bg-[--color-brand] hover:bg-[--color-brand-dark] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
                ].join(' ')}
              >
                Study {results.length} card{results.length === 1 ? '' : 's'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      <ul role="list" className="flex-1 overflow-y-auto">
        {results.map((result) => (
          <SearchResult
            key={result.card.id}
            result={result}
            query={query}
            isExpanded={expandedId === result.card.id}
            onToggle={() =>
              setExpandedId(expandedId === result.card.id ? null : result.card.id)
            }
          />
        ))}

        {query.trim() && results.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-[--color-text-muted]">
            No cards match &ldquo;{query}&rdquo;
          </li>
        )}
      </ul>
    </div>
  );
}
