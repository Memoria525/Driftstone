import { useState, useEffect } from 'react';

export default function useAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    user.getIdTokenResult()
      .then((result) => { if (!cancelled) setIsAdmin(!!result.claims.admin); })
      .catch(() => { if (!cancelled) setIsAdmin(false); });

    return () => {
      cancelled = true;
      setIsAdmin(false);
    };
  }, [user]);

  return isAdmin;
}
