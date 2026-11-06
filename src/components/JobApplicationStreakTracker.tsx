import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  Flame, 
  Target, 
  Award, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  Info,
  Sparkles
} from 'lucide-react';
import { useProfile } from '../lib/ProfileContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, getDoc } from '../lib/workspaceStore';
import { 
  JobApplication 
} from './JobApplicationsView';
import { GUEST_SAMPLE_JOB_APPLICATIONS } from '../lib/guestSampleData';
import { 
  calculateJobStreakStats, 
  toLocalDateKey, 
  parseToLocalDate, 
  DayApplicationData 
} from '../lib/jobStreakUtils';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  addMonths,
  subWeeks,
  addWeeks,
  eachDayOfInterval,
  isSameMonth,
  isSameDay
} from 'date-fns';

type TimeframeView = 'week' | 'month' | 'all';

export function JobApplicationStreakTracker() {
  const { user } = useProfile();
  
  // Real-time Applications State
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Weekly Goal Configuration State
  const [weeklyGoal, setWeeklyGoal] = useState<number>(5);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoalInput, setTempGoalInput] = useState('5');

  // Calendar / Chart View Mode
  const [timeframe, setTimeframe] = useState<TimeframeView>('week');
  const [monthOffset, setMonthOffset] = useState(0); // For navigating months in month view
  const [weekOffset, setWeekOffset] = useState(0);   // For navigating weeks in week view

  // Interactive Day Selection for inspecting jobs on that day
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  // 1. Subscribe to Job Applications data in real-time
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.isAnonymous) {
      // Check localStorage for saved guest applications
      const saved = localStorage.getItem('guest_job_applications');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setApplications(parsed);
            setLoading(false);
          }
        } catch (e) {
          console.warn('Failed to parse guest_job_applications:', e);
        }
      } else {
        setApplications(GUEST_SAMPLE_JOB_APPLICATIONS.map(j => ({
          id: j.id,
          company: j.companyName,
          position: j.roleTitle,
          status: ((j.status as string) === 'Interviewing' ? 'Interview' : j.status) as JobApplication['status'],
          dateApplied: j.appliedDate,
          link: j.jobUrl,
          notes: j.notes,
          location: j.location,
          salaryMin: '75000',
          salaryMax: '90000',
          salaryPeriod: 'Yearly'
        })));
        setLoading(false);
      }

      // Listen for custom event when JobApplicationsView modifies guest data
      const handleGuestUpdate = (e: Event) => {
        const customEvent = e as CustomEvent<JobApplication[]>;
        if (customEvent.detail) {
          setApplications(customEvent.detail);
        } else {
          const updatedSaved = localStorage.getItem('guest_job_applications');
          if (updatedSaved) {
            try {
              setApplications(JSON.parse(updatedSaved));
            } catch (err) {}
          }
        }
      };

      window.addEventListener('job_applications_changed', handleGuestUpdate);
      return () => {
        window.removeEventListener('job_applications_changed', handleGuestUpdate);
      };
    }

    // Authenticated user: Listen to Firestore preference doc
    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'jobApplicationsData'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setApplications(data.applications || []);
      } else {
        setApplications([]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Job applications fetch error for streaks:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // 2. Load and listen to Weekly Goal preference
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    // Load from Firestore
    const unsub = onSnapshot(doc(db, `users/${user.uid}/preferences`, 'jobStreakConfig'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.weeklyGoal && typeof data.weeklyGoal === 'number' && data.weeklyGoal > 0) {
          setWeeklyGoal(data.weeklyGoal);
          setTempGoalInput(String(data.weeklyGoal));
        }
      }
    }, (err) => {
      console.warn('Job streak config fetch error:', err);
    });

    return () => unsub();
  }, [user]);

  // Save weekly goal
  const handleSaveGoal = async (newGoal: number) => {
    if (newGoal <= 0 || isNaN(newGoal)) return;
    setWeeklyGoal(newGoal);
    setTempGoalInput(String(newGoal));
    setIsEditingGoal(false);

    if (user && !user.isAnonymous) {
      try {
        await setDoc(doc(db, `users/${user.uid}/preferences`, 'jobStreakConfig'), {
          weeklyGoal: newGoal,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error('Error saving weekly goal to firestore:', err);
      }
    }
  };

  // Compute all statistics using our mathematical model
  const now = useMemo(() => new Date(), []);
  const stats = useMemo(() => {
    return calculateJobStreakStats(applications, weeklyGoal, now);
  }, [applications, weeklyGoal, now]);

  // Weekly Goal progress calculation
  const progressPercent = Math.min(100, Math.round((stats.thisWeek / weeklyGoal) * 100));

  // Current view reference date for navigation
  const currentViewDate = useMemo(() => {
    let d = new Date(now);
    if (timeframe === 'month') {
      d = addMonths(d, monthOffset);
    } else if (timeframe === 'week') {
      d = addWeeks(d, weekOffset);
    }
    return d;
  }, [now, timeframe, monthOffset, weekOffset]);

  // 1. Week View Days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentViewDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentViewDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    return days.map(d => {
      const key = toLocalDateKey(d);
      const data = stats.dayDataMap.get(key);
      const isToday = key === toLocalDateKey(now);
      const isFuture = key > toLocalDateKey(now);
      return {
        date: d,
        dateKey: key,
        count: data?.count || 0,
        jobs: data?.jobs || [],
        isToday,
        isFuture,
        intensity: data ? data.intensity : 0
      };
    });
  }, [currentViewDate, stats.dayDataMap, now]);

  // 2. Month View Days
  const monthCalendarData = useMemo(() => {
    const monthStart = startOfMonth(currentViewDate);
    const monthEnd = endOfMonth(currentViewDate);
    const startWeek = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endWeek = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: startWeek, end: endWeek });

    return days.map(d => {
      const key = toLocalDateKey(d);
      const inCurrentMonth = isSameMonth(d, currentViewDate);
      const data = stats.dayDataMap.get(key);
      const isToday = key === toLocalDateKey(now);
      const isFuture = key > toLocalDateKey(now);
      return {
        date: d,
        dateKey: key,
        inCurrentMonth,
        count: data?.count || 0,
        jobs: data?.jobs || [],
        isToday,
        isFuture,
        intensity: data ? data.intensity : 0
      };
    });
  }, [currentViewDate, stats.dayDataMap, now]);

  // 3. All-Time Contribution Calendar Grid (Last 16 weeks or full range)
  const allTimeCalendarWeeks = useMemo(() => {
    const weeksCount = 16;
    const end = endOfWeek(now, { weekStartsOn: 0 });
    const start = startOfWeek(subWeeks(end, weeksCount - 1), { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start, end });

    // Group into weeks of 7 days
    const weeks: Array<Array<{
      date: Date;
      dateKey: string;
      count: number;
      jobs: any[];
      isToday: boolean;
      isFuture: boolean;
      intensity: 0 | 1 | 2 | 3;
    }>> = [];

    let currentWeekArr: any[] = [];
    allDays.forEach((d) => {
      const key = toLocalDateKey(d);
      const data = stats.dayDataMap.get(key);
      currentWeekArr.push({
        date: d,
        dateKey: key,
        count: data?.count || 0,
        jobs: data?.jobs || [],
        isToday: key === toLocalDateKey(now),
        isFuture: key > toLocalDateKey(now),
        intensity: data ? data.intensity : 0
      });
      if (currentWeekArr.length === 7) {
        weeks.push(currentWeekArr);
        currentWeekArr = [];
      }
    });

    return weeks;
  }, [now, stats.dayDataMap]);

  // Currently inspected day's applications
  const selectedDayInfo = useMemo(() => {
    if (!selectedDayKey) return null;
    return stats.dayDataMap.get(selectedDayKey) || {
      dateStr: selectedDayKey,
      date: parseToLocalDate(selectedDayKey) || new Date(),
      count: 0,
      jobs: [],
      isToday: selectedDayKey === toLocalDateKey(now),
      isFuture: selectedDayKey > toLocalDateKey(now),
      intensity: 0 as const
    };
  }, [selectedDayKey, stats.dayDataMap, now]);

  // Helper for contribution box styling based on intensity
  const getIntensityClasses = (intensity: number, isToday: boolean, isSelected: boolean) => {
    const selectedRing = isSelected ? 'ring-2 ring-primary ring-offset-1' : '';
    const todayIndicator = isToday ? 'border-primary font-bold' : '';

    switch (intensity) {
      case 3:
        return `bg-primary text-white border-primary shadow-sm hover:brightness-110 ${selectedRing} ${todayIndicator}`;
      case 2:
        return `bg-primary/60 text-white border-primary/40 hover:bg-primary/70 ${selectedRing} ${todayIndicator}`;
      case 1:
        return `bg-primary/25 text-on-surface border-primary/20 hover:bg-primary/35 ${selectedRing} ${todayIndicator}`;
      default:
        return `bg-surface-container-low/70 text-on-surface-variant/60 border-outline-variant/20 hover:bg-surface-container-high ${selectedRing} ${todayIndicator}`;
    }
  };

  return (
    <div className="mb-10 bg-surface-container-lowest p-5 md:p-7 rounded-2xl border border-outline-variant/30 shadow-sm relative transition-all">
      {/* Tracker Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[20px] md:text-[22px] font-headline-md font-bold text-on-surface m-0 tracking-tight">
                Job Application Streak
              </h3>
              {stats.currentDailyStreak > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                  {stats.currentDailyStreak}d streak
                </span>
              )}
            </div>
            <p className="text-[13px] text-on-surface-variant font-medium mt-0.5">
              Live progress calculated automatically from your Job Applications tab.
            </p>
          </div>
        </div>

        {/* Timeframe View Switcher */}
        <div 
          className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 self-start sm:self-auto shadow-inner"
          role="tablist"
          aria-label="Timeframe selection"
        >
          <button
            type="button"
            id="tab-timeframe-week"
            onClick={() => { setTimeframe('week'); setSelectedDayKey(null); }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
              timeframe === 'week'
                ? 'bg-white text-primary shadow-sm border border-black/5'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-selected={timeframe === 'week'}
          >
            Current Week
          </button>
          <button
            type="button"
            id="tab-timeframe-month"
            onClick={() => { setTimeframe('month'); setSelectedDayKey(null); }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
              timeframe === 'month'
                ? 'bg-white text-primary shadow-sm border border-black/5'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-selected={timeframe === 'month'}
          >
            Current Month
          </button>
          <button
            type="button"
            id="tab-timeframe-all"
            onClick={() => { setTimeframe('all'); setSelectedDayKey(null); }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
              timeframe === 'all'
                ? 'bg-white text-primary shadow-sm border border-black/5'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            aria-selected={timeframe === 'all'}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* Primary Key Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 my-6">
        {/* Applications submitted today */}
        <div className={`p-4 rounded-xl border transition-all ${
          stats.today > 0 ? 'bg-primary/5 border-primary/25' : 'bg-surface border-outline-variant/20'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Today</span>
            <span className="text-[11px] font-medium text-on-surface-variant/70">
              {format(now, 'MMM d')}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-[28px] md:text-[32px] font-headline-md font-bold leading-none text-on-surface">
              {stats.today}
            </span>
            <span className="text-[12px] text-on-surface-variant font-medium">applied</span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
            {stats.today === 0 ? 'No applications logged yet' : stats.today === 1 ? '1 application logged' : `${stats.today} applications logged`}
          </p>
        </div>

        {/* Applications submitted this week */}
        <div className={`p-4 rounded-xl border transition-all ${
          stats.isGoalMetThisWeek ? 'bg-emerald-50/70 border-emerald-300' : 'bg-surface border-outline-variant/20'
        }`}>
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">This Week</span>
            {stats.isGoalMetThisWeek && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Goal Met
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-[28px] md:text-[32px] font-headline-md font-bold leading-none text-on-surface">
              {stats.thisWeek}
            </span>
            <span className="text-[12px] text-on-surface-variant font-medium">/ {weeklyGoal} goal</span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
            {stats.thisWeek >= weeklyGoal 
              ? 'Weekly goal achieved! 🎉' 
              : `${weeklyGoal - stats.thisWeek} more to hit goal`}
          </p>
        </div>

        {/* Applications submitted this month */}
        <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">This Month</span>
            <span className="text-[11px] font-medium text-on-surface-variant/70">
              {format(now, 'MMMM')}
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-[28px] md:text-[32px] font-headline-md font-bold leading-none text-on-surface">
              {stats.thisMonth}
            </span>
            <span className="text-[12px] text-on-surface-variant font-medium">applied</span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
            Across {format(now, 'MMMM yyyy')}
          </p>
        </div>

        {/* Total applications submitted */}
        <div className="p-4 rounded-xl border border-outline-variant/20 bg-surface">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Total Submitted</span>
            <span className="text-[11px] font-medium text-on-surface-variant/70">All-Time</span>
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-[28px] md:text-[32px] font-headline-md font-bold leading-none text-on-surface">
              {stats.total}
            </span>
            <span className="text-[12px] text-on-surface-variant font-medium">total jobs</span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1.5 truncate">
            Excludes drafts & unapplied
          </p>
        </div>
      </div>

      {/* Secondary Streaks & Averages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Current daily streak */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Current Daily</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.currentDailyStreak} <span className="text-[12px] font-normal text-on-surface-variant">days</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Consecutive days applied</div>
        </div>

        {/* Longest daily streak */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Longest Daily</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.longestDailyStreak} <span className="text-[12px] font-normal text-on-surface-variant">days</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Personal best daily run</div>
        </div>

        {/* Current weekly streak */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Current Weekly</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.currentWeeklyStreak} <span className="text-[12px] font-normal text-on-surface-variant">wks</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Weeks meeting goal</div>
        </div>

        {/* Best weekly streak */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Best Weekly</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.bestWeeklyStreak} <span className="text-[12px] font-normal text-on-surface-variant">wks</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Record goal streak</div>
        </div>

        {/* Daily average */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Daily Avg</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.dailyAverage} <span className="text-[12px] font-normal text-on-surface-variant">/ day</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Calendar rate</div>
        </div>

        {/* Weekly average */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
          <div className="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Weekly Avg</span>
          </div>
          <div className="text-[20px] font-headline-md font-bold text-on-surface">
            {stats.weeklyAverage} <span className="text-[12px] font-normal text-on-surface-variant">/ wk</span>
          </div>
          <div className="text-[10px] text-on-surface-variant mt-0.5">Applications per week</div>
        </div>
      </div>

      {/* Customizable Weekly Application Goal Bar */}
      <div className="p-4 md:p-5 rounded-2xl bg-surface border border-outline-variant/25 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-[14px] font-bold text-on-surface">
              Weekly Application Goal:
            </span>
            {!isEditingGoal ? (
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  {weeklyGoal} applications / week
                </span>
                <button
                  type="button"
                  id="btn-edit-weekly-goal"
                  onClick={() => setIsEditingGoal(true)}
                  className="p-1 hover:bg-surface-variant text-on-surface-variant rounded-md transition-colors cursor-pointer"
                  title="Customize weekly goal"
                  aria-label="Edit weekly application goal"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveGoal(parseInt(tempGoalInput, 10));
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tempGoalInput}
                  onChange={(e) => setTempGoalInput(e.target.value)}
                  className="w-16 px-2 py-1 text-[13px] font-bold bg-white border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-center"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[12px] font-bold bg-primary text-white rounded-md hover:bg-primary/90 cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingGoal(false);
                    setTempGoalInput(String(weeklyGoal));
                  }}
                  className="px-2 py-1 text-[12px] text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <div className="text-[13px] font-bold text-on-surface">
            Progress: <span className="text-primary">{stats.thisWeek} of {weeklyGoal}</span> applications
            <span className="text-on-surface-variant font-normal ml-1.5">({progressPercent}%)</span>
          </div>
        </div>

        {/* Progress Bar Track and Indicator */}
        <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden p-0.5 border border-outline-variant/20 shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              stats.isGoalMetThisWeek 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                : 'bg-primary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Activity Calendar / Chart Section */}
      <div className="mt-6 pt-5 border-t border-outline-variant/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-[16px] font-headline-md font-bold text-on-surface flex items-center gap-2 m-0">
              <Calendar className="w-4 h-4 text-primary" />
              {timeframe === 'week' && 'Weekly Activity Breakdown'}
              {timeframe === 'month' && `Monthly Activity Calendar (${format(currentViewDate, 'MMMM yyyy')})`}
              {timeframe === 'all' && 'All-Time Activity Heatmap'}
            </h4>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Days with more applications are visually darker. Tap any day to inspect applications.
            </p>
          </div>

          {/* Navigation for Week/Month */}
          {timeframe === 'week' && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[12px] font-bold text-on-surface min-w-[90px] text-center">
                {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)}w ago`}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev + 1)}
                disabled={weekOffset >= 0}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  weekOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-variant text-on-surface-variant'
                }`}
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {timeframe === 'month' && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMonthOffset(prev => prev - 1)}
                className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[12px] font-bold text-on-surface min-w-[110px] text-center">
                {format(currentViewDate, 'MMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => setMonthOffset(prev => prev + 1)}
                disabled={monthOffset >= 0}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  monthOffset >= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-variant text-on-surface-variant'
                }`}
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 1. CURRENT WEEK VIEW */}
        {timeframe === 'week' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 my-3">
            {weekDays.map((day) => {
              const isSelected = selectedDayKey === day.dateKey;
              return (
                <button
                  type="button"
                  key={day.dateKey}
                  onClick={() => setSelectedDayKey(isSelected ? null : day.dateKey)}
                  className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                    getIntensityClasses(day.intensity, day.isToday, isSelected)
                  }`}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="text-[11px] uppercase tracking-wider font-bold opacity-80">
                      {format(day.date, 'EEE')}
                    </span>
                    {day.isToday && (
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-primary/20 text-primary font-extrabold rounded">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[14px] font-semibold">
                    {format(day.date, 'MMM d')}
                  </span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-[20px] font-headline-md font-bold leading-none">
                      {day.count}
                    </span>
                    <span className="text-[11px] opacity-80 font-medium">
                      {day.count === 1 ? 'job' : 'jobs'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. CURRENT MONTH VIEW */}
        {timeframe === 'month' && (
          <div className="my-3 bg-surface p-4 rounded-xl border border-outline-variant/20">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {monthCalendarData.map((day) => {
                const isSelected = selectedDayKey === day.dateKey;
                return (
                  <button
                    type="button"
                    key={day.dateKey}
                    onClick={() => setSelectedDayKey(isSelected ? null : day.dateKey)}
                    className={`aspect-square sm:aspect-[4/3] rounded-lg p-1.5 sm:p-2 border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      getIntensityClasses(day.intensity, day.isToday, isSelected)
                    } ${!day.inCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[11px] sm:text-[12px] font-bold leading-none">
                        {format(day.date, 'd')}
                      </span>
                      {day.count > 0 && (
                        <span className="text-[10px] font-bold px-1 rounded-sm leading-tight">
                          {day.count}
                        </span>
                      )}
                    </div>
                    {day.isToday && (
                      <span className="text-[8px] uppercase tracking-tighter text-primary font-bold hidden sm:inline-block">
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. ALL-TIME CONTRIBUTION HEATMAP */}
        {timeframe === 'all' && (
          <div className="my-3 bg-surface p-4 rounded-xl border border-outline-variant/20 overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] text-on-surface-variant font-medium">
                <span>Recent 16 weeks activity:</span>
              </div>
              <div className="flex gap-1.5">
                {allTimeCalendarWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
                    {week.map((day) => {
                      const isSelected = selectedDayKey === day.dateKey;
                      return (
                        <button
                          type="button"
                          key={day.dateKey}
                          onClick={() => setSelectedDayKey(isSelected ? null : day.dateKey)}
                          title={`${day.dateKey}: ${day.count} application(s)`}
                          className={`w-full aspect-square rounded-[4px] border transition-all cursor-pointer ${
                            getIntensityClasses(day.intensity, day.isToday, isSelected)
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-between mt-3 text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <div className="w-3 h-3 rounded-[2px] bg-surface-container-low border border-outline-variant/20" title="0 applications" />
            <div className="w-3 h-3 rounded-[2px] bg-primary/25 border border-primary/20" title="1 application" />
            <div className="w-3 h-3 rounded-[2px] bg-primary/60 border border-primary/40" title="2 applications" />
            <div className="w-3 h-3 rounded-[2px] bg-primary border border-primary shadow-xs" title="3+ applications" />
            <span>More</span>
          </div>

          <div className="text-[11px] text-on-surface-variant">
            {stats.daysWithApplications} active days tracked
          </div>
        </div>

        {/* Inspected Day Details Drawer */}
        {selectedDayInfo && (
          <div className="mt-4 p-4 rounded-xl bg-surface border border-primary/20 shadow-xs animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-[14px] font-bold text-on-surface">
                  {format(selectedDayInfo.date, 'EEEE, MMMM d, yyyy')}
                </span>
                {selectedDayInfo.isToday && (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="text-[12px] text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            {selectedDayInfo.count === 0 ? (
              <p className="text-[13px] text-on-surface-variant m-0">
                No job applications were submitted on this date.
              </p>
            ) : (
              <div className="space-y-2 mt-2">
                <p className="text-[12px] font-bold text-primary m-0">
                  {selectedDayInfo.count} {selectedDayInfo.count === 1 ? 'application' : 'applications'} submitted:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedDayInfo.jobs.map((job) => (
                    <div 
                      key={job.id} 
                      className="p-2.5 rounded-lg bg-white border border-outline-variant/30 flex justify-between items-center gap-2 text-[13px]"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-on-surface truncate">{job.position}</div>
                        <div className="text-primary font-medium truncate">{job.company}</div>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant shrink-0 border border-outline-variant/20">
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
