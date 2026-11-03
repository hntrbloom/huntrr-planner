import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays, 
  subWeeks,
  differenceInCalendarDays, 
  differenceInCalendarWeeks,
  format
} from 'date-fns';
import { JobApplication } from '../components/JobApplicationsView';

export interface JobSummary {
  id: string;
  company: string;
  position: string;
  dateApplied: string;
  status: string;
  isPast?: boolean;
}

export interface DayApplicationData {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  count: number;
  jobs: JobSummary[];
  isToday: boolean;
  isFuture: boolean;
  intensity: 0 | 1 | 2 | 3; // 0 = none, 1 = 1 app, 2 = 2 apps, 3 = 3+ apps
}

export interface JobStreakStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
  currentWeeklyStreak: number;
  bestWeeklyStreak: number;
  dailyAverage: number;
  weeklyAverage: number;
  weeklyGoal: number;
  isGoalMetThisWeek: boolean;
  daysWithApplications: number;
  earliestDateStr: string | null;
  dayDataMap: Map<string, DayApplicationData>;
}

/**
 * Filter rule:
 * - Must have dateApplied
 * - Exclude Draft, Considering, Imported
 * - Include Applied, Interview, Offer, Rejected, Accepted, etc.
 * - Moving to Active, Past, Rejected, etc. must not remove from stats
 */
export function isValidAppliedJob(app: JobApplication): boolean {
  if (!app || !app.dateApplied || typeof app.dateApplied !== 'string') return false;
  const trimmedDate = app.dateApplied.trim();
  if (!trimmedDate) return false;

  const rawStatus = (app.status || '').trim().toLowerCase();
  // Saved drafts, jobs being considered, imported jobs, or not completed jobs are excluded
  if (!rawStatus || rawStatus === 'draft' || rawStatus === 'considering' || rawStatus === 'imported' || rawStatus === 'not completed') {
    return false;
  }
  return true;
}

/**
 * Safely parse a date string into a local Date object.
 * Protects against timezone shifts when parsing YYYY-MM-DD strings.
 */
export function parseToLocalDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  
  // Match standard YYYY-MM-DD
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    // Set to local noon to avoid DST edge anomalies
    return new Date(y, mo, d, 12, 0, 0);
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
}

/**
 * Convert Date to local YYYY-MM-DD string
 */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculate all Job Application streak stats and activity breakdown
 */
