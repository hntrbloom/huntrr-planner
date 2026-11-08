import type { ReactNode } from 'react';

function CatEar({ side }: { side: 'left' | 'right' }) {
  return <svg className={`retro-ear retro-ear-${side}`} viewBox="0 0 120 84" fill="none" aria-hidden="true" focusable="false">
    <path d="M7 78C13 58 10 17 25 8C40-1 77 28 113 78" fill="var(--retro-plastic)" stroke="var(--retro-outline)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 47C21 29 22 20 29 17C35 16 43 21 50 26" stroke="var(--retro-highlight)" strokeWidth="6" strokeLinecap="round" />
  </svg>;
}

function MoldedBow() {
  return <svg className="retro-bow" viewBox="0 0 180 112" fill="none" aria-hidden="true" focusable="false">
    <path d="M78 45C58 22 23 6 12 25C-1 48 29 87 77 66L90 55Z" fill="var(--retro-bow)" stroke="var(--retro-outline)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M102 45C122 22 157 6 168 25C181 48 151 87 103 66L90 55Z" fill="var(--retro-bow)" stroke="var(--retro-outline)" strokeWidth="3" strokeLinejoin="round" />
    <path d="M21 29C28 20 46 28 57 35M159 29C152 20 134 28 123 35" stroke="var(--retro-highlight)" strokeWidth="7" strokeLinecap="round" />
    <path d="M77 46Q56 39 49 48Q60 59 78 61M103 46Q124 39 131 48Q120 59 102 61" fill="var(--retro-highlight)" stroke="var(--retro-outline)" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="90" cy="54" r="19" fill="var(--retro-bow)" stroke="var(--retro-outline)" strokeWidth="3" />
    <path d="M80 49C82 42 88 39 94 41" stroke="var(--retro-highlight)" strokeWidth="5" strokeLinecap="round" />
  </svg>;
}

export function RetroPlannerShell({ children, controls }: { children: ReactNode; controls: ReactNode }) {
  return (
    <div className="retro-device">
      <CatEar side="left" />
      <CatEar side="right" />
      <MoldedBow />
      <div className="retro-casing">
        <div className="retro-nameplate" aria-hidden="true">
          <span>huntrr.organizer</span>
          <span className="retro-model">pocket diary</span>
        </div>
        <div className="retro-bezel">
          <div className="retro-display">{children}</div>
        </div>
        <div className="retro-keypad">{controls}</div>
      </div>
    </div>
  );
}
