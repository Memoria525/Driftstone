import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function useCardNotes(user, isAdmin) {
  const [notesMap, setNotesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isAdmin) return;

    let cancelled = false;

    async function load() {
      try {
        const snap = await getDocs(collection(db, 'cardNotes'));
        if (cancelled) return;
        const map = new Map();
        for (const d of snap.docs) {
          map.set(d.id, d.data());
        }
        setNotesMap(map);
      } catch (err) {
        console.error('Failed to load card notes:', err);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  // Skip loading state when not admin
  if ((!user || !isAdmin) && loading) {
    setLoading(false);
  }

  const saveNote = useCallback(async (cardId, tags, freeText) => {
    if (!user || !isAdmin) return;

    const noteData = {
      tags,
      freeText: freeText.trim(),
      updatedAt: Timestamp.now(),
    };

    // Optimistic update
    setNotesMap(m => {
      const next = new Map(m);
      next.set(cardId, noteData);
      return next;
    });

    try {
      await setDoc(doc(db, 'cardNotes', cardId), noteData);
    } catch (err) {
      console.error('Failed to save card note:', err);
    }
  }, [user, isAdmin]);

  const deleteNote = useCallback(async (cardId) => {
    if (!user || !isAdmin) return;

    setNotesMap(m => {
      const next = new Map(m);
      next.delete(cardId);
      return next;
    });

    try {
      await deleteDoc(doc(db, 'cardNotes', cardId));
    } catch (err) {
      console.error('Failed to delete card note:', err);
    }
  }, [user, isAdmin]);

  return { notesMap, loading, saveNote, deleteNote };
}