export function calculateJobStreakStats(
  applications: JobApplication[],
  weeklyGoal = 5,
  referenceDate = new Date()
): JobStreakStats {
  const todayKey = toLocalDateKey(referenceDate);
  const now = referenceDate;
  
  // Deduplicate and filter valid applied jobs
  const seenIds = new Set<string>();
  const validAppliedJobs: { job: JobApplication; localDate: Date; dateKey: string }[] = [];

  for (const app of applications) {
    if (!app || !app.id) continue;
    if (seenIds.has(app.id)) continue;
    
    if (isValidAppliedJob(app)) {
      const localDate = parseToLocalDate(app.dateApplied);
      if (localDate) {
        seenIds.add(app.id);
        const dateKey = toLocalDateKey(localDate);
        validAppliedJobs.push({
          job: app,
          localDate,
          dateKey
        });
      }
    }
  }

  // Build Day Map
  const dayDataMap = new Map<string, DayApplicationData>();

  for (const item of validAppliedJobs) {
    const { job, localDate, dateKey } = item;
    const existing = dayDataMap.get(dateKey);
    const jobSummary: JobSummary = {
      id: job.id,
      company: job.company || 'Unknown Company',
      position: job.position || 'Untitled Position',
      dateApplied: job.dateApplied,
      status: job.status,
      isPast: job.isPast
    };

    if (existing) {
      existing.count += 1;
      existing.jobs.push(jobSummary);
      existing.intensity = existing.count >= 3 ? 3 : existing.count === 2 ? 2 : 1;
    } else {
      const isToday = dateKey === todayKey;
      const isFuture = dateKey > todayKey;
      dayDataMap.set(dateKey, {
        dateStr: dateKey,
        date: localDate,
        count: 1,
        jobs: [jobSummary],
        isToday,
        isFuture,
        intensity: 1
      });
    }
  }

  // 1. Applications Today
  const todayData = dayDataMap.get(todayKey);
  const todayCount = todayData ? todayData.count : 0;

  // 2. Applications This Week (Sunday to Saturday)
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const startWeekKey = toLocalDateKey(currentWeekStart);
  const endWeekKey = toLocalDateKey(currentWeekEnd);

  let thisWeekCount = 0;
  // 3. Applications This Month
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let thisMonthCount = 0;

  for (const item of validAppliedJobs) {
    if (item.dateKey >= startWeekKey && item.dateKey <= endWeekKey) {
      thisWeekCount++;
    }
    if (item.localDate.getFullYear() === currentYear && item.localDate.getMonth() === currentMonth) {
      thisMonthCount++;
    }
  }

  // 4. Total Applications
  const totalCount = validAppliedJobs.length;

  // 5. Daily Streak calculation
  // Current daily streak: consecutive days with at least 1 application
  let currentDailyStreak = 0;
  const todayApplied = (dayDataMap.get(todayKey)?.count || 0) > 0;
  
  if (todayApplied) {
    // Streak starting today counting backwards
    currentDailyStreak = 1;
    let checkDate = subDays(now, 1);
    while (true) {
      const k = toLocalDateKey(checkDate);
      if ((dayDataMap.get(k)?.count || 0) > 0) {
        currentDailyStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  } else {
    // If user hasn't applied today yet, check if yesterday had an application
    const yesterday = subDays(now, 1);
    const yesterdayKey = toLocalDateKey(yesterday);
    if ((dayDataMap.get(yesterdayKey)?.count || 0) > 0) {
      currentDailyStreak = 1;
      let checkDate = subDays(yesterday, 1);
      while (true) {
        const k = toLocalDateKey(checkDate);
        if ((dayDataMap.get(k)?.count || 0) > 0) {
          currentDailyStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
    } else {
      currentDailyStreak = 0;
    }
  }

  // 6. Longest Daily Streak in all history
  const activeDateKeys = Array.from(dayDataMap.keys())
    .filter(k => (dayDataMap.get(k)?.count || 0) > 0)
    .sort();

  let longestDailyStreak = 0;
  let runningDailyStreak = 0;
  let prevDate: Date | null = null;

  for (const key of activeDateKeys) {
    const d = parseToLocalDate(key);
    if (!d) continue;
    if (!prevDate) {
      runningDailyStreak = 1;
      longestDailyStreak = 1;
    } else {
      const diff = differenceInCalendarDays(d, prevDate);
      if (diff === 1) {
        runningDailyStreak++;
      } else if (diff > 1) {
        runningDailyStreak = 1;
      }
      if (runningDailyStreak > longestDailyStreak) {
        longestDailyStreak = runningDailyStreak;
      }
    }
    prevDate = d;
  }

  // 7. Weekly Streaks & Goal tracking
  // Aggregate application count by week key (Sunday start)
  const weekCountMap = new Map<string, number>();

  for (const item of validAppliedJobs) {
    const wStart = startOfWeek(item.localDate, { weekStartsOn: 0 });
    const wKey = toLocalDateKey(wStart);
    weekCountMap.set(wKey, (weekCountMap.get(wKey) || 0) + 1);
  }

  const currentWeekStartKey = toLocalDateKey(currentWeekStart);
  const currentWeekTotal = weekCountMap.get(currentWeekStartKey) || 0;
  const isGoalMetThisWeek = currentWeekTotal >= weeklyGoal;

  let currentWeeklyStreak = 0;
  if (isGoalMetThisWeek) {
    // Current week hit the goal, count current week + backward
    currentWeeklyStreak = 1;
    let checkWeek = subWeeks(currentWeekStart, 1);
    while (true) {
      const k = toLocalDateKey(checkWeek);
      if ((weekCountMap.get(k) || 0) >= weeklyGoal) {
        currentWeeklyStreak++;
        checkWeek = subWeeks(checkWeek, 1);
      } else {
        break;
      }
    }
  } else {
    // Current week is ongoing. If previous week reached the goal, current weekly streak is preserved from last week
    const lastWeek = subWeeks(currentWeekStart, 1);
    const lastWeekKey = toLocalDateKey(lastWeek);
    if ((weekCountMap.get(lastWeekKey) || 0) >= weeklyGoal) {
      currentWeeklyStreak = 1;
      let checkWeek = subWeeks(lastWeek, 1);
      while (true) {
        const k = toLocalDateKey(checkWeek);
        if ((weekCountMap.get(k) || 0) >= weeklyGoal) {
          currentWeeklyStreak++;
          checkWeek = subWeeks(checkWeek, 1);
        } else {
          break;
        }
      }
    } else {
      currentWeeklyStreak = 0;
    }
  }

  // Best weekly streak across all history
  let bestWeeklyStreak = 0;
  if (validAppliedJobs.length > 0) {
    // Find earliest application date
    let earliestLocalDate = validAppliedJobs[0].localDate;
    for (const item of validAppliedJobs) {
      if (item.localDate < earliestLocalDate) {
        earliestLocalDate = item.localDate;
      }
    }

    const earliestWeekStart = startOfWeek(earliestLocalDate, { weekStartsOn: 0 });
    const totalWeeksSpan = Math.max(1, differenceInCalendarWeeks(now, earliestWeekStart, { weekStartsOn: 0 }) + 1);

    let runningWeekRun = 0;
    let cursorWeek = earliestWeekStart;

    for (let i = 0; i < totalWeeksSpan; i++) {
      const wKey = toLocalDateKey(cursorWeek);
      const countInWeek = weekCountMap.get(wKey) || 0;
      if (countInWeek >= weeklyGoal) {
        runningWeekRun++;
        if (runningWeekRun > bestWeeklyStreak) {
          bestWeeklyStreak = runningWeekRun;
        }
      } else {
        runningWeekRun = 0;
      }
      cursorWeek = new Date(cursorWeek.getFullYear(), cursorWeek.getMonth(), cursorWeek.getDate() + 7, 12, 0, 0);
    }
  }

  // 8. Daily and Weekly Averages
  let dailyAverage = 0;
  let weeklyAverage = 0;
  let earliestDateStr: string | null = null;

  if (totalCount > 0) {
    let minD = validAppliedJobs[0].localDate;
    for (const item of validAppliedJobs) {
      if (item.localDate < minD) {
        minD = item.localDate;
      }
    }
    earliestDateStr = toLocalDateKey(minD);

    const daysElapsed = Math.max(1, differenceInCalendarDays(now, minD) + 1);
    dailyAverage = parseFloat((totalCount / daysElapsed).toFixed(1));

    const weeksElapsed = Math.max(1, differenceInCalendarWeeks(now, minD, { weekStartsOn: 0 }) + 1);
    weeklyAverage = parseFloat((totalCount / weeksElapsed).toFixed(1));
  }

  return {
    today: todayCount,
    thisWeek: thisWeekCount,
    thisMonth: thisMonthCount,
    total: totalCount,
    currentDailyStreak,
    longestDailyStreak,
    currentWeeklyStreak,
    bestWeeklyStreak,
    dailyAverage,
    weeklyAverage,
    weeklyGoal,
    isGoalMetThisWeek,
    daysWithApplications: activeDateKeys.length,
    earliestDateStr,
    dayDataMap
  };
}
