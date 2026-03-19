import { useState } from 'react';
import useAuth from './hooks/useAuth.js';
import SignInScreen from './components/auth/SignInScreen.jsx';
import AppShell from './components/layout/AppShell.jsx';
import StudyTab from './components/tabs/StudyTab.jsx';
import ProgressTab from './components/tabs/ProgressTab.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('study');

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
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user}>
      {activeTab === 'study' && <StudyTab />}
      {activeTab === 'progress' && <ProgressTab />}
    </AppShell>
  );
}
