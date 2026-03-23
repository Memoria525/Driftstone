import { useState } from 'react';
import useAuth from './hooks/useAuth.js';
import useCardState from './hooks/useCardState.js';
import SignInScreen from './components/auth/SignInScreen.jsx';
import AppShell from './components/layout/AppShell.jsx';
import StudyTab from './components/tabs/StudyTab.jsx';
import ProgressTab from './components/tabs/ProgressTab.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const { stateMap, loading: stateLoading, saveCardState } = useCardState(user);
  const [activeTab, setActiveTab] = useState('study');
  const [hideNav, setHideNav] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-[--color-surface]">
        <p className="text-[--color-text-secondary]" role="status">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user} hideNav={hideNav}>
      {activeTab === 'study' && <StudyTab onStudying={setHideNav} stateMap={stateMap} saveCardState={saveCardState} />}
      {activeTab === 'progress' && <ProgressTab stateMap={stateMap} stateLoading={stateLoading} />}
    </AppShell>
  );
}
