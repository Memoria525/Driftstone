import { useState, lazy, Suspense } from 'react';
import useAuth from './hooks/useAuth.js';
import useAdmin from './hooks/useAdmin.js';
import SignInScreen from './components/auth/SignInScreen.jsx';
import AppShell from './components/layout/AppShell.jsx';
import StudyTab from './components/tabs/StudyTab.jsx';
import ProgressTab from './components/tabs/ProgressTab.jsx';

const AdminTab = lazy(() => import('./components/tabs/AdminTab.jsx'));

export default function App() {
  const { user, loading } = useAuth();
  const isAdminClaim = useAdmin(user);
  const [adminHidden, setAdminHidden] = useState(false);
  const isAdmin = isAdminClaim && !adminHidden;
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
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user} isAdmin={isAdmin} hideNav={hideNav}>
      {activeTab === 'study' && <StudyTab onStudying={setHideNav} />}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'admin' && (
        <Suspense fallback={<p className="p-4 text-sm text-[--color-text-muted]">Loading…</p>}>
          <AdminTab onStudying={setHideNav} onHideAdmin={() => { setAdminHidden(true); setActiveTab('study'); }} />
        </Suspense>
      )}
    </AppShell>
  );
}
