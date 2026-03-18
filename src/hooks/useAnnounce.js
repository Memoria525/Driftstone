import { useCallback, useRef, useEffect } from 'react';

// Creates a visually hidden aria-live region and returns an announce function.
// Call announce("message") to have screen readers read it aloud.

let liveRegion = null;

function ensureLiveRegion() {
  if (liveRegion) return liveRegion;

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'assertive');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('role', 'status');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);

  return liveRegion;
}

export default function useAnnounce() {
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const announce = useCallback((message) => {
    const region = ensureLiveRegion();
    // Clear then set after a tick so screen readers detect the change
    region.textContent = '';
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      region.textContent = message;
    }, 50);
  }, []);

  return announce;
}
