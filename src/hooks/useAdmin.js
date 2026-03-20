import { useState, useEffect } from 'react';

/**
 * Reads the `admin` custom claim from the current user's ID token.
 * Returns { isAdmin: boolean, loading: boolean }.
 * Re-runs when the user object changes.
 */
export default function useAdmin(user) {
  const [result, setResult] = useState({ isAdmin: false, loading: !!user });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    user.getIdTokenResult().then((tokenResult) => {
      if (!cancelled) {
        setResult({ isAdmin: tokenResult.claims.admin === true, loading: false });
      }
    }).catch(() => {
      if (!cancelled) {
        setResult({ isAdmin: false, loading: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // When there's no user, derive state directly
  if (!user) {
    return { isAdmin: false, loading: false };
  }

  return result;
}
