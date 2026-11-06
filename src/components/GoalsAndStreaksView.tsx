import React, { useState, useEffect } from 'react';
import { Target, Award } from 'lucide-react';
import { GoalsView } from './GoalsView';
import { StreaksView } from './StreaksView';

interface GoalsAndStreaksViewProps {
  initialSection?: 'goals' | 'streaks';
  onSectionChange?: (section: 'goals' | 'streaks') => void;
}

import { useProfile } from '../lib/ProfileContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from '../lib/workspaceStore';

export function GoalsAndStreaksView({ initialSection, onSectionChange }: GoalsAndStreaksViewProps) {
  const { user } = useProfile();
  const [activeSection, setActiveSection] = useState<'goals' | 'streaks'>(initialSection ?? 'goals');
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      return;
    }
    if (!user || selected) return;
    let mounted = true;
    getDoc(doc(db, `users/${user.uid}/preferences`, 'goalsView')).then(snapshot => {
      const saved = snapshot.data()?.section;
      if (mounted && (saved === 'goals' || saved === 'streaks')) setActiveSection(saved);
    }).catch(console.error);
    return () => { mounted = false; };
  }, [initialSection, user, selected]);

  const handleSectionSelect = (section: 'goals' | 'streaks') => {
    setSelected(true);
    setActiveSection(section);
    if (user) void setDoc(doc(db, `users/${user.uid}/preferences`, 'goalsView'), { section }).catch(() => {});
    onSectionChange?.(section);
  };

  return (
    <div className="flex-1 md:overflow-y-auto px-4 md:px-margin-desktop pb-safe-nav bg-transparent relative">
      {/* Mobile Top Header */}
      <div className="md:hidden mt-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[28px] sm:text-[32px] leading-[1.2] font-bold font-headline-lg-mobile text-[#111111] m-0 tracking-tight">
              Goals & Streaks
            </h2>
            <p className="text-[13px] text-[#666666] mt-1 font-medium">
              {activeSection === 'goals' 
                ? 'Track milestone targets and progress' 
                : 'Habit streaks, focus, and daily activity'}
            </p>
          </div>
        </div>

        {/* Mobile Segmented Control */}
        <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/30 shadow-inner w-full">
          <button
            type="button"
            id="tab-goals-mobile"
            onClick={() => handleSectionSelect('goals')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
              activeSection === 'goals'
                ? 'bg-white text-primary shadow-sm border border-black/5'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
            aria-selected={activeSection === 'goals'}
            role="tab"
          >
            <Target className="w-4 h-4" />
            <span>Goals</span>
          </button>
          <button
            type="button"
            id="tab-streaks-mobile"
            onClick={() => handleSectionSelect('streaks')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold transition-all cursor-pointer ${
              activeSection === 'streaks'
                ? 'bg-white text-primary shadow-sm border border-black/5'
                : 'text-[#666666] hover:text-[#111111]'
            }`}
            aria-selected={activeSection === 'streaks'}
            role="tab"
          >
            <Award className="w-4 h-4" />
            <span>Streaks</span>
          </button>
        </div>
      </div>

      {/* Desktop & Tablet Top Header */}
      <div className="hidden md:flex mt-8 mb-8 justify-between items-end pb-4 border-b border-outline-variant/20">
        <div>
          <h2 className="text-[40px] leading-[1.2] font-bold font-headline-lg text-[#111111] m-0 tracking-tight">
            Goals & Streaks
          </h2>
          <p className="text-[#666666] mt-2 font-medium">
            {activeSection === 'goals' 
              ? 'Keep track of your milestones and target accomplishments.' 
              : 'A comprehensive view of your focus, habits, and daily action streaks.'}
          </p>
        </div>

        {/* Desktop Segmented Control */}
        <div 
          className="inline-flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant/30 shadow-inner shrink-0 ml-4"
          role="tablist"
          aria-label="Goals and Streaks navigation"
        >
          <button
            type="button"
            id="tab-goals-desktop"
            onClick={() => handleSectionSelect('goals')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer ${
              activeSection === 'goals'
                ? 'bg-white text-primary shadow-sm border border-black/5 scale-[1.02]'
                : 'text-[#666666] hover:text-[#111111] hover:bg-white/40'
            }`}
            aria-selected={activeSection === 'goals'}
            role="tab"
          >
            <Target className="w-4 h-4" />
            <span>Goals</span>
          </button>
          <button
            type="button"
            id="tab-streaks-desktop"
            onClick={() => handleSectionSelect('streaks')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-bold transition-all cursor-pointer ${
              activeSection === 'streaks'
                ? 'bg-white text-primary shadow-sm border border-black/5 scale-[1.02]'
                : 'text-[#666666] hover:text-[#111111] hover:bg-white/40'
            }`}
            aria-selected={activeSection === 'streaks'}
            role="tab"
          >
            <Award className="w-4 h-4" />
            <span>Streaks</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {activeSection === 'goals' ? (
          <GoalsView embedded={true} />
        ) : (
          <StreaksView embedded={true} />
        )}
      </div>
    </div>
  );
}
