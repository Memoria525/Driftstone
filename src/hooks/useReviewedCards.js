import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function useReviewedCards(user, isAdmin) {
  const [reviewedMap, setReviewedMap] = useState(new Map());
  const shouldLoad = !!(user && isAdmin);
  const [loading, setLoading] = useState(shouldLoad);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    async function load() {
      try {
        const snap = await getDocs(collection(db, 'reviewed_cards'));
        if (cancelled) return;
        const map = new Map();
        for (const d of snap.docs) {
          map.set(d.id, d.data());
        }
        setReviewedMap(map);
      } catch (err) {
        console.error('Failed to load reviewed cards:', err);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [shouldLoad]);

  const saveReview = useCallback(async (cardId, status, issues = []) => {
    if (!user || !isAdmin) return;

    const data = {
      cardId,
      status,
      issues,
      reviewedAt: Timestamp.now(),
    };

    // Optimistic update
    setReviewedMap(m => {
      const next = new Map(m);
      next.set(cardId, data);
      return next;
    });

    try {
      await setDoc(doc(db, 'reviewed_cards', cardId), data);
    } catch (err) {
      console.error('Failed to save review:', err);
    }
  }, [user, isAdmin]);

  return { reviewedMap, loading, saveReview };
}
