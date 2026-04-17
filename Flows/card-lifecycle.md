# Card Lifecycle

A card's journey from upload to student-facing study material.

## 1. Upload (Batch Paste)

A JSON array of arrays is pasted into **Admin > Batch Upload**:

```json
[["What is the femur?", "The thigh bone", "Longest bone in the body..."]]
```

`parseCardJson` maps indices to fields:
- `entry[0]` -> `question`
- `entry[1]` -> `answer`
- `entry[2]` -> `explanation`

## 2. Written to Firestore

A course/chapter/section location is selected. A doc is created in the `cards` collection:

```js
{
  question: "What is the femur?",
  answer: "The thigh bone",
  explanation: "Longest bone in the body...",
  courseId: "abc123",
  chapterId: "def456",
  sectionId: "ghi789",
  cardType: "sa",
  isPrivate: true   // born private, invisible to students
}
```

## 3. Loaded into the Course Tree

`courseLoader.js` loads all four collections (courses, chapters, sections, cards) and nests cards into their parent sections. The card object is trimmed to:

```js
{
  id: "auto-generated-doc-id",
  question, answer, explanation,
  isPrivate: true,
  cardType: "sa"
}
```

## 4. Appears in Card Review

In the Admin TopicPicker, section counts show reviewed/total. Sections are selected and a review session starts. `getCardsBySectionIds` walks the tree and attaches display names (`courseName`, `chapterName`, `sectionName`). Cards already in `reviewedMap` are filtered out.

## 5. Reviewed

The card is displayed in `CardReviewViewer`. Three outcomes:

- **Accept** -> `isPrivate` is set to `false` on the Firestore card doc, and a `reviewed_cards` doc is written: `{ cardId, status: 'accepted', issues: [], reviewedAt }`
- **Issues** -> `isPrivate` stays `true`, and a `reviewed_cards` doc is written: `{ cardId, status: 'issues', issues: ['Question'], reviewedAt }`
- **Edit then Accept** -> Card fields are updated in Firestore first, then accepted as above

## 6. Published and Live

Two gates must both be open for a card to be student-facing:

1. **Card level:** `isPrivate` must be `false` on the card itself (set by accepting during review)
2. **Course level:** `isPrivate` must be `false` on the course (set in Admin > Course Settings)

`loadCoursesForUser` enforces both: `filterPublishedCards` strips private cards (and prunes empty sections/chapters), then `filterPrivateCourses` strips entire private courses.

## 7. Studied via FSRS-5

Once visible, the card enters the FSRS-5 spaced repetition scheduler. On first encounter it is "unseen." After grading (thumbs up or thumbs down), a `cardState` doc is created at `users/{uid}/cardState/{cardId}`:

```js
{
  difficulty, stability, due, lastReview,
  state,   // 0=new -> 1=learning -> 2=review
  reps, lapses
}
```

From that point on, FSRS-5 schedules when the card is due again based on the student's performance.
