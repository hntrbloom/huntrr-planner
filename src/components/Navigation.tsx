import React, { useEffect, useRef } from 'react';
import { House, CalendarDays, ListTodo, Heart, NotebookPen, Target, Grid2X2, X, ShoppingCart, Receipt, FileText, Bell, Box, ScanEye, Image, Printer, KeyRound, BookOpen, Settings, type LucideIcon } from 'lucide-react';
import { ViewState } from '../types';

interface NavProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}
type NavItem = { id: ViewState; label: string; Icon: LucideIcon };
const plannerPages: NavItem[] = [
  { id: 'agenda', label: 'Home', Icon: House },
  { id: 'month', label: 'Calendar', Icon: CalendarDays },
  { id: 'log', label: 'Tasks', Icon: ListTodo },
  { id: 'habits', label: 'Habits', Icon: Heart },
  { id: 'notes', label: 'Notes', Icon: NotebookPen },
  { id: 'goals_streaks', label: 'Goals', Icon: Target },
];
const groups: { label: string; items: NavItem[] }[] = [
  { label: 'Everyday pages', items: [...plannerPages,
    { id: 'shopping', label: 'Shopping Lists', Icon: ShoppingCart },
    { id: 'reminders', label: 'Reminders', Icon: Bell },
    { id: 'blog', label: 'Blog', Icon: BookOpen },
  ] },
  { label: 'Work & creative studio', items: [
    { id: 'receipts', label: 'Client Receipts', Icon: Receipt },
    { id: 'jobs', label: 'Job Applications', Icon: FileText },
    { id: 'minifurniture', label: 'Prints', Icon: Box },
    { id: 'models', label: '3D Models', Icon: ScanEye },
    { id: 'pinterest', label: 'Inspiration', Icon: Image },
    { id: 'printing', label: 'Build Catalog', Icon: Printer },
    { id: 'keychains', label: 'Keychains', Icon: KeyRound },
    { id: 'wiki', label: 'Character Wiki', Icon: FileText },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ] },
];
const activePage = (current: ViewState, id: ViewState) => current === id || (id === 'goals_streaks' && (current === 'goals' || current === 'streaks'));

export function Sidebar({ currentView, onChangeView, isOpen, onClose }: NavProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div className="planner-drawer-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section role="dialog" aria-modal="true" aria-label="All planner pages" className="planner-drawer">
        <header className="drawer-heading">
          <div><span className="planner-eyebrow">A place for everything</span><h2>All your pages</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close all pages" className="planner-icon-button"><X size={20} /></button>
        </header>
        <nav aria-label="All planner pages">
          {groups.map(group => <div className="drawer-group" key={group.label}>
            <h3>{group.label}</h3>
            <div className="drawer-page-grid">{group.items.map(({id, label, Icon}) => <button
              type="button" key={id} id={`nav-item-${id}`} aria-current={activePage(currentView, id) ? 'page' : undefined}
              onClick={() => { onChangeView(id); onClose?.(); }}
            ><Icon size={19} aria-hidden="true" /><span>{label}</span></button>)}</div>
          </div>)}
        </nav>
        <p className="drawer-footnote">Your everyday plans. Your wonderfully big ideas.</p>
      </section>
    </div>
  );
}

export function BottomNav({ currentView, onChangeView, onOpen, isOpen }: NavProps) {
  return <nav className="planner-tabs" aria-label="Planner pages">
    {plannerPages.map(({ id, label, Icon }) => <button type="button" key={id} id={`bottom-nav-item-${id}`}
      onClick={() => onChangeView(id)} aria-current={activePage(currentView, id) ? 'page' : undefined}>
      <Icon size={19} aria-hidden="true" /><span>{label}</span>
    </button>)}
    <button type="button" className="all-pages-button" onClick={onOpen} aria-expanded={isOpen} aria-haspopup="dialog"
      aria-label="All pages" aria-current={!plannerPages.some(item => activePage(currentView, item.id)) ? 'page' : undefined}>
      <Grid2X2 size={18} aria-hidden="true" /><span>All pages</span>
    </button>
  </nav>;
}
