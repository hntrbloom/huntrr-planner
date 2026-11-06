import React from 'react';
import { Grid2X2, Settings } from 'lucide-react';
import { BottomNav } from './Navigation';
import { ViewState } from '../types';

interface CatPlannerHeaderProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  menuOpen: boolean;
  onOpenMenu: () => void;
  workspaceLabel: string;
}

function CatEar({ side }: { side: 'left' | 'right' }) {
  return <svg className={`cat-header-ear cat-header-ear-${side}`} viewBox="0 0 120 84" fill="none" aria-hidden="true" focusable="false">
    <path d="M7 78C13 58 10 17 25 8C40-1 77 28 113 78" fill="var(--cat-header-pink)" stroke="var(--cat-header-outline)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 47C21 29 22 20 29 17C35 16 43 21 50 26" stroke="var(--cat-header-highlight)" strokeWidth="6" strokeLinecap="round" />
  </svg>;
}

function MoldedBow() {
  return <svg className="cat-header-bow" viewBox="0 0 180 112" fill="none" aria-hidden="true" focusable="false">
    <path d="M78 45C58 22 23 6 12 25C-1 48 29 87 77 66L90 55Z" fill="var(--cat-bow-pink)" stroke="var(--cat-header-outline)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M102 45C122 22 157 6 168 25C181 48 151 87 103 66L90 55Z" fill="var(--cat-bow-pink)" stroke="var(--cat-header-outline)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M21 29C28 20 46 28 57 35M159 29C152 20 134 28 123 35" stroke="var(--cat-bow-highlight)" strokeWidth="7" strokeLinecap="round" />
    <path d="M77 46Q56 39 49 48Q60 59 78 61M103 46Q124 39 131 48Q120 59 102 61" fill="var(--cat-bow-highlight)" stroke="var(--cat-header-outline)" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="90" cy="54" r="19" fill="var(--cat-bow-pink)" stroke="var(--cat-header-outline)" strokeWidth="3" />
    <path d="M80 49C82 42 88 39 94 41" stroke="var(--cat-bow-highlight)" strokeWidth="5" strokeLinecap="round" />
  </svg>;
}

export function CatPlannerHeader({ currentView, onChangeView, menuOpen, onOpenMenu, workspaceLabel }: CatPlannerHeaderProps) {
  const workspaceAction = () => onChangeView('settings');
  const workspaceActionLabel = 'Profile settings';
  return <header className="cat-planner-header">
    <div className="cat-header-surface" aria-hidden="true" />
    <div className="cat-header-inner">
      <CatEar side="left" /><CatEar side="right" /><MoldedBow />
      <div className="cat-header-toolbar">
        <button type="button" className="cat-header-title" onClick={() => onChangeView('agenda')} aria-label="Huntrr Organizer home">Huntrr Organizer</button>
        <div className="cat-header-account">
          <span className="cat-workspace-label">{workspaceLabel}</span>
          <button type="button" className="cat-workspace-button" onClick={workspaceAction} aria-label={workspaceActionLabel} title={workspaceActionLabel}>
            <Settings size={17} aria-hidden="true" />
            <span>{workspaceActionLabel}</span>
          </button>
        </div>
        <button type="button" className="cat-mobile-menu" onClick={onOpenMenu} aria-label="All pages" aria-expanded={menuOpen} aria-haspopup="dialog">
          <Grid2X2 size={20} aria-hidden="true" /><span>Pages</span>
        </button>
      </div>
      <div className="cat-desktop-navigation">
        <BottomNav currentView={currentView} onChangeView={onChangeView} isOpen={menuOpen} onOpen={onOpenMenu} />
      </div>
    </div>
  </header>;
}
