import { DialogAccessibility } from './components/DialogAccessibility';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Menu, AlertTriangle } from 'lucide-react';
import { BottomNav, Sidebar } from './components/Navigation';
import { ViewState } from './types';
import { db } from './lib/firebase';
import { doc, onSnapshot } from './lib/workspaceStore';
import { useAuth } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FocusTimer } from './components/FocusTimer';
import { MedicationPopup } from './components/MedicationPopup';
import { isLocalUser } from './lib/workspaceMode';
import { StorageNotice } from './components/StorageNotice';
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
  const { user, logOut } = useAuth();

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'global'), (snap) => {
      if (snap.exists() && snap.data().backgroundColor) {
        document.body.style.backgroundColor = snap.data().backgroundColor;
      } else {
        document.body.style.backgroundColor = '#FFF0F4';
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false;
    try {
      const saved = localStorage.getItem('sidebar_open');
      if (saved !== null) {
        return saved === 'true';
      }
    } catch (e) {
      console.error('Error reading sidebar state:', e);
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_open', String(isSidebarOpen));
    } catch (e) {
      console.error('Error saving sidebar state:', e);
    }
  }, [isSidebarOpen]);

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
    <div data-local-workspace={user?.isAnonymous || isLocalUser(user) ? 'true' : undefined} className={`app-container text-on-surface font-body-md antialiased min-h-[100dvh] flex flex-col md:flex-row md:overflow-hidden selection:bg-primary-container selection:text-on-primary-container ${user?.isAnonymous || isLocalUser(user) ? 'pt-[56px] md:pt-[44px]' : ''}`}>
      {(user?.isAnonymous || isLocalUser(user)) && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-[#4b3440] text-white px-3 py-2 text-center text-xs font-medium flex flex-wrap items-center justify-center gap-x-3 gap-y-1 min-h-11">
          <span>{isLocalUser(user) ? 'Local workspace · saved on this device' : 'Guest preview · temporary changes'}</span>
          <button onClick={logOut} className="underline underline-offset-4">Switch workspace</button>
        </div>
      )}
      <StorageNotice />
      <DialogAccessibility />
      <FocusTimer />
      <MedicationPopup />
      
      {/* Menu button shown when sidebar is collapsed */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] md:bottom-auto md:top-[calc(var(--workspace-banner-height,0px)+20px)] left-4 z-[60] p-2.5 bg-white/80 backdrop-blur-md hover:bg-white text-[#666666] hover:text-[#222222] rounded-full shadow-md transition-all border border-black/10 flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
          aria-label="Open sidebar menu"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col relative w-full md:h-[calc(100dvh-var(--workspace-banner-height,0px))] md:overflow-hidden min-w-0 transition-all duration-300 ease-in-out">
        <ErrorBoundary key={currentView}>
          <Suspense fallback={<div role="status" className="p-10 text-on-surface-variant">Loading your space…</div>}>{renderView()}</Suspense>
        </ErrorBoundary>
      </div>

      <BottomNav currentView={currentView} onChangeView={handleViewChange} />
    </div>
  );
}
