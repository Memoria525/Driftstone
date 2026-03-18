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
│   ├── layout/        # AppShell, Header, BottomNav, SkipLink
│   ├── tabs/          # HomeTab, DecksTab, SharingTab
│   ├── deck-builder/  # Tree-based card selector
│   ├── card-viewer/   # Flashcard study UI
│   ├── shared/        # Button, Modal, ProgressBar, etc.
│   └── modals/        # InviteModal, AccountModal, ShareChallengePanel
├── hooks/             # useFocusTrap, useFocusReturn, useTreeNavigation, useAnnounce
├── data/              # mockData.js (courses, cards, friends)
└── utils/             # treeUtils.js, a11yUtils.js
```

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4 (CSS-first config in index.css)
- No routing library (tab-based navigation)

## Accessibility Requirements

All code must meet WCAG 2.1 AA:

- **Touch targets**: Minimum 44x44px (`min-h-touch min-w-touch`)
- **Focus indicators**: Use `focus-visible:ring-2 focus-visible:ring-focus`
- **Screen reader**: Use `aria-live` for dynamic content, proper ARIA roles
- **Keyboard**: Full navigation without mouse, focus trap in modals
- **Reduced motion**: Respect `prefers-reduced-motion`

## Key Patterns

### Tree Component (Decks Tab)
- Uses `role="tree"` with `role="treeitem"` children
- Arrow key navigation (up/down/left/right)
- Cascading selection (parent selects all children)
- Search with live announcements

### Modals
- Use the `Modal` component from `shared/`
- Includes focus trap and focus return automatically
- Escape key closes

## Data Structure

```js
// Courses have nested topics/subtopics
courses = [{ id, name, totalCards, seen, correctRate, topics: { topicName: [subtopics] } }]

// Cards link to course/topic/subtopic
cards = [{ id, courseId, topic, subtopic, question, options[], correctIndex, explanation }]
```
