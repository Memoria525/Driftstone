# Driftstone Study Flow

A flashcard study app with WCAG 2.1 AA accessibility compliance.

## Commands

```bash
npm run dev -- --host  # Dev server (phone accessible)
npm run build          # Production build
npm run lint           # Check for errors
```

## Architecture

```
src/
├── components/
│   ├── auth/          # SignInScreen
│   ├── layout/        # AppShell, Header, BottomNav, SkipLink
│   ├── tabs/          # StudyTab, ProgressTab (placeholder), AdminTab
│   ├── card-viewer/   # CardViewer, SummaryScreen
│   └── topic-picker/  # TopicPicker (topic selection + strength dots)
├── hooks/             # useAuth, useCardState, useAdmin, useErrorLog, useReviewedCards
├── data/              # courseLoader.js (Firestore → course tree)
└── utils/             # fsrs.js (FSRS-5 scheduler), renderMarkdown.jsx
```

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4 (CSS-first config in index.css)
- Firebase Auth (Google + email/password)
- Firestore (cards collection, per-user cardState)
- FSRS-5 spaced repetition with binary grading (good/again)
- No routing library (tab-based navigation)

## Accessibility Requirements

All code must meet WCAG 2.1 AA:

- **Touch targets**: Minimum 44x44px (`min-h-touch min-w-touch`)
- **Focus indicators**: Use `focus-visible:ring-2 focus-visible:ring-[--color-focus]`
- **Screen reader**: Use `aria-label` on focusable elements, `role="img"` on indicators
- **Keyboard**: Full navigation without mouse
- **Focus management**: Use `useEffect` for post-render focus (not `requestAnimationFrame`)
- **Reduced motion**: Respect `prefers-reduced-motion` (handled in index.css)

## Key Patterns

### Topic Picker
- Hierarchical: Course > Chapter > Section with checkboxes
- Strength dots on sections (grey/red/amber/green based on retrievability x coverage)
- Due card banner at top with "Review now" shortcut
- Time picker + study mode (Smart review vs Full deck) shown after tapping Study

### Card Viewer
- Binary grading: thumbs up (good, rating 3) / thumbs down (again, rating 1)
- Timer countdown for timed sessions
- Topic breadcrumb (course > chapter > section)
- VoiceOver: focus question on mount, focus answer on reveal

### FSRS-5 Scheduling
- Stock FSRS-5 with binary grading (rating 1 = Again, rating 3 = Good)
- 25% due / 75% unseen interleaving in Smart Review mode
- Full Deck mode shuffles all cards, still grades through FSRS

## Data Structure

```js
// Firestore 'cards' collection → built into course tree by courseLoader.js
// Course > Chapter > Section > cards[]
card = { id, question, answer, hint, explanation, course, chapter, section, isPrivate }

// Firestore 'users/{uid}/cardState/{cardId}' — FSRS state per card
cardState = { difficulty, stability, due, lastReview, state, reps, lapses }
```

## CSS Theme Variables

Defined in `index.css` under `@theme`:
- `--color-brand`, `--color-brand-dark` — primary brand color
- `--color-surface`, `--color-surface-raised`, `--color-surface-sunken`
- `--color-border`, `--color-text`, `--color-text-muted`, `--color-focus`
- `--spacing-touch` (44px), `--radius-sm/md/lg`, `--font-sans`
