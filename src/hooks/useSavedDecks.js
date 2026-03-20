import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function useSavedDecks(user) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const snap = await getDocs(collection(db, 'users', user.uid, 'savedDecks'));
      if (cancelled) return;
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setDecks(list);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  const saveDeck = useCallback(async (name, cardIds) => {
    if (!user) return;
    const id = crypto.randomUUID();
    const deck = {
      name,
      cardIds,
      createdAt: Timestamp.now(),
    };
    const ref = doc(db, 'users', user.uid, 'savedDecks', id);
    await setDoc(ref, deck);

    const local = { id, ...deck, createdAt: new Date() };
    setDecks((prev) => [local, ...prev]);
    return id;
  }, [user]);

  const deleteDeck = useCallback(async (deckId) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'savedDecks', deckId));
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  }, [user]);

  return { decks, loading, saveDeck, deleteDeck };
}
