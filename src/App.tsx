import { DialogAccessibility } from './components/DialogAccessibility';
import { useState, useEffect, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Grid2X2, House, Settings } from 'lucide-react';
import { Sidebar, plannerPageOrder } from './components/Navigation';
import { ViewState } from './types';
import { db } from './lib/firebase';
import { doc, onSnapshot } from './lib/workspaceStore';
import { useProfile } from './lib/ProfileContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FocusTimer } from './components/FocusTimer';
import { MedicationPopup } from './components/MedicationPopup';
import { isLocalUser } from './lib/workspaceMode';
import { StorageNotice } from './components/StorageNotice';
import { ProfileWelcome } from './components/ProfileWelcome';
import { RetroPlannerShell } from './components/RetroPlannerShell';
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
const GoalsAndStreaksView = lazy(() => import('./components/GoalsAndStreaksView').then(m => ({ default: m.GoalsAndStreaksView })));
const KeychainsView = lazy(() => import('./components/KeychainsView').then(m => ({ default: m.KeychainsView })));
const ClientReceiptsView = lazy(() => import('./components/ClientReceiptsView').then(m => ({ default: m.ClientReceiptsView })));
const ShoppingListsView = lazy(() => import('./components/ShoppingListsView').then(m => ({ default: m.ShoppingListsView })));
const ModelViewerView = lazy(() => import('./components/ModelViewerView').then(m => ({ default: m.ModelViewerView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

function pageFromHash(): ViewState {
  const page = window.location.hash.slice(1) as ViewState;
  return plannerPageOrder.includes(page) || page === 'goals' || page === 'streaks' || page === 'charts' ? page : 'agenda';
}

export default function App() {
  const { user, profile, storageError } = useProfile();

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
  
  const [currentView, setCurrentView] = useState(pageFromHash);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  useEffect(() => {
    if (!profile) return;
    window.location.hash = currentView;
    document.title = `huntrr.organizer · ${currentView.replaceAll('_', ' ')}`;
  }, [currentView, profile]);
  useEffect(() => {
    const change = () => {
      setCurrentView(pageFromHash());
      setIsSidebarOpen(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const [goalsStreaksSection, setGoalsStreaksSection] = useState<'goals' | 'streaks' | undefined>(undefined);

  const handleViewChange = (v: ViewState) => {
    setIsSidebarOpen(false);
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

  const orderedView = currentView === 'goals' || currentView === 'streaks' || currentView === 'charts' ? 'goals_streaks' : currentView;
  const pageIndex = plannerPageOrder.indexOf(orderedView);
  const previousPage = plannerPageOrder[pageIndex - 1];
  const nextPage = plannerPageOrder[pageIndex + 1];

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
    <div data-local-workspace={user?.isAnonymous || isLocalUser(user) ? 'true' : undefined} className="app-container retro-world text-on-surface font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container">
      <RetroPlannerShell controls={
        <nav className="retro-controls" aria-label="Device controls">
          <button type="button" className="retro-key retro-key-side" aria-label="Previous page" disabled={!profile || !previousPage} onClick={() => handleViewChange(previousPage)}>
            <ChevronLeft aria-hidden="true" /><span>Prev</span>
          </button>
          <div className="retro-key-cluster">
            <button type="button" className="retro-key" disabled={!profile} onClick={() => handleViewChange('agenda')}>
              <House aria-hidden="true" /><span>Home</span>
            </button>
            <button type="button" className="retro-key" disabled={!profile} aria-haspopup="dialog" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(open => !open)}>
              <Grid2X2 aria-hidden="true" /><span>Menu</span>
            </button>
          </div>
          <button type="button" className="retro-key retro-key-side" aria-label="Next page" disabled={!profile || !nextPage} onClick={() => handleViewChange(nextPage)}>
            <span>Next</span><ChevronRight aria-hidden="true" />
          </button>
        </nav>
      }>
        {profile ? (
          <>
            <StorageNotice />
            <DialogAccessibility />
            <MedicationPopup />
            <a className="planner-skip-link" href="#planner-content" onClick={event => { event.preventDefault(); document.getElementById('planner-content')?.focus(); }}>Skip to planner page</a>
            <header className="retro-display-toolbar">
              <button type="button" className="retro-profile" onClick={() => handleViewChange('settings')} aria-label="Profile settings">
                <Settings size={15} aria-hidden="true" /><span>{profile.nickname}</span>
              </button>
              <FocusTimer />
            </header>
            <div id="planner-content" key={currentView} tabIndex={-1} data-page={currentView} className="planner-page">
              <ErrorBoundary>
                <Suspense fallback={<div role="status" className="p-10 text-on-surface-variant">Loading your space…</div>}>{renderView()}</Suspense>
              </ErrorBoundary>
            </div>
            <Sidebar currentView={currentView} onChangeView={handleViewChange} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
          </>
        ) : <div className="retro-welcome-viewport"><ProfileWelcome error={storageError} /></div>}
      </RetroPlannerShell>
    </div>
  );
}
