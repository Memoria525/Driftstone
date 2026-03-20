import Header from './Header.jsx';
import BottomNav from './BottomNav.jsx';
import SkipLink from './SkipLink.jsx';

export default function AppShell({ activeTab, onTabChange, user, isAdmin, hideNav, children }) {
  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto bg-[--color-surface]">
      <SkipLink />
      <Header user={user} />
      <main
        id="main-content"
        className="flex-1 overflow-y-auto"
        tabIndex={-1}
      >
        {children}
      </main>
      {!hideNav && <BottomNav activeTab={activeTab} onTabChange={onTabChange} isAdmin={isAdmin} />}
    </div>
  );
}
