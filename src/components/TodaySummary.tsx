import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Heart, ListTodo, Star } from 'lucide-react';
import { useProfile } from '../lib/ProfileContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from '../lib/workspaceStore';
import { ViewState } from '../types';
import type { Habit } from './HabitsView';

interface SummaryTask { id: string; text: string; completed: boolean; dueDate?: string; important?: boolean }
interface TodaySummaryProps {
  onNavigate?: (view: ViewState) => void;
  eventTotal: number;
  eventDone: number;
  eventsReady: boolean;
  date: Date;
}

// Presentation-only subscriptions to existing records. Editing and check-ins stay
// in their original screens; opening Home never saves or changes user data.
export function TodaySummary({ onNavigate, eventTotal, eventDone, eventsReady, date }: TodaySummaryProps) {
  const { user } = useProfile();
  const [tasks, setTasks] = useState<SummaryTask[]>([]);
  const [habitDoc, setHabitDoc] = useState<Habit[] | null>(null);
  const [legacyHabits, setLegacyHabits] = useState<Habit[]>([]);
  const [ready, setReady] = useState({ tasks: false, habits: false, legacy: false });
  const [errors, setErrors] = useState({ tasks: false, habits: false, legacy: false });
  // These screens already key their daily records with an ISO date. Retain that
  // convention instead of migrating or recalculating any historical records.
  const recordDate = date.toISOString().split('T')[0];
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    const fail = (key: keyof typeof errors) => () => {
      setErrors(value => ({ ...value, [key]: true }));
      setReady(value => ({ ...value, [key]: true }));
    };
    const stopTasks = onSnapshot(doc(db, `users/${user.uid}/dailyLogs`, recordDate), snap => {
      const data = snap.data();
      setTasks(data?.items || [...(data?.tasks || []), ...(data?.chores || [])]);
      setReady(value => ({ ...value, tasks: true }));
      setErrors(value => ({ ...value, tasks: false }));
    }, fail('tasks'));
    const stopHabits = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'habitsData'), snap => {
      setHabitDoc(snap.exists() ? snap.data().habits || [] : null);
      setReady(value => ({ ...value, habits: true }));
      setErrors(value => ({ ...value, habits: false }));
    }, fail('habits'));
    const stopLegacy = onSnapshot(doc(db, 'users', user.uid), snap => {
      setLegacyHabits(snap.data()?.habits || []);
      setReady(value => ({ ...value, legacy: true }));
      setErrors(value => ({ ...value, legacy: false }));
    }, fail('legacy'));
    return () => { stopTasks(); stopHabits(); stopLegacy(); };
  }, [user, recordDate]);
  const dueTasks = tasks.filter(task => !task.dueDate || task.dueDate <= recordDate);
  const habits = (habitDoc?.length ? habitDoc : legacyHabits).filter(habit => (habit.scheduledDays || []).includes(date.getDay()));
  const habitsReady = ready.habits && (habitDoc?.length ? true : ready.legacy);
  const habitsError = errors.habits || (!habitDoc?.length && errors.legacy);
  const completedHabit = (habit: Habit) => {
    const value = habit.completions?.[recordDate];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  };
  const done = dueTasks.filter(task => task.completed).length + habits.filter(completedHabit).length + eventDone;
  const total = dueTasks.length + habits.length + eventTotal;
  const allReady = eventsReady && ready.tasks && habitsReady && !errors.tasks && !habitsError;
  const percent = total ? Math.round(done / total * 100) : 0;
  return <div className="today-inserts">
    <section className="paper-insert tasks-insert">
      <div className="insert-heading"><h2><ListTodo size={17} aria-hidden="true" /> Today's tasks</h2><button aria-label="Open tasks" onClick={() => onNavigate?.('log')}><ArrowUpRight size={18} /></button></div>
      {errors.tasks ? <p className="insert-empty" role="alert">Tasks couldn't load. Open Tasks to try again.</p> : !ready.tasks ? <p className="insert-empty" role="status">Loading your tasks…</p> : dueTasks.length ? <ul className="summary-entries">{dueTasks.slice(0, 3).map((task, index) => <li key={task.id || index}><span className={`entry-check ${task.completed ? 'is-done' : ''}`} aria-label={task.completed ? 'Complete' : 'Incomplete'}>{task.completed && <Check size={12} />}</span><span className={task.completed ? 'entry-done' : ''}>{task.text}</span>{task.important && <Star size={12} aria-label="Important" />}</li>)}</ul> : <p className="insert-empty">A fresh page for your to-dos.<br />What would you like to do today?</p>}
      <button className="insert-link" onClick={() => onNavigate?.('log')}>{dueTasks.length ? 'View all tasks' : '+ Add a little task'}<ArrowUpRight size={13} aria-hidden="true" /></button>
    </section>
    <section className="paper-insert habits-insert">
      <div className="insert-heading"><h2><Heart size={17} aria-hidden="true" /> Little daily habits</h2><button aria-label="Open habit check-ins" onClick={() => onNavigate?.('habits')}><ArrowUpRight size={18} /></button></div>
      {habitsError ? <p className="insert-empty" role="alert">Habits couldn't load. Open Habits to try again.</p> : !habitsReady ? <p className="insert-empty" role="status">Loading your habits…</p> : habits.length ? <ul className="summary-entries">{habits.slice(0, 3).map(habit => <li key={habit.id}><Heart size={16} fill={completedHabit(habit) ? 'currentColor' : 'none'} aria-label={completedHabit(habit) ? 'Checked in' : 'Available today'} /><span>{habit.name}</span>{completedHabit(habit) && <Check size={13} aria-hidden="true" />}</li>)}</ul> : <p className="insert-empty">Small rituals, a little at a time.<br />No habits scheduled for today.</p>}
      <button className="insert-link" onClick={() => onNavigate?.('habits')}>{habits.length ? 'Go to check-ins' : '+ Start a habit'}<ArrowUpRight size={13} aria-hidden="true" /></button>
    </section>
    <section className="paper-insert progress-insert">
      <div className="insert-heading"><h2><Star size={17} aria-hidden="true" /> Your daily little wins</h2></div>
      <div className="daily-progress">
        <div className="progress-flower" role="img" aria-label={allReady ? `${percent}% complete` : 'Progress unavailable'} style={{ '--progress': `${percent}%` } as React.CSSProperties}><span>{allReady ? `${percent}%` : '—'}</span></div>
        <div><strong>{allReady ? `${done} / ${total} complete` : 'Your day, at a glance'}</strong><p>{allReady && total ? 'Tasks, events & habit check-ins' : 'Make room for a good day.'}</p></div>
      </div>
      <p className="progress-caption"><Heart size={12} aria-hidden="true" /> Every small step counts.</p>
    </section>
  </div>;
}
