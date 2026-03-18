import { useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import StudyTab from './components/tabs/StudyTab.jsx';
import ProgressTab from './components/tabs/ProgressTab.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('study');

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'study' && <StudyTab />}
      {activeTab === 'progress' && <ProgressTab />}
    </AppShell>
  );
}
