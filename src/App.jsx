import { useState, useMemo } from 'react';
import useAuth from './hooks/useAuth.js';
import useCardState from './hooks/useCardState.js';
import useAdmin from './hooks/useAdmin.js';
import SignInScreen from './components/auth/SignInScreen.jsx';
import AppShell from './components/layout/AppShell.jsx';
import StudyTab from './components/tabs/StudyTab.jsx';
import ProgressTab from './components/tabs/ProgressTab.jsx';
import AdminTab from './components/tabs/AdminTab.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const { stateMap, saveCardState } = useCardState(user);
  const isAdmin = useAdmin(user);
  const [activeTab, setActiveTab] = useState('study');
  const [hideNav, setHideNav] = useState(false);
  const [hideAdmin, setHideAdmin] = useState(false);

  function handleHideAdmin() {
    setHideAdmin(true);
    setActiveTab('study');
  }

  const dueCount = useMemo(() => {
    const now = new Date();
    let count = 0;
    for (const [, s] of stateMap) {
      if (s.state !== 'new' && s.due <= now) count++;
    }
    return count;
  }, [stateMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[--color-surface]">
        <p className="text-[--color-text-muted]" role="status">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user} hideNav={hideNav} dueCount={dueCount} isAdmin={isAdmin && !hideAdmin}>
      {activeTab === 'study' && <StudyTab onStudying={setHideNav} stateMap={stateMap} saveCardState={saveCardState} dueCount={dueCount} isAdmin={isAdmin} hideAdmin={hideAdmin} />}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'admin' && <AdminTab user={user} isAdmin={isAdmin} onHideAdmin={handleHideAdmin} onReviewing={setHideNav} />}
    </AppShell>
  );
}
