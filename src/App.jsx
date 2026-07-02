import { useState } from 'react';
import useAuth from './hooks/useAuth.js';
import useAdmin from './hooks/useAdmin.js';
import SignInScreen from './components/auth/SignInScreen.jsx';
import AppShell from './components/layout/AppShell.jsx';
import OutcomesViewer from './components/outcomes/OutcomesViewer.jsx';
import AdminTab from './components/tabs/AdminTab.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const isAdmin = useAdmin(user);
  const [activeTab, setActiveTab] = useState('library');
  const [hideNav, setHideNav] = useState(false);
  const [hideAdmin, setHideAdmin] = useState(false);

  function handleHideAdmin() {
    setHideAdmin(true);
    setActiveTab('library');
  }

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
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user} hideNav={hideNav} isAdmin={isAdmin && !hideAdmin}>
      {activeTab === 'library' && <OutcomesViewer onReading={setHideNav} />}
      {activeTab === 'admin' && <AdminTab user={user} isAdmin={isAdmin} onHideAdmin={handleHideAdmin} onReviewing={setHideNav} />}
    </AppShell>
  );
}
