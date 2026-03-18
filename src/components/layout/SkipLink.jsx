export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className={[
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-2 focus:left-2 focus:z-50',
        'focus:bg-[--color-brand] focus:text-white focus:px-4 focus:py-2',
        'focus:rounded-[--radius-md] focus:text-sm focus:font-semibold',
        'focus:outline-none focus:ring-2 focus:ring-[--color-focus]',
      ].join(' ')}
    >
      Skip to main content
    </a>
  );
}
