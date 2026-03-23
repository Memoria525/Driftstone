import { useState, useEffect } from 'react';

export default function useAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    user.getIdTokenResult().then((result) => {
      setIsAdmin(!!result.claims.admin);
    }).catch((err) => {
      console.error('Failed to check admin claim:', err);
      setIsAdmin(false);
    });
  }, [user]);

  return isAdmin;
}
