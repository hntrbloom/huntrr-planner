import { safeGetDoc as getDoc, safeGetDocs as getDocs, safeGetDoc } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { Target, Plus, Trash2, Edit2, X, Check, CheckCircle2, Circle } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from '../lib/workspaceStore';
import { useAuth } from '../lib/AuthContext';
import { SyncStatus } from './SyncStatus';
import { GUEST_SAMPLE_GOALS } from '../lib/guestSampleData';

export type GoalFrequency = 'No Time Limit' | 'Daily' | 'Weekly' | 'Monthly';

export interface GoalMilestone {
  id: string;
  text: string;
  completed: boolean;
}

export interface GoalHistoryItem {
  period: string;
  completedAmount: number;
  targetAmount: number;
  resetAt: string;
}

export interface Goal {
  id: string;
  name: string;
  title?: string;
  currentAmount: number;
  targetAmount: number;
  frequency?: GoalFrequency;
  lastResetPeriod?: string;
  history?: GoalHistoryItem[];
  milestones?: GoalMilestone[];
  subtasks?: GoalMilestone[];
  category?: string;
  targetDate?: string;
  description?: string;
}

function getCurrentPeriodString(frequency: GoalFrequency | undefined): string {
  if (!frequency || frequency === 'No Time Limit') return '';
  const now = new Date();
  if (frequency === 'Daily') {
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  } else if (frequency === 'Weekly') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return `Wk-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  } else if (frequency === 'Monthly') {
    return `Mo-${now.getFullYear()}-${now.getMonth() + 1}`;
  }
  return '';
}

/**
 * Minimal Push Pin Component
 * Matches the subtle 2px gray-400 outline and visual weight of the Shopping Lists paperclip,
 * centered at the top edge and slightly overlapping the note's border.
 */
function MinimalPushPin() {
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex items-center justify-center">
      <svg
        width="14"
        height="20"
        viewBox="0 0 14 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-400 drop-shadow-[1px_1px_1px_rgba(0,0,0,0.08)]"
      >
        <circle cx="7" cy="5" r="3.5" stroke="currentColor" strokeWidth="2" fill="white" />
        <circle cx="7" cy="5" r="1" fill="currentColor" />
        <path d="M7 8.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Normalizes goal objects to ensure backward compatibility with both milestones and numeric targets.
 */
function normalizeGoal(raw: any): Goal {
  const name = raw.name || raw.title || 'Untitled Goal';
  let milestones: GoalMilestone[] = [];

  if (Array.isArray(raw.milestones) && raw.milestones.length > 0) {
    milestones = raw.milestones.map((m: any, idx: number) => ({
      id: m.id || `m-${idx}-${Date.now()}`,
      text: m.text || `Milestone ${idx + 1}`,
      completed: Boolean(m.completed),
    }));
  } else if (Array.isArray(raw.subtasks) && raw.subtasks.length > 0) {
    milestones = raw.subtasks.map((s: any, idx: number) => ({
      id: s.id || `s-${idx}-${Date.now()}`,
      text: s.text || `Milestone ${idx + 1}`,
      completed: Boolean(s.completed),
    }));
  }

  const completedCount = milestones.length > 0 
    ? milestones.filter(m => m.completed).length 
    : (typeof raw.currentAmount === 'number' ? raw.currentAmount : 0);

  const targetCount = milestones.length > 0 
    ? milestones.length 
    : (typeof raw.targetAmount === 'number' && raw.targetAmount > 0 ? raw.targetAmount : Math.max(1, completedCount));

  return {
    id: raw.id || Date.now().toString(),
    name,
    title: name,
    currentAmount: completedCount,
    targetAmount: targetCount,
    frequency: raw.frequency || 'No Time Limit',
    lastResetPeriod: raw.lastResetPeriod || '',
    history: raw.history || [],
    milestones,
    category: raw.category || '',
    targetDate: raw.targetDate || '',
    description: raw.description || '',
  };
}

export function GoalsView({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for creating/editing goals
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<GoalFrequency>('No Time Limit');

  // Per-card milestone adding/editing states
  const [addingMilestoneGoalId, setAddingMilestoneGoalId] = useState<string | null>(null);
  const [newMilestoneText, setNewMilestoneText] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<{ goalId: string; milestoneId: string; text: string } | null>(null);

  const newMilestoneInputRef = useRef<HTMLInputElement>(null);
  const editMilestoneInputRef = useRef<HTMLInputElement>(null);

  // Focus input when adding milestone to a card
  useEffect(() => {
    if (addingMilestoneGoalId && newMilestoneInputRef.current) {
      newMilestoneInputRef.current.focus();
    }
  }, [addingMilestoneGoalId]);

  // Focus input when editing milestone text
  useEffect(() => {
    if (editingMilestone && editMilestoneInputRef.current) {
      editMilestoneInputRef.current.focus();
    }
  }, [editingMilestone]);

  const saveGoals = async (newGoals: Goal[]) => {
    if (!user) return;
    if (user.isAnonymous) {
      setGoals(newGoals);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1500);
      return;
    }
    setSyncStatus('saving');
    try {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'goalsData');
      await setDoc(docRef, { goals: newGoals }, { merge: true });
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (e) {
      console.error('Error saving goals:', e);
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.isAnonymous) {
      const initialGoals = GUEST_SAMPLE_GOALS.map(g => normalizeGoal(g));
      setGoals(initialGoals);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'goalsData'), async (docSnap) => {
      let loadedGoals = docSnap.exists() ? (docSnap.data().goals || []) : [];

      // Fallback: Check root document if preferences is empty
      if (loadedGoals.length === 0) {
        try {
          const rootSnap = await getDoc(doc(db, 'users', user.uid));
          if (rootSnap.exists() && rootSnap.data().goals) {
            loadedGoals = rootSnap.data().goals;
            console.log('Recovered goals from root doc');
          }
        } catch (e) {}
      }

      let needsSave = false;
      const processedGoals = loadedGoals.map((rawG: any) => {
        const g = normalizeGoal(rawG);
        const freq = g.frequency || 'No Time Limit';
        if (freq !== 'No Time Limit') {
          const currentPeriod = getCurrentPeriodString(freq);
          if (g.lastResetPeriod && g.lastResetPeriod !== currentPeriod) {
            needsSave = true;
            // Reset milestone completed flags on periodic reset
            const resetMilestones = (g.milestones || []).map(m => ({ ...m, completed: false }));
            return {
              ...g,
              frequency: freq,
              milestones: resetMilestones,
              history: [...(g.history || []), {
                period: g.lastResetPeriod,
                completedAmount: g.currentAmount,
                targetAmount: g.targetAmount,
                resetAt: new Date().toISOString()
              }],
              currentAmount: 0,
              lastResetPeriod: currentPeriod
            };
          } else if (!g.lastResetPeriod) {
            needsSave = true;
            return { ...g, frequency: freq, lastResetPeriod: currentPeriod };
          }
        } else if (!g.frequency) {
          needsSave = true;
          return { ...g, frequency: 'No Time Limit' as GoalFrequency };
        }
        return g;
      });

      setGoals(processedGoals);
      if (needsSave) {
        const docRef = doc(db, `users/${user.uid}/preferences`, 'goalsData');
        setDoc(docRef, { goals: processedGoals }, { merge: true }).catch(console.error);
      }
      setLoading(false);
    }, (err) => {
      console.error('Goals fetch error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Toggle milestone completed status
  const toggleMilestone = (goalId: string, milestoneId: string) => {
    const updated = goals.map(goal => {
      if (goal.id !== goalId) return goal;
      const milestones = (goal.milestones || []).map(m => {
        if (m.id === milestoneId) {
          return { ...m, completed: !m.completed };
        }
        return m;
      });
      const completedCount = milestones.filter(m => m.completed).length;
      return {
        ...goal,
        milestones,
        subtasks: milestones,
        currentAmount: completedCount,
        targetAmount: Math.max(1, milestones.length)
      };
    });
    setGoals(updated);
    saveGoals(updated);
  };

  // Add milestone to an existing goal card
  const handleAddMilestoneToGoal = (goalId: string) => {
    if (!newMilestoneText.trim()) {
      setAddingMilestoneGoalId(null);
      return;
    }

    const newMilestone: GoalMilestone = {
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: newMilestoneText.trim(),
      completed: false,
    };

    const updated = goals.map(goal => {
      if (goal.id !== goalId) return goal;
      const milestones = [...(goal.milestones || []), newMilestone];
      const completedCount = milestones.filter(m => m.completed).length;
      return {
        ...goal,
        milestones,
        subtasks: milestones,
        currentAmount: completedCount,
        targetAmount: milestones.length
      };
    });

    setGoals(updated);
    saveGoals(updated);
    setNewMilestoneText('');
    setAddingMilestoneGoalId(null);
  };

  // Edit milestone text within a goal card
  const handleSaveMilestoneEdit = () => {
    if (!editingMilestone) return;
    const { goalId, milestoneId, text } = editingMilestone;
    if (!text.trim()) {
      handleDeleteMilestone(goalId, milestoneId);
      setEditingMilestone(null);
      return;
    }

    const updated = goals.map(goal => {
      if (goal.id !== goalId) return goal;
      const milestones = (goal.milestones || []).map(m => {
        if (m.id === milestoneId) {
          return { ...m, text: text.trim() };
        }
        return m;
      });
      return {
        ...goal,
        milestones,
        subtasks: milestones
      };
    });

    setGoals(updated);
    saveGoals(updated);
    setEditingMilestone(null);
  };

  // Delete milestone from a goal card
  const handleDeleteMilestone = (goalId: string, milestoneId: string) => {
    const updated = goals.map(goal => {
      if (goal.id !== goalId) return goal;
      const milestones = (goal.milestones || []).filter(m => m.id !== milestoneId);
      const completedCount = milestones.filter(m => m.completed).length;
      return {
        ...goal,
        milestones,
        subtasks: milestones,
        currentAmount: completedCount,
        targetAmount: Math.max(1, milestones.length)
      };
    });
    setGoals(updated);
    saveGoals(updated);
  };

  // Save new or edited goal
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      const updated = goals.map(g => {
        if (g.id === editingId) {
          const periodChanged = g.frequency !== frequency;
          return {
            ...g,
            name: name.trim(),
            title: name.trim(),
            frequency: frequency,
            lastResetPeriod: periodChanged ? getCurrentPeriodString(frequency) : g.lastResetPeriod
          };
        }
        return g;
      });
      setGoals(updated);
      saveGoals(updated);
      setEditingId(null);
    } else {
      const newGoal: Goal = {
        id: `goal-${Date.now()}`,
        name: name.trim(),
        title: name.trim(),
        targetAmount: 0,
        currentAmount: 0,
        frequency: frequency,
        lastResetPeriod: getCurrentPeriodString(frequency),
        milestones: [],
        subtasks: []
      };
      const updated = [newGoal, ...goals];
      setGoals(updated);
      saveGoals(updated);
    }

    resetForm();
    setIsAdding(false);
  };

  const startEditing = (g: Goal) => {
    setName(g.name || g.title || '');
    setFrequency(g.frequency || 'No Time Limit');
    setEditingId(g.id);
    setIsAdding(true);
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    saveGoals(updated);
  };

  const resetForm = () => {
    setName('');
    setFrequency('No Time Limit');
    setEditingId(null);
  };

  return (
    <div className={embedded ? "w-full relative" : "flex-1 md:overflow-y-auto px-margin-mobile md:px-margin-desktop py-6 md:py-8 bg-transparent relative"}>
      {/* Top Header */}
      <div className="goals-board-heading flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl md:text-[40px] leading-[1.1] font-normal font-headline-md text-[#1c1b1d] tracking-tight mb-2">
            Goals
          </h1>
          <p className="text-[#666666] text-sm font-medium">
            Keep track of your goals and step-by-step milestones on your pinned note board.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatus status={syncStatus} />
          {!isAdding && (
            <button
              type="button"
              id="btn-add-goal"
              onClick={() => { setIsAdding(true); setEditingId(null); resetForm(); }}
              className="bg-primary text-on-primary px-4 py-2.5 rounded-full font-semibold text-[14px] hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Goal Note</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Goal Form */}
      {isAdding && (
        <form onSubmit={handleSave} className="mb-8 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-primary/20 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center animate-in fade-in duration-200">
          <input
            type="text"
            id="input-goal-title" aria-label="Goal title"
            placeholder="Goal title (e.g. Launch Pastel Keychain Collection)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-surface px-4 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/50 text-[#1c1b1d] text-base"
            autoFocus
          />
          <select
            id="select-goal-frequency" aria-label="Goal frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as GoalFrequency)}
            className="bg-surface px-3 py-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-primary/50 text-[#1c1b1d] text-sm font-medium cursor-pointer"
          >
            <option value="No Time Limit">No Time Limit</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              id="btn-save-goal-submit"
              disabled={!name.trim()}
              className="bg-primary text-on-primary px-5 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              id="btn-cancel-create-goal"
              onClick={() => { setIsAdding(false); resetForm(); }}
              className="px-4 py-3 text-[#666666] hover:bg-surface-variant rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : goals.length === 0 && !isAdding ? (
        <div 
          onClick={() => setIsAdding(true)} role="button" tabIndex={0} aria-label="Create your first goal"
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsAdding(true); } }}
          className="bg-white rounded-sm shadow-md border-[2px] border-dashed border-gray-400/50 flex flex-col items-center justify-center text-center p-8 cursor-pointer hover:bg-gray-50 transition-colors min-h-[200px]"
        >
          <div className="w-12 h-12 rounded-full bg-[#FFF0F4] text-primary flex items-center justify-center mb-3">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-[#1c1b1d] mb-1">No goals created yet</h3>
          <p className="text-sm text-[#777777] max-w-xs mb-4 font-medium">
            Click here to create your first goal note and start tracking milestones!
          </p>
          <span className="text-sm font-semibold text-primary flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Goal Note
          </span>
        </div>
      ) : (
        /* Goals Grid - Same proportions & layout as Shopping Lists */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {goals.map(goal => {
            const milestones = goal.milestones || [];
            const completedMilestones = milestones.filter(m => m.completed).length;
            const totalMilestones = milestones.length;
            const currentFreq = goal.frequency || 'No Time Limit';
            const isAddingHere = addingMilestoneGoalId === goal.id;

            return (
              <div
                key={goal.id}
                id={`goal-card-${goal.id}`}
                className="bg-white rounded-sm shadow-md border-[2px] border-gray-400 flex flex-col group relative hover:-translate-y-1 transition-transform"
              >
                {/* Minimal Thin-Line Push Pin centered at top edge */}
                <MinimalPushPin />

                {/* Card Header matching Shopping Lists note cards */}
                <div className="goal-card-heading bg-[#FFF0F4]/40 px-5 py-4 border-b-[2px] border-black/5 flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-xl font-semibold text-[#1c1b1d] tracking-tight group-hover:text-primary transition-colors truncate">
                      {goal.name || goal.title}
                    </h3>
                    <div className="text-sm font-medium text-[#777777] mt-1 flex flex-wrap items-center gap-2">
                      {totalMilestones > 0 && completedMilestones === totalMilestones ? (
                        <span className="text-emerald-600 font-semibold">All done! 🎉</span>
                      ) : totalMilestones > 0 ? (
                        <>
                          <span className="text-primary">{completedMilestones} of {totalMilestones} completed</span>
                          {currentFreq !== 'No Time Limit' && (
                            <>
                              <span>•</span>
                              <span className="text-xs text-[#888888] uppercase tracking-wider">{currentFreq}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-[#888888]">
                          {goal.currentAmount > 0 ? `${goal.currentAmount} of ${goal.targetAmount} completed` : '0 milestones'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-gray-200 group-hover:scale-105 transition-transform text-primary">
                    <Target className="w-4 h-4" />
                  </div>
                </div>

                {/* Items Preview / Lined Paper Checklist */}
                <div className="p-5 flex-1 bg-white lined-paper relative min-h-[140px] flex flex-col justify-between">
                  {/* Milestones Scrollable Container */}
                  <div className="space-y-2.5 relative z-10 max-h-[180px] overflow-y-auto pr-1">
                    {milestones.length > 0 ? (
                      milestones.map(m => {
                        const isEditingThis = editingMilestone?.goalId === goal.id && editingMilestone?.milestoneId === m.id;
                        if (isEditingThis) {
                          return (
                            <div key={m.id} className="flex items-center gap-1.5 py-0.5 bg-white p-1 rounded border border-primary/40 shadow-xs">
                              <input
                                ref={editMilestoneInputRef}
                                type="text"
                                value={editingMilestone.text}
                                onChange={(e) => setEditingMilestone({ ...editingMilestone, text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveMilestoneEdit();
                                  if (e.key === 'Escape') setEditingMilestone(null);
                                }}
                                onBlur={handleSaveMilestoneEdit}
                                className="flex-1 bg-transparent px-1 text-sm outline-none text-[#1c1b1d]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onMouseDown={handleSaveMilestoneEdit}
                                className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={m.id}
                            className={`group/item flex items-center justify-between gap-2 py-0.5 transition-all ${
                              m.completed ? 'opacity-50' : 'opacity-100'
                            }`}
                          >
                            <div
                              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none"
                              onClick={() => toggleMilestone(goal.id, m.id)}
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={m.completed}
                                aria-label={`Complete milestone: ${m.text}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMilestone(goal.id, m.id);
                                }}
                                className={`shrink-0 transition-colors ${
                                  m.completed ? 'text-primary' : 'text-[#cccccc] hover:text-primary'
                                }`}
                              >
                                {m.completed ? (
                                  <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                                ) : (
                                  <Circle className="w-4 h-4 shrink-0 text-[#cccccc]" />
                                )}
                              </button>

                              <span
                                className={`text-sm truncate font-medium ${
                                  m.completed ? 'line-through text-[#666666]' : 'text-[#333333]'
                                }`}
                              >
                                {m.text}
                              </span>
                            </div>

                            {/* Quick edit / delete milestone on hover */}
                            <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingMilestone({ goalId: goal.id, milestoneId: m.id, text: m.text })}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                                title="Edit milestone"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMilestone(goal.id, m.id)}
                                className="p-1 text-rose-300 hover:text-rose-500 rounded transition-colors"
                                title="Delete milestone"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-[#999999] italic py-3 text-center h-full flex items-center justify-center">
                        No milestones yet — add one
                      </div>
                    )}
                  </div>

                  {/* Inline quick add milestone */}
                  <div className="mt-3 pt-2 border-t border-dashed border-primary/10 relative z-10">
                    {isAddingHere ? (
                      <div className="flex items-center gap-2 bg-white/95 p-1 rounded-lg border border-primary/30 shadow-xs">
                        <input
                          ref={newMilestoneInputRef}
                          type="text"
                          value={newMilestoneText}
                          onChange={(e) => setNewMilestoneText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddMilestoneToGoal(goal.id);
                            } else if (e.key === 'Escape') {
                              setAddingMilestoneGoalId(null);
                              setNewMilestoneText('');
                            }
                          }}
                          placeholder="New milestone..."
                          className="flex-1 bg-transparent px-2 py-0.5 text-xs sm:text-sm outline-none text-[#1c1b1d] placeholder:text-[#999999]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddMilestoneToGoal(goal.id)}
                          disabled={!newMilestoneText.trim()}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-all disabled:opacity-40 cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingMilestoneGoalId(null); setNewMilestoneText(''); }}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`btn-add-milestone-${goal.id}`}
                        onClick={() => {
                          setAddingMilestoneGoalId(goal.id);
                          setNewMilestoneText('');
                        }}
                        className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1.5 transition-colors py-0.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add milestone</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Actions (Edit / Delete) */}
                <div className="goal-card-actions absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1">
                  <button
                    type="button"
                    id={`btn-edit-goal-${goal.id}`}
                    onClick={(e) => { e.stopPropagation(); startEditing(goal); }}
                    className="p-1.5 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-full shadow-sm transition-colors border border-gray-200 cursor-pointer"
                    title="Edit Goal"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    id={`btn-delete-goal-${goal.id}`}
                    onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
                    className="p-1.5 bg-white text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full shadow-sm transition-colors border border-rose-100 cursor-pointer"
                    title="Delete Goal Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
