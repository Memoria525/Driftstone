import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import useAnnounce from '../../hooks/useAnnounce.js';

const MENU_ITEMS = [
  { id: 'toggle-private', getLabel: (review) => review.isPrivate ? 'Make public' : 'Make private' },
  { id: 'flag-needs-editing', label: 'Flag: needs editing' },
  { id: 'flag-rejected', label: 'Flag: rejected' },
  { id: 'clear-flag', label: 'Clear flag' },
];

const EMPTY_REVIEW = { isPrivate: false, adminFlag: null };

export default function AdminCardMenu({ card, userId }) {
  const [open, setOpen] = useState(false);
  const [reviewState, setReviewState] = useState({ data: EMPTY_REVIEW, loaded: false, cardId: null });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const itemsRef = useRef([]);
  const announce = useAnnounce();

  // Derive review and loaded from state, resetting when card.id changes
  const loaded = reviewState.loaded && reviewState.cardId === card.id;
  const review = reviewState.cardId === card.id ? reviewState.data : EMPTY_REVIEW;

  // Fetch current review state when card changes
  useEffect(() => {
    let cancelled = false;

    getDoc(doc(db, 'cardReviews', card.id)).then((snap) => {
      if (cancelled) return;
      if (snap.exists()) {
        const data = snap.data();
        setReviewState({
          data: { isPrivate: data.isPrivate ?? false, adminFlag: data.adminFlag ?? null },
          loaded: true,
          cardId: card.id,
        });
      } else {
        setReviewState({ data: EMPTY_REVIEW, loaded: true, cardId: card.id });
      }
    }).catch(() => {
      if (!cancelled) setReviewState({ data: EMPTY_REVIEW, loaded: true, cardId: card.id });
    });

    return () => { cancelled = true; };
  }, [card.id]);

  // Close menu on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Focus first menu item when opening
  useEffect(() => {
    if (open && itemsRef.current[0]) {
      itemsRef.current[0].focus();
    }
  }, [open]);

  const writeReview = useCallback(async (updates) => {
    const newReview = { ...review, ...updates };
    setReviewState({ data: newReview, loaded: true, cardId: card.id });

    await setDoc(doc(db, 'cardReviews', card.id), {
      isPrivate: newReview.isPrivate,
      adminFlag: newReview.adminFlag,
      reviewedBy: userId,
      reviewedAt: new Date(),
    });
  }, [review, card.id, userId]);

  function handleAction(itemId) {
    switch (itemId) {
      case 'toggle-private': {
        const newPrivate = !review.isPrivate;
        writeReview({ isPrivate: newPrivate });
        announce(newPrivate ? 'Card marked as private' : 'Card marked as public');
        break;
      }
      case 'flag-needs-editing':
        writeReview({ adminFlag: 'needs_editing' });
        announce('Card flagged as needs editing');
        break;
      case 'flag-rejected':
        writeReview({ adminFlag: 'rejected' });
        announce('Card flagged as rejected');
        break;
      case 'clear-flag':
        writeReview({ adminFlag: null });
        announce('Flag cleared');
        break;
    }
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(e) {
    const items = itemsRef.current.filter(Boolean);
    const currentIdx = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
        items[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
        items[prev]?.focus();
        break;
      }
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  if (!loaded) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Card admin menu"
        className={[
          'min-h-touch min-w-touch flex items-center justify-center rounded',
          'text-[--color-text-muted] hover:text-[--color-text] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus]',
        ].join(' ')}
      >
        {/* Gear icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Card admin actions"
          onKeyDown={handleKeyDown}
          className={[
            'absolute right-0 top-full mt-1 z-50 w-52',
            'rounded-[--radius-md] border border-[--color-border]',
            'bg-[--color-surface] shadow-lg',
            'py-1',
          ].join(' ')}
        >
          {MENU_ITEMS.map((item, idx) => {
            const label = item.getLabel ? item.getLabel(review) : item.label;
            const isActive =
              (item.id === 'flag-needs-editing' && review.adminFlag === 'needs_editing') ||
              (item.id === 'flag-rejected' && review.adminFlag === 'rejected') ||
              (item.id === 'toggle-private' && review.isPrivate);

            return (
              <button
                key={item.id}
                ref={(el) => { itemsRef.current[idx] = el; }}
                role="menuitem"
                onClick={() => handleAction(item.id)}
                className={[
                  'w-full text-left px-3 py-2 text-sm min-h-touch flex items-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[--color-focus]',
                  'hover:bg-[--color-surface-sunken] transition-colors',
                  isActive ? 'text-[--color-brand] font-medium' : 'text-[--color-text]',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
