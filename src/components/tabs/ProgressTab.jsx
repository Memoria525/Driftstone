import { useEffect, useRef } from 'react';

export default function ProgressTab() {
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center justify-center h-full px-4">
      <p ref={headingRef} tabIndex={-1} className="text-sm text-[--color-text-muted] outline-none">
        Coming soon
      </p>
    </div>
  );
}
