import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_MAP = new Map();

export default function useCardState(user) {
  const [stateMap, setStateMap] = useState(EMPTY_MAP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      const snap = await getDocs(
        collection(db, 'users', user.uid, 'cardState')
      );
      if (cancelled) return;

      const map = new Map();
      for (const d of snap.docs) {
        const data = d.data();
        map.set(d.id, {
          cardId: d.id,
          difficulty: data.difficulty,
          stability: data.stability,
          due: data.due?.toDate() ?? new Date(0),
          lastReview: data.lastReview?.toDate() ?? null,
          state: data.state,
          reps: data.reps,
          lapses: data.lapses,
        });
      }
      setStateMap(map);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const saveCardState = useCallback(async (cardId, cardState) => {
    if (!user) return;

    // Snapshot previous value for rollback
    const prev = stateMap.get(cardId);

    // Optimistic local update
    setStateMap(m => {
      const next = new Map(m);
      next.set(cardId, cardState);
      return next;
    });

    // Persist to Firestore
    try {
      const ref = doc(db, 'users', user.uid, 'cardState', cardId);
      await setDoc(ref, {
        difficulty: cardState.difficulty,
        stability: cardState.stability,
        due: Timestamp.fromDate(cardState.due),
        lastReview: cardState.lastReview ? Timestamp.fromDate(cardState.lastReview) : null,
        state: cardState.state,
        reps: cardState.reps,
        lapses: cardState.lapses,
      });
    } catch (err) {
      console.error('Failed to save card state:', err);
      // Roll back optimistic update
      setStateMap(m => {
        const next = new Map(m);
        if (prev) next.set(cardId, prev);
        else next.delete(cardId);
        return next;
      });
    }
  }, [user, stateMap]);

  return { stateMap, loading, saveCardState };
}
