import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function useInspirations(user, isAdmin) {
  const [inspirations, setInspirations] = useState([]);
  const shouldLoad = !!(user && isAdmin);
  const [loading, setLoading] = useState(shouldLoad);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    async function load() {
      try {
        const snap = await getDocs(collection(db, 'inspirations'));
        if (cancelled) return;
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setInspirations(list);
      } catch (err) {
        console.error('Failed to load inspirations:', err);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [shouldLoad]);

  const saveInspiration = useCallback(async (text) => {
    if (!user || !isAdmin) return;

    const data = { text, createdAt: Timestamp.now() };
    const tempId = `temp_${Date.now()}`;

    // Optimistic prepend
    setInspirations(prev => [{ id: tempId, ...data }, ...prev]);

    try {
      const ref = await addDoc(collection(db, 'inspirations'), data);
      setInspirations(prev => prev.map(i => i.id === tempId ? { ...i, id: ref.id } : i));
    } catch (err) {
      console.error('Failed to save inspiration:', err);
      setInspirations(prev => prev.filter(i => i.id !== tempId));
    }
  }, [user, isAdmin]);

  const deleteInspiration = useCallback(async (id) => {
    if (!user || !isAdmin) return;

    // Optimistic remove
    setInspirations(prev => prev.filter(i => i.id !== id));

    try {
      await deleteDoc(doc(db, 'inspirations', id));
    } catch (err) {
      console.error('Failed to delete inspiration:', err);
    }
  }, [user, isAdmin]);

  return { inspirations, loading, saveInspiration, deleteInspiration };
}
