import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Logs failed Firestore writes to an 'errors' collection.
 * Any authenticated user can write (logging their own failure).
 * Only admin can read/delete.
 */

/** Fire-and-forget error logger — used by any user */
export async function logWriteError(userId, cardId, errorMessage) {
  try {
    const errorId = `${userId}_${cardId}_${Date.now()}`;
    await setDoc(doc(db, 'errors', errorId), {
      userId,
      cardId,
      errorMessage,
      timestamp: Timestamp.now(),
    });
  } catch {
    // If even the error log fails, just give up
  }
}

/** Admin hook — reads and manages the errors collection */
export default function useErrorLog(user, isAdmin) {
  const [errors, setErrors] = useState([]);
  const shouldLoad = !!(user && isAdmin);
  const [loading, setLoading] = useState(shouldLoad);

  useEffect(() => {
    if (!shouldLoad) return;

    let cancelled = false;

    async function load() {
      try {
        const q = query(
          collection(db, 'errors'),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toDate() ?? new Date(),
        }));
        setErrors(list);
      } catch (err) {
        console.error('Failed to load error log:', err);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [shouldLoad]);

  const clearAll = useCallback(async () => {
    if (!user || !isAdmin) return;
    try {
      const snap = await getDocs(collection(db, 'errors'));
      const deletes = snap.docs.map(d => deleteDoc(doc(db, 'errors', d.id)));
      await Promise.all(deletes);
      setErrors([]);
    } catch (err) {
      console.error('Failed to clear errors:', err);
    }
  }, [user, isAdmin]);

  return { errors, loading, clearAll };
}
