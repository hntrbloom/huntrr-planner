import { DialogAccessibility } from './components/DialogAccessibility';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { House, NotebookPen, Settings } from 'lucide-react';
import { CatPlannerHeader } from './components/CatPlannerHeader';
import { Sidebar } from './components/Navigation';
import { ViewState } from './types';
import { db } from './lib/firebase';
import { doc, onSnapshot } from './lib/workspaceStore';
import { useProfile } from './lib/ProfileContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FocusTimer } from './components/FocusTimer';
import { MedicationPopup } from './components/MedicationPopup';
import { isLocalUser } from './lib/workspaceMode';
import { StorageNotice } from './components/StorageNotice';
import { TabletFrame } from './components/TabletFrame';
const JobApplicationsView = lazy(() => import('./components/JobApplicationsView').then(m => ({ default: m.JobApplicationsView })));
const RemindersView = lazy(() => import('./components/RemindersView').then(m => ({ default: m.RemindersView })));
const InspirationView = lazy(() => import('./components/InspirationView').then(m => ({ default: m.InspirationView })));
const AgendaView = lazy(() => import('./components/AgendaView').then(m => ({ default: m.AgendaView })));
const NotesView = lazy(() => import('./components/NotesView').then(m => ({ default: m.NotesView })));
const HabitsView = lazy(() => import('./components/HabitsView').then(m => ({ default: m.HabitsView })));
const DailyLogView = lazy(() => import('./components/DailyLogView').then(m => ({ default: m.DailyLogView })));
const MonthlyView = lazy(() => import('./components/MonthlyView').then(m => ({ default: m.MonthlyView })));
const PrintingCatalogView = lazy(() => import('./components/PrintingCatalogView').then(m => ({ default: m.PrintingCatalogView })));
const StreaksView = lazy(() => import('./components/StreaksView').then(m => ({ default: m.StreaksView })));
const CharacterWikiView = lazy(() => import('./components/CharacterWikiView').then(m => ({ default: m.CharacterWikiView })));
const MiniFurnitureView = lazy(() => import('./components/MiniFurnitureView').then(m => ({ default: m.MiniFurnitureView })));
const BlogView = lazy(() => import('./components/BlogView').then(m => ({ default: m.BlogView })));
const GoalsView = lazy(() => import('./components/GoalsView').then(m => ({ default: m.GoalsView })));
const GoalsAndStreaksView = lazy(() => import('./components/GoalsAndStreaksView').then(m => ({ default: m.GoalsAndStreaksView })));
const KeychainsView = lazy(() => import('./components/KeychainsView').then(m => ({ default: m.KeychainsView })));
const ClientReceiptsView = lazy(() => import('./components/ClientReceiptsView').then(m => ({ default: m.ClientReceiptsView })));
const ShoppingListsView = lazy(() => import('./components/ShoppingListsView').then(m => ({ default: m.ShoppingListsView })));
const ModelViewerView = lazy(() => import('./components/ModelViewerView').then(m => ({ default: m.ModelViewerView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

export default function App() {
  const { user, profile } = useProfile();

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'global'), (snap) => {
      if (snap.exists() && snap.data().backgroundColor) {
        document.body.style.backgroundColor = '#FFF5F9';
      } else {
        document.body.style.backgroundColor = '#FFF5F9';
      }
    }, (err) => console.error("Global pref fetch error:", err));
    return () => unsub();
  }, [user]);
  
  const [currentView, setCurrentView] = useState<ViewState>(() => { const view = window.location.hash.slice(1); return ['agenda','log','shopping','receipts','habits','minifurniture','models','wiki','goals_streaks','month','notes','blog','settings','jobs','reminders','pinterest','printing','keychains'].includes(view) ? view as ViewState : 'agenda'; });
  useEffect(() => {
    window.location.hash = currentView;
    document.title = `huntrr.organizer · ${currentView.replaceAll('_', ' ')}`;
  }, [currentView]);
  useEffect(() => {
    const change = () => { const view = window.location.hash.slice(1) as ViewState; if (view) setCurrentView(view); };
    window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change);
  }, []);
  const [goalsStreaksSection, setGoalsStreaksSection] = useState<'goals' | 'streaks' | undefined>(undefined);

  const handleViewChange = (v: ViewState) => {
    if (v === 'goals') {
      setGoalsStreaksSection('goals');
      setCurrentView('goals_streaks');
    } else if (v === 'streaks') {
      setGoalsStreaksSection('streaks');
      setCurrentView('goals_streaks');
    } else {
      setCurrentView(v);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const closeMobileMenu = () => { if (media.matches) setIsSidebarOpen(false); };
    media.addEventListener('change', closeMobileMenu);
    return () => media.removeEventListener('change', closeMobileMenu);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'agenda':
        return <AgendaView onNavigate={handleViewChange} />;
      case 'habits':
        return <HabitsView />;
      case 'goals_streaks':
        return (
          <GoalsAndStreaksView 
            initialSection={goalsStreaksSection} 
            onSectionChange={(sec) => setGoalsStreaksSection(sec)} 
          />
        );
      case 'goals':
        return (
          <GoalsAndStreaksView 
            initialSection="goals" 
            onSectionChange={(sec) => setGoalsStreaksSection(sec)} 
          />
        );
      case 'streaks':
        return (
          <GoalsAndStreaksView 
            initialSection="streaks" 
            onSectionChange={(sec) => setGoalsStreaksSection(sec)} 
          />
        );
      case 'jobs': return <JobApplicationsView />;
      case 'reminders': return <RemindersView />;
      case 'pinterest': return <InspirationView />;
      case 'keychains': return <KeychainsView />;
      case 'minifurniture':
        return <MiniFurnitureView />;
      case 'models':
        return <ModelViewerView />;
      case 'log':
        return <DailyLogView />;
      case 'shopping':
        return <ShoppingListsView />;
      case 'receipts':
        return <ClientReceiptsView />;
      case 'month':
        return <MonthlyView />;
      case 'notes':
        return <NotesView />;
      case 'printing':
        return <PrintingCatalogView />;
      case 'wiki':
        return <CharacterWikiView />;
      case 'blog':
        return <BlogView />;
      case 'settings':
        return <SettingsView />;
      case 'charts': return <StreaksView />;
      default:
        return <AgendaView onNavigate={handleViewChange} />;
    }
  };

  return (
    <div data-local-workspace={user?.isAnonymous || isLocalUser(user) ? 'true' : undefined} className="app-container planner-world text-on-surface font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container">
      <CatPlannerHeader
        currentView={currentView}
        onChangeView={handleViewChange}
        menuOpen={isSidebarOpen}
        onOpenMenu={() => setIsSidebarOpen(true)}
        workspaceLabel={profile?.nickname ?? 'Local profile'}
      />
      <StorageNotice />
      <DialogAccessibility />
      <MedicationPopup />
      
      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <a className="planner-skip-link" href="#planner-content" onClick={event => { event.preventDefault(); document.getElementById('planner-content')?.focus(); }}>Skip to planner page</a>
      <TabletFrame
        footer={
          <footer className="device-bottom">
            <div className="device-controls">
              <button onClick={() => handleViewChange('agenda')} aria-label="Go home" title="Home"><House size={16} /></button>
              <button onClick={() => handleViewChange('notes')} aria-label="Open notebook" title="Notebook"><NotebookPen size={16} /></button>
              <button onClick={() => handleViewChange('settings')} aria-label="Open settings" title="Settings"><Settings size={16} /></button>
            </div>
            <div className="device-meta">
              <span className="device-model">little plans.</span>
              <FocusTimer />
            </div>
          </footer>
        }
      >
        <div id="planner-content" tabIndex={-1} data-page={currentView} className="planner-page">
          <ErrorBoundary key={currentView}>
            <Suspense fallback={<div role="status" className="p-10 text-on-surface-variant">Loading your space…</div>}>{renderView()}</Suspense>
          </ErrorBoundary>
        </div>
      </TabletFrame>
    </div>
  );
}
