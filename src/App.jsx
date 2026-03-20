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
  const isAdmin = useAdmin(user);
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
    <AppShell activeTab={activeTab} onTabChange={setActiveTab} user={user} isAdmin={isAdmin}>
      {activeTab === 'study' && <StudyTab />}
      {activeTab === 'progress' && <ProgressTab />}
      {activeTab === 'admin' && (
        <Suspense fallback={<p className="p-4 text-sm text-[--color-text-muted]">Loading…</p>}>
          <AdminTab />
        </Suspense>
      )}
    </AppShell>
  );
}
