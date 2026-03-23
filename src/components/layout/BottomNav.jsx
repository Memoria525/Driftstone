const tabs = [
  {
    id: 'study',
    label: 'Study',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export default function BottomNav({ activeTab, onTabChange, dueCount = 0 }) {
  return (
    <nav
      aria-label="Main navigation"
      className="bg-white border-t border-[--color-border] flex"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const badge = tab.id === 'study' && dueCount > 0 ? dueCount : null;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={badge ? `${tab.label}, ${badge} cards due` : undefined}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 min-h-touch py-2 relative',
              'text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] focus-visible:ring-inset',
              isActive
                ? 'text-[--color-brand]'
                : 'text-[--color-text-muted] hover:text-[--color-text]',
            ].join(' ')}
          >
            <span className="relative">
              {tab.icon}
              {badge && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
