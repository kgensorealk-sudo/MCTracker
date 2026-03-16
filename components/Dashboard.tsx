
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { Manuscript, Status, UserSchedule } from '../types';
import { AlertCircle, CheckCircle, Zap, Inbox, TrendingUp, Activity, Coffee, Settings, Briefcase, Info, Trophy, AlertTriangle, Timer, Flame, Target, Calendar, Coins, RefreshCcw, History as HistoryIcon, Mail } from 'lucide-react';
import { calculateXP, calculateLevel, ALL_DAILY_QUESTS, ACHIEVEMENTS } from '../services/gamification';
import { useCycleDates } from '../hooks/useCycleDates';

interface DashboardProps {
  manuscripts: Manuscript[];
  target: number;
  userSchedule: UserSchedule;
  onUpdateTarget: (target: number) => void;
  onFilterClick: (status: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER') => void;
  onUpdateSchedule: (schedule: UserSchedule) => void;
  onViewHistory?: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-100 shadow-xl rounded-lg text-xs">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map((p: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke || p.fill }}></div>
              <span className="text-slate-500 capitalize">{p.name}:</span>
              <span className="font-bold text-slate-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Helper: Get local date string YYYY-MM-DD to ensure consistent day-of-week mapping
const getLocalISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Shuffle array and pick N items
const pickRandom = (arr: string[], count: number) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Isolated Clock Component to prevent Dashboard re-renders
const HeaderClock: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    let timeoutId: any;
    let intervalId: any;

    const tick = () => setCurrentDate(new Date());
    
    // Sync to second to avoid drift jitter
    const now = new Date();
    const delay = 1000 - now.getMilliseconds();
    
    timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="text-right mt-2 sm:mt-0 min-w-[140px]">
       <p className="text-2xl font-mono font-medium text-slate-700 tracking-tight">
          {currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
       </p>
       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
       </p>
    </div>
  );
};

// Helper: Get relative time string
const getRelativeTime = (date: string | number | Date) => {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return then.toLocaleDateString();
};

const Dashboard: React.FC<DashboardProps> = ({ 
  manuscripts, 
  target, 
  userSchedule,
  onUpdateTarget, 
  onFilterClick,
  onUpdateSchedule,
  onViewHistory
}) => {
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Default weights if missing (Full week)
  const weights = userSchedule.weeklyWeights || [1, 1, 1, 1, 1, 1, 1];

  // Auto-cycle tips every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 1. Calculate Cycle Dates Logic (Reusable)
  const cycleDates = useCycleDates();
  const { startDate, endDate } = cycleDates;

  // --- Statistics Logic (Both Overall and Cycle) ---
  const stats = useMemo(() => {
    const inCycle = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= cycleDates.startDate && d <= cycleDates.endDate;
    };

    // Overall Totals
    const totalFiles = manuscripts.length;
    const totalWorked = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.BILLED).length;
    const totalUntouched = manuscripts.filter(m => m.status === Status.UNTOUCHED).length;
    const totalPending = manuscripts.filter(m => [Status.PENDING, Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;

    // Cycle Specifics
    const cycleReceived = manuscripts.filter(m => inCycle(m.dateReceived)).length;
    
    // Cycle Worked: Billed or Completed Date falls in cycle
    // We prioritize billedDate, then completedDate, then dateStatusChanged.
    // We avoid dateUpdated as it changes on any edit (like adding notes).
    const cycleWorked = manuscripts.filter(m => {
      if (m.status !== Status.WORKED && m.status !== Status.BILLED) return false;
      
      // Use the most specific completion/billing date available
      const relevantDate = m.billedDate || m.completedDate || m.dateStatusChanged;
      
      if (relevantDate) {
        return inCycle(relevantDate);
      }
      
      // Fallback for legacy data: if no status change date, use dateUpdated 
      // ONLY if it's the same as dateReceived (meaning it was likely imported and worked immediately)
      // or if we have no other choice.
      return inCycle(m.dateUpdated);
    }).length;

    // Cycle Untouched: Untouched AND Received in this cycle
    const cycleUntouched = manuscripts.filter(m => 
      m.status === Status.UNTOUCHED && inCycle(m.dateReceived)
    ).length;

    // Cycle Pending: Pending AND Status Changed in this cycle (Fresh queries)
    const cyclePending = manuscripts.filter(m => 
      [Status.PENDING, Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && 
      inCycle(m.dateStatusChanged || m.dateUpdated)
    ).length;

    // Breakdown for Pending Stat Card
    const pendingBreakdown = {
       JM: manuscripts.filter(m => m.status === Status.PENDING_JM || (m.status === Status.PENDING && m.pendingFlags?.jm)).length,
       TL: manuscripts.filter(m => m.status === Status.PENDING_TL || (m.status === Status.PENDING && m.pendingFlags?.tl)).length,
       CED: manuscripts.filter(m => m.status === Status.PENDING_CED || (m.status === Status.PENDING && m.pendingFlags?.ced)).length
    };

    return {
      totalFiles,
      totalWorked,
      totalUntouched,
      totalPending,
      cycleReceived,
      cycleWorked,
      cycleUntouched,
      cyclePending,
      pendingBreakdown
    };
  }, [manuscripts, cycleDates]);

  // --- Efficiency Insights & Urgent Watchlist ---
  const { insights, urgentItems, recentActivity } = useMemo(() => {
    // 1. Efficiency Insights
    const worked = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.BILLED);
    
    // Turnaround Time
    let avgTat = "0.0";
    if (worked.length > 0) {
        const totalDays = worked.reduce((acc, m) => {
            const start = new Date(m.dateReceived).getTime();
            const end = new Date(m.completedDate || m.dateStatusChanged || Date.now()).getTime();
            const diff = Math.max(0, (end - start) / (1000 * 3600 * 24));
            return acc + diff;
        }, 0);
        avgTat = (totalDays / worked.length).toFixed(1);
    }

    // Streak Logic
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const dateStr = getLocalISODate(checkDate);
        
        const hasWork = manuscripts.some(m => {
             if (m.status !== Status.WORKED && m.status !== Status.BILLED) return false;
             const d = m.completedDate || m.dateStatusChanged;
             return d && getLocalISODate(new Date(d)) === dateStr;
        });

        if (hasWork) streak++;
        else if (i === 0) continue; 
        else break; 
    }

    // 2. Urgent Watchlist
    const urgent = manuscripts
        .filter(m => m.status !== Status.WORKED && m.status !== Status.BILLED && m.priority === 'Urgent')
        .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime())
        .slice(0, 3);

    // 3. Recent Activity (Last 8 modified)
    const recent = [...manuscripts]
        .sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime())
        .slice(0, 8)
        .map(m => {
            let action = "Updated";
            if (m.status === Status.WORKED) action = "Completed";
            else if (m.status.startsWith('PENDING')) action = "Queried";
            else if (m.status === Status.BILLED) action = "Billed";
            else if (m.status === Status.UNTOUCHED && m.dateUpdated === m.dateReceived) action = "Imported";
            
            return { ...m, action };
        });

    return { 
        insights: { tat: avgTat, streak },
        urgentItems: urgent,
        recentActivity: recent
    };
  }, [manuscripts]);

  const projection = useMemo(() => {
    const { startDate, endDate } = cycleDates;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let totalCycleWeight = 0;
    let weightPassed = 0;
    
    const iter = new Date(startDate);
    while (iter <= endDate) {
      const isoDate = getLocalISODate(iter);
      const dayOfWeek = iter.getDay();
      const isOff = userSchedule.daysOff.includes(isoDate);
      const weight = isOff ? 0 : (weights[dayOfWeek] ?? 1);
      
      totalCycleWeight += weight;
      if (iter <= today) {
        weightPassed += weight;
      }
      iter.setDate(iter.getDate() + 1);
    }
    
    const worked = stats.cycleWorked;
    
    // Calculate how much of "today" has passed to avoid diluting pace early in the day
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + (24 * 60 * 60 * 1000);
    const dayProgress = Math.max(0.1, (now.getTime() - startOfToday) / (endOfToday - startOfToday));
    
    // Calculate Calendar Days Passed (more intuitive for users)
    const startOfCycle = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const calendarDaysPassed = Math.max(0.1, (now.getTime() - startOfCycle) / (24 * 60 * 60 * 1000));
    
    // Adjust weightPassed to account for partial day
    const todayWeight = weights[now.getDay()] ?? 1;
    const adjustedWeightPassed = weightPassed - todayWeight + (todayWeight * dayProgress);
    
    // Use Calendar Days for "Current Pace" (what user sees)
    // Use Adjusted Weight for "Projected Count" (what app forecasts)
    const currentPace = calendarDaysPassed > 0 ? worked / calendarDaysPassed : 0;
    const forecastPace = adjustedWeightPassed > 0 ? worked / adjustedWeightPassed : 0;
    const projectedCount = forecastPace * totalCycleWeight;
    const rates = userSchedule.cycleRates?.[cycleDates.cycleLabel] || { usd: 1.19, php: 70.41 };
    
    return {
      projectedCount: Math.round(projectedCount),
      projectedPayoutUSD: projectedCount * rates.usd,
      projectedPayoutPHP: projectedCount * rates.php,
      currentEarningsUSD: worked * rates.usd,
      currentEarningsPHP: worked * rates.php,
      isAhead: projectedCount >= target,
      pace: currentPace.toFixed(2)
    };
  }, [cycleDates, userSchedule, weights, stats.cycleWorked, target]);

  const contributionData = useMemo(() => {
    const data: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Initialize last 365 days
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      data[getLocalISODate(d)] = 0;
    }

    manuscripts.forEach(m => {
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
        const dateStr = m.completedDate || m.dateStatusChanged;
        if (dateStr) {
          const key = getLocalISODate(new Date(dateStr));
          if (data[key] !== undefined) {
             data[key] += 1;
          }
        }
      }
    });

    // Convert to array for rendering
    return Object.entries(data)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [manuscripts]);

  // --- Gamification Logic ---
  const levelData = useMemo(() => {
     const xp = calculateXP(manuscripts, target);
     return calculateLevel(xp);
  }, [manuscripts, target]);

  const questsWithProgress = useMemo(() => {
    return ALL_DAILY_QUESTS.map(quest => {
      const progress = quest.progress(manuscripts);
      const isCompleted = quest.isCompleted(manuscripts);
      const percent = Math.min(100, Math.round((progress / quest.target) * 100));
      return { ...quest, progressValue: progress, isCompleted, percent };
    });
  }, [manuscripts]);

  const unlockedAchievementsCount = useMemo(() => {
    return ACHIEVEMENTS.filter(a => a.condition(manuscripts, target)).length;
  }, [manuscripts, target]);

  const cycleData = useMemo(() => {
    const { endDate, startDate, cycleLabel } = cycleDates;
    const d = new Date();

    const percentage = Math.min(100, Math.round((stats.cycleWorked / target) * 100));

    // Calculate "Weighted Days Left" INCLUDING Today
    const tempToday = new Date();
    tempToday.setHours(0,0,0,0);
    
    let weightedDaysLeft = 0;
    const itrDate = new Date(tempToday);
    
    while (itrDate <= endDate) {
        const isoDate = getLocalISODate(itrDate);
        const dayOfWeek = itrDate.getDay(); 
        if (!userSchedule.daysOff.includes(isoDate)) {
           weightedDaysLeft += (weights[dayOfWeek] ?? 1);
        }
        itrDate.setDate(itrDate.getDate() + 1);
    }
    
    // Projected Finish Logic
    let projectedFinishStr = "N/A";
    const daysElapsed = Math.max(1, Math.ceil((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (stats.cycleWorked > 0) {
       const velocity = stats.cycleWorked / daysElapsed; // Items per day
       const remaining = Math.max(0, target - stats.cycleWorked);
       if (remaining === 0) {
          projectedFinishStr = "Done";
       } else {
          const daysToFinish = Math.ceil(remaining / velocity);
          const finishDate = new Date();
          finishDate.setDate(finishDate.getDate() + daysToFinish);
          projectedFinishStr = finishDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
       }
    } else if (stats.cycleWorked === 0) {
       projectedFinishStr = "Start working...";
    }

    return {
      label: cycleLabel,
      completed: stats.cycleWorked,
      percentage,
      weightedDaysLeft,
      projectedFinishStr,
      endDateStr: endDate.toLocaleString('default', { month: 'short', day: 'numeric' })
    };
  }, [manuscripts, target, userSchedule, cycleDates, stats.cycleWorked]);

  const dailyStats = useMemo(() => {
    const d = new Date();
    const isoToday = getLocalISODate(d);
    
    // Helper to check if a date is today
    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      return getLocalISODate(new Date(dateStr)) === isoToday;
    };

    // Helper to check if a date is in cycle
    const inCycle = (dateStr?: string) => {
      if (!dateStr) return false;
      const date = new Date(dateStr);
      return date >= cycleDates.startDate && date <= cycleDates.endDate;
    };

    // Count items worked TODAY that are part of the CURRENT CYCLE
    const todayCount = manuscripts.filter(m => {
      if (m.status !== Status.WORKED && m.status !== Status.BILLED) return false;
      
      const relevantDate = m.billedDate || m.completedDate || m.dateStatusChanged || m.dateUpdated;
      return isToday(relevantDate) && inCycle(relevantDate);
    }).length;

    // How many were completed in this cycle BEFORE today?
    const completedPriorToTodayInCycle = Math.max(0, cycleData.completed - todayCount);
    
    // How many were left to hit target at the START of today?
    const remainingForCycleFromStartOfDay = Math.max(0, target - completedPriorToTodayInCycle);
    
    // Calculate daily target
    const todayWeight = weights[d.getDay()] ?? 1;
    const isScheduledOff = userSchedule.daysOff.includes(isoToday) || todayWeight === 0;
    
    let safeDailyTarget = 0;
    
    if (!isScheduledOff && cycleData.completed < target) {
      // If we have workdays left (including today), distribute the remaining work
      const effectiveDivisor = Math.max(0.1, cycleData.weightedDaysLeft);
      const baseDailyTarget = remainingForCycleFromStartOfDay / effectiveDivisor;
      safeDailyTarget = Math.ceil(baseDailyTarget * todayWeight);
      
      // Cap at remaining for cycle
      if (safeDailyTarget > remainingForCycleFromStartOfDay) {
        safeDailyTarget = remainingForCycleFromStartOfDay;
      }
    }

    const remainingToday = Math.max(0, safeDailyTarget - todayCount);
    const percentage = safeDailyTarget > 0 
      ? Math.min(100, Math.round((todayCount / safeDailyTarget) * 100)) 
      : 100;
    
    return { 
      count: todayCount, 
      target: safeDailyTarget, 
      remaining: remainingToday, 
      percentage, 
      isDayOff: isScheduledOff,
      baseDailyTarget: remainingForCycleFromStartOfDay / Math.max(0.1, cycleData.weightedDaysLeft)
    };
  }, [manuscripts, target, cycleData, userSchedule, cycleDates, weights]);

  // --- Smart Planning & Coaching Logic ---
  const { forecast, coachingMessage } = useMemo(() => {
    const { endDate, startDate } = cycleDates;
    const remainingToTarget = Math.max(0, target - stats.cycleWorked);
    
    // Calculate total cycle days accurately
    const totalCycleDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    
    const forecastDays = [];
    const itrDate = new Date();
    itrDate.setDate(itrDate.getDate() + 1);
    itrDate.setHours(0,0,0,0);

    let futureWeightedDays = 0;
    
    const tempItr = new Date(itrDate);
    while (tempItr <= endDate) {
        const isoDate = getLocalISODate(tempItr);
        const dayOfWeek = tempItr.getDay();
        if (!userSchedule.daysOff.includes(isoDate)) {
           futureWeightedDays += (weights[dayOfWeek] ?? 1);
        }
        tempItr.setDate(tempItr.getDate() + 1);
    }

    const safeFutureDivisor = Math.max(0.1, futureWeightedDays);
    const futureBaseUnit = remainingToTarget / safeFutureDivisor;

    while (itrDate <= endDate) {
       const isoDate = getLocalISODate(itrDate);
       const dayOfWeek = itrDate.getDay();
       const isOff = userSchedule.daysOff.includes(isoDate) || weights[dayOfWeek] === 0;
       const weight = isOff ? 0 : weights[dayOfWeek];
       
       let dayTarget = 0;
       if (!isOff) {
          dayTarget = Math.ceil(futureBaseUnit * weight);
       }

       if (remainingToTarget <= 0) dayTarget = 0;

       forecastDays.push({
         date: new Date(itrDate),
         dayName: itrDate.toLocaleDateString('en-US', { weekday: 'short' }),
         dateStr: itrDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
         target: dayTarget,
         isOff,
         weight
       });
       
       itrDate.setDate(itrDate.getDate() + 1);
    }

    const itemsLeft = Math.max(0, target - stats.cycleWorked);
    const avgNeededPerWorkDay = cycleData.weightedDaysLeft > 0 
        ? (itemsLeft / cycleData.weightedDaysLeft) 
        : itemsLeft; 

    const idealDailyPace = Math.max(1, target / totalCycleDays);
    
    // Status Logic
    const isBehind = avgNeededPerWorkDay > (idealDailyPace * 1.2); 
    const isWayBehind = avgNeededPerWorkDay > (idealDailyPace * 1.6); 
    const isLastDay = getLocalISODate(new Date()) === getLocalISODate(endDate);
    
    let title = "";
    let messages: string[] = [];
    let type: "success" | "warning" | "neutral" | "danger" | "info" = "neutral";
    
    const remainingToday = dailyStats.remaining;
    const countToday = dailyStats.count;
    const avgNeeded = Math.ceil(avgNeededPerWorkDay);

    if (stats.cycleWorked >= target) {
       title = "Cycle Complete!";
       messages = [
         "You've hit the target! Everything else is bonus.",
         "Amazing work! You've secured the cycle early.",
         "Use this time to organize for the next cycle or take a breather."
       ];
       type = "success";
    } else if (isLastDay) {
       title = "Final Day Sprint";
       messages = [
          `Cycle ends today! ${remainingToTarget} files remaining.`,
          "Last push to hit the green target.",
          "Finish strong!"
       ];
       type = remainingToTarget > 5 ? "danger" : "warning";
    } else if (dailyStats.isDayOff) {
       title = "Recharge Mode";
       if (dailyStats.count > 0) {
         messages = [
            "You're chipping away even on your day off. That's dedication!",
            "Any progress today is a bonus. Don't burn out!",
            `You've already finished ${dailyStats.count} items. Great hustle.`
         ];
         type = "success";
       } else {
         messages = [
            "Rest is productive too. Come back stronger tomorrow.",
            "Enjoy the break! A fresh mind works faster.",
            "No output needed today. Relax."
         ];
         type = "neutral";
       }
    } else {
       if (remainingToday <= 0) {
          title = "Daily Target Met";
          messages = [
            "You've hit your daily goal. Pushing further is great, but you're safely on track.",
            "Great job today! You are perfectly on track for the cycle.",
            "Feel free to bank some extra files to make tomorrow easier."
          ];
          type = "success";
       } else if (remainingToday <= 5 && countToday > 0) {
          // Context-aware "Almost There"
          if (isWayBehind) {
              title = "Almost Saved The Day";
              messages = [
                 `Finish these last ${remainingToday} files to stop falling further behind.`,
                 "Crucial push! Complete today's quota to stabilize the cycle.",
                 "Don't give up now, finishing today's load is vital."
              ];
              type = "warning";
          } else {
              title = "Almost There";
              messages = [
                 `You've completed ${countToday} files today, ${remainingToday} more to keep on pace.`,
                 "Pushing further will be great to build a safety buffer.",
                 "Just a final sprint to clear today's quota!"
              ];
              type = "info";
          }
       } else if (isWayBehind) {
          title = "Heavy Lifting";
          messages = [
            "Feel tired? Rest and take a nap, and hustle back hard. We're still a long way.",
            `We need to average ${avgNeeded} files per working day to catch up.`,
            "Don't panic. Focus on one file at a time.",
            "Consider prioritizing the easiest files first to build momentum."
          ];
          type = "danger";
       } else if (isBehind) {
          title = "Let's Catch Up";
          messages = [
             `We need ${remainingToday} more today to stay on track.`,
             `Hey buddy, looks like we are out of pace. Please push further today.`,
             `Aim for about ${avgNeeded} items each subsequent day to smooth out the load.`,
             `Achieve at least ${dailyStats.target} files today to keep the pace.`
          ];
          type = "warning";
       } else {
          // On Track
          title = "On Track";
          messages = [
             `You're doing great! Just ${remainingToday} more to hit today's goal.`,
             "Pace is looking good. Keep this rhythm going.",
             `Steady progress. Finish ${remainingToday} more to bank a perfect day.`,
             "You're right where you need to be. Keep it up!"
          ];
          type = "info";
       }
    }
    
    const displayMessages = messages.length > 3 ? pickRandom(messages, 3) : messages;
    return { forecast: forecastDays, coachingMessage: { title, messages: displayMessages, type } };

  }, [stats.cycleWorked, target, cycleDates, userSchedule, weights, dailyStats]);


  const toggleTodayOff = () => {
    const today = getLocalISODate(new Date());
    const currentOffs = userSchedule.daysOff;
    const newOffs = currentOffs.includes(today) 
      ? currentOffs.filter(d => d !== today)
      : [...currentOffs, today];
    onUpdateSchedule({ ...userSchedule, daysOff: newOffs });
  };

  const updateWeeklyWeight = (dayIndex: number, weight: number) => {
    const newWeights = [...weights];
    newWeights[dayIndex] = weight;
    onUpdateSchedule({ ...userSchedule, weeklyWeights: newWeights });
  };

  // --- CHART DATA PREPARATION ---

  // 1. Burn-up Chart Data (Trend)
  const trendData = useMemo(() => {
     const data = [];
     const { startDate, endDate } = cycleDates;
     const now = new Date();
     
     const iterDate = new Date(startDate);
     const stopDate = new Date(endDate);
     stopDate.setHours(23,59,59,999);
     
     let cumulativeCompleted = 0;
     const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
     const idealPerDay = target / totalDays;

     let dayIndex = 0;

     while (iterDate <= stopDate) {
        const dateStr = getLocalISODate(iterDate);
        const displayDate = iterDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        
        const dailyCompleted = manuscripts.filter(m => {
           if (m.status !== Status.WORKED) return false;
           const dRaw = m.completedDate || m.dateStatusChanged || m.dateUpdated;
           if (!dRaw) return false;
           const d = new Date(dRaw);
           return getLocalISODate(d) === dateStr;
        }).length;

        cumulativeCompleted += dailyCompleted;

        const ideal = Math.min(target, Math.round(idealPerDay * (dayIndex + 1)));
        
        if (iterDate <= now || getLocalISODate(iterDate) === getLocalISODate(now)) {
           data.push({
             date: displayDate,
             completed: cumulativeCompleted,
             ideal: ideal,
             isFuture: false
           });
        } else {
           data.push({
             date: displayDate,
             ideal: ideal,
             isFuture: true
           });
        }

        iterDate.setDate(iterDate.getDate() + 1);
        dayIndex++;
     }
     return data;
  }, [manuscripts, cycleDates, target]);

  // Determine active message for carousel
  const activeMsgIndex = currentTipIndex % coachingMessage.messages.length;
  const activeMsg = coachingMessage.messages[activeMsgIndex];

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header with Date & Level Banner */}
      <div className="flex flex-col gap-6 border-b border-slate-200/60 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center">
          <div>
             <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h2>
             <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm font-medium">Overview of your productivity and workflow</p>
                <button 
                  onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 font-bold ${showScheduleSettings ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:text-brand-600 hover:border-brand-200'}`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  {showScheduleSettings ? 'Close Settings' : 'Smart Pacing'}
                </button>
             </div>
          </div>
          <HeaderClock />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Level Banner */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 rounded-3xl p-6 flex items-center gap-6 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden ring-1 ring-white/10 h-full"
          >
             <div className="absolute right-0 top-0 opacity-5 transform translate-x-4 -translate-y-4">
                <Trophy className="w-32 h-32" />
             </div>
             
             <div className="flex flex-col items-center gap-2 shrink-0 z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-xl border-2 border-white/20 shadow-lg">
                   {levelData.level}
                </div>
                <div className="bg-white/10 px-2 py-0.5 rounded-full border border-white/5">
                   <span className="text-[9px] font-black text-brand-300">{levelData.currentXP} XP</span>
                </div>
             </div>
             <div className="flex-1 z-10">
                <div className="flex justify-between items-end mb-2">
                   <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Current Rank</span>
                      <h3 className="font-bold text-lg leading-tight text-brand-300">{levelData.title}</h3>
                   </div>
                   <div className="text-right">
                      <span className="text-xs font-mono text-slate-400 font-bold">
                         {levelData.currentXP} <span className="text-slate-600">/</span> {levelData.nextLevelXP} XP
                      </span>
                      {levelData.nextRankTitle && (
                         <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            Next: {levelData.nextRankTitle}
                         </div>
                      )}
                   </div>
                </div>
                <div className="flex justify-between items-center mb-1.5">
                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Level Progress</div>
                   <div className="text-[10px] font-black text-brand-400">{levelData.progressPercent}%</div>
                </div>
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5 mb-4">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${levelData.progressPercent}%` }}
                     transition={{ duration: 1, ease: "easeOut" }}
                     className="h-full bg-gradient-to-r from-brand-400 to-brand-600 shadow-[0_0_15px_rgba(14,165,233,0.5)] rounded-full"
                   />
                </div>

                <div className="grid grid-cols-3 gap-3">
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex items-center gap-2">
                      <div className="p-1.5 bg-brand-500/10 rounded-lg">
                         <CheckCircle className="w-3 h-3 text-brand-400" />
                      </div>
                      <div>
                         <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Completed</div>
                         <div className="text-[10px] font-bold font-mono">{manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.BILLED).length}</div>
                      </div>
                   </div>
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex items-center gap-2">
                      <div className="p-1.5 bg-brand-500/10 rounded-lg">
                         <Trophy className="w-3 h-3 text-brand-400" />
                      </div>
                      <div>
                         <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Badges</div>
                         <div className="text-[10px] font-bold font-mono">{unlockedAchievementsCount} / {ACHIEVEMENTS.length}</div>
                      </div>
                   </div>
                   <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex items-center gap-2">
                      <div className="p-1.5 bg-brand-500/10 rounded-lg">
                         <TrendingUp className="w-3 h-3 text-brand-400" />
                      </div>
                      <div>
                         <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">To Level Up</div>
                         <div className="text-[10px] font-bold font-mono">{levelData.nextLevelXP - levelData.currentXP} XP</div>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>

          {/* Daily Quests Section - List View */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col h-full">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-brand-500/10 rounded-lg">
                      <Target className="w-3.5 h-3.5 text-brand-500" />
                   </div>
                   <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Daily Grind Quests</h3>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex -space-x-1">
                      {questsWithProgress.map((q) => (
                         <div 
                           key={q.id} 
                           className={`w-1.5 h-1.5 rounded-full border border-white ${q.isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`}
                         />
                      ))}
                   </div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {questsWithProgress.filter(q => q.isCompleted).length} / {questsWithProgress.length}
                   </span>
                </div>
             </div>
             
             <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {questsWithProgress.map((quest) => (
                   <div 
                     key={quest.id}
                     className={`group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                       quest.isCompleted ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100 hover:border-brand-100 hover:bg-slate-50/50'
                     }`}
                   >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${quest.isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500'}`}>
                         {quest.isCompleted ? <CheckCircle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-0.5">
                            <div>
                               <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className={`text-xs font-bold truncate ${quest.isCompleted ? 'text-emerald-900' : 'text-slate-700'}`}>{quest.title}</h4>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${
                                    quest.isCompleted ? 'bg-emerald-100/50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'
                                  }`}>
                                     {quest.isCompleted ? 'Completed' : 'Daily'}
                                  </span>
                               </div>
                               <p className="text-[10px] text-slate-400 leading-tight truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                                  {quest.description}
                               </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0 ml-2">
                               <div className="flex items-center gap-1 text-emerald-600">
                                  <Coins className="w-2.5 h-2.5" />
                                  <span className="text-[9px] font-black">+{quest.rewardXP} XP</span>
                               </div>
                               <span className="text-[9px] font-mono font-bold text-slate-400">
                                  {quest.progressValue} / {quest.target}
                               </span>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${quest.percent}%` }}
                                 className={`h-full rounded-full ${quest.isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-brand-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]'}`}
                               />
                            </div>
                            <span className={`text-[9px] font-bold min-w-[24px] text-right ${quest.isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                               {quest.percent}%
                            </span>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showScheduleSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-10 shadow-sm mb-8">
               {/* Weekly Routine */}
               <div className="flex flex-col gap-4">
                 <div className="flex items-start gap-4">
                    <div className="p-3 bg-brand-50 rounded-2xl shrink-0">
                      <Briefcase className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                       <h4 className="text-base font-bold text-slate-900">Weekly Routine</h4>
                       <p className="text-sm text-slate-500 mt-1">
                         Adjust your typical workload to calculate smarter daily targets.
                       </p>
                    </div>
                 </div>
                 
                 <div className="mt-2 grid grid-cols-7 gap-3">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                      const weight = weights[idx] ?? 1;
                      return (
                        <button
                          key={day}
                          onClick={() => updateWeeklyWeight(idx, weight === 1 ? 0 : 1)}
                          className={`py-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-2 ${
                             weight > 0 
                              ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' 
                              : 'bg-slate-50 border-slate-100 text-slate-300'
                          }`}
                        >
                          <span>{day}</span>
                          <span className={`w-2 h-2 rounded-full ${weight > 0 ? 'bg-brand-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]' : 'bg-slate-200'}`}></span>
                        </button>
                      )
                    })}
                 </div>
               </div>

               {/* Toggle Today */}
               <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                     <div className="p-3 bg-rose-50 rounded-2xl shrink-0">
                       <Coffee className="w-6 h-6 text-rose-600" />
                     </div>
                     <div className="flex-1">
                        <h4 className="text-base font-bold text-slate-900">Instant Day Off</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Taking a break today? Toggle this to pause your daily target.
                        </p>
                     </div>
                     <button
                       onClick={toggleTodayOff}
                       className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-rose-100 ${
                         dailyStats.isDayOff ? 'bg-rose-600' : 'bg-slate-200'
                       }`}
                     >
                       <motion.span 
                         animate={{ x: dailyStats.isDayOff ? 24 : 4 }}
                         className="inline-block h-5 w-5 rounded-full bg-white shadow-sm"
                       />
                     </button>
                  </div>

                  {/* Quick Target Edit */}
                  <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-sm font-bold text-slate-700">Cycle Goal:</span>
                     <div className="flex items-center gap-3">
                        <button 
                          onClick={() => onUpdateTarget(Math.max(1, target - 5))}
                          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold transition-all active:scale-90"
                        >-</button>
                        <span className="text-xl font-mono font-bold w-12 text-center text-slate-900">{target}</span>
                        <button 
                          onClick={() => onUpdateTarget(target + 5)}
                          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold transition-all active:scale-90"
                        >+</button>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* Cycle Progress Card */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-slate-200/50"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Target className="w-20 h-20" />
           </div>
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cycle Progress</p>
                 <p className="text-xs text-slate-500 font-bold mt-1">{cycleData.label}</p>
                 <div className="flex items-center gap-1.5 mt-1 opacity-60">
                   <Calendar className="w-3 h-3" />
                   <span className="text-[9px] font-bold tracking-wider">
                     {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                   </span>
                 </div>
              </div>
              <div className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border shadow-sm ${cycleData.percentage >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-brand-50 text-brand-700 border-brand-100'}`}>
                 {cycleData.percentage}%
              </div>
           </div>
           <div className="flex items-baseline gap-1.5 relative z-10">
              <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{stats.cycleWorked}</h3>
              <span className="text-sm text-slate-400 font-bold">/ {target}</span>
           </div>
           <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${cycleData.percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${cycleData.percentage >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} 
              />
           </div>
           <div className="mt-3 flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest relative z-10">
              <span>Ends {cycleData.endDateStr}</span>
              <span>Proj: {cycleData.projectedFinishStr}</span>
           </div>
        </motion.div>

        {/* Daily Target Card */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-slate-200/50"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Timer className="w-20 h-20" />
           </div>
           <div className="flex justify-between items-start mb-4 relative z-10">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Today's Target</p>
                 <p className="text-xs text-slate-500 font-bold mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
              </div>
              {dailyStats.isDayOff && (
                 <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider">Day Off</span>
              )}
           </div>
           
           <div className="flex items-baseline gap-1.5 relative z-10">
              <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{dailyStats.count}</h3>
              <span className="text-sm text-slate-400 font-bold">/ {dailyStats.target}</span>
           </div>

           <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${dailyStats.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  dailyStats.count >= dailyStats.target ? 'bg-emerald-500' : 'bg-brand-500'
                }`} 
              />
           </div>
           
           <div className="mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest relative z-10">
              {dailyStats.remaining > 0 ? (
                 <span className="text-brand-600">
                    <span className="text-brand-700 font-black">{dailyStats.remaining}</span> more to go!
                 </span>
              ) : (
                 <span className="text-emerald-600 font-black">Daily goal crushed!</span>
              )}
           </div>
        </motion.div>

        {/* Pending Card */}
        <motion.div 
           whileHover={{ y: -4 }}
           onClick={() => onFilterClick('PENDING_GROUP')}
           className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-slate-200/50 cursor-pointer hover:border-amber-200"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertTriangle className="w-20 h-20 text-amber-500" />
           </div>
           <div className="mb-3 relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pending Actions</p>
           </div>
           <div className="flex items-center gap-3 mb-5 relative z-10">
              <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{stats.totalPending}</h3>
              {stats.cyclePending > 0 && <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">+{stats.cyclePending} new</span>}
           </div>
           <div className="grid grid-cols-3 gap-3 relative z-10">
              <div className="text-center bg-rose-50/50 border border-rose-100 rounded-2xl p-2 flex flex-col items-center justify-center">
                 <AlertCircle className="w-3 h-3 text-rose-400 mb-1" />
                 <div className="text-sm font-black text-rose-700 leading-none">{stats.pendingBreakdown.JM}</div>
                 <div className="text-[8px] text-rose-400 font-black uppercase tracking-widest mt-1">JM</div>
              </div>
              <div className="text-center bg-amber-50/50 border border-amber-100 rounded-2xl p-2 flex flex-col items-center justify-center">
                 <AlertTriangle className="w-3 h-3 text-amber-400 mb-1" />
                 <div className="text-sm font-black text-amber-700 leading-none">{stats.pendingBreakdown.TL}</div>
                 <div className="text-[8px] text-amber-400 font-black uppercase tracking-widest mt-1">TL</div>
              </div>
              <div className="text-center bg-violet-50/50 border border-violet-100 rounded-2xl p-2 flex flex-col items-center justify-center">
                 <Mail className="w-3 h-3 text-violet-400 mb-1" />
                 <div className="text-sm font-black text-violet-700 leading-none">{stats.pendingBreakdown.CED}</div>
                 <div className="text-[8px] text-violet-400 font-black uppercase tracking-widest mt-1">CED</div>
              </div>
           </div>
        </motion.div>

        {/* Efficiency Card */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-slate-200/50"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-20 h-20 text-brand-500" />
           </div>
           <div className="mb-4 relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Efficiency</p>
           </div>
           
           <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Avg Turnaround</span>
                 <span className="text-sm font-black text-slate-800">{insights.tat} <span className="text-[10px] text-slate-400 font-bold">days</span></span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Streak</span>
                 <span className="text-sm font-black text-orange-600 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 fill-orange-600" /> {insights.streak} <span className="text-[10px] text-slate-400 font-bold">days</span>
                 </span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Untouched</span>
                 <span 
                    className={`text-sm font-black cursor-pointer hover:underline ${stats.totalUntouched > 10 ? 'text-rose-600' : 'text-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); onFilterClick(Status.UNTOUCHED); }}
                 >
                    {stats.totalUntouched} <span className="text-[10px] text-slate-400 font-bold">files</span>
                 </span>
              </div>
           </div>
        </motion.div>

        {/* Projected Payout Card */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-slate-200/50"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Coins className="w-20 h-20 text-emerald-500" />
           </div>
           <div className="mb-4 relative z-10 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Earnings</p>
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
                  ${projection.currentEarningsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">₱{projection.currentEarningsPHP.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div className="group/info relative">
                <Info className="w-4 h-4 text-slate-300 cursor-help" />
                <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none shadow-xl">
                  Projection is based on your current pace ({projection.pace} files/day) and your planned work schedule.
                </div>
              </div>
           </div>
           
           <div className="pt-4 border-t border-slate-100 space-y-3 relative z-10">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Projected Payout</span>
                 <span className="text-sm font-black text-slate-800">${projection.projectedPayoutUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">PHP Est.</span>
                 <span className="text-xs font-black text-emerald-600">₱{projection.projectedPayoutPHP.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Proj. Files</span>
                 <span className={`text-xs font-black ${projection.isAhead ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {projection.projectedCount} <span className="text-[9px] text-slate-400 font-bold">/ {target}</span>
                 </span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Current Pace</span>
                 <span className="text-xs font-black text-slate-700">{projection.pace} <span className="text-[9px] text-slate-400 font-bold">files/day</span></span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                 <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Required Pace</span>
                 <span className="text-xs font-black text-indigo-600">
                   {cycleData.weightedDaysLeft > 0 ? (Math.max(0, target - stats.cycleWorked) / cycleData.weightedDaysLeft).toFixed(1) : '0.0'} 
                   <span className="text-[9px] text-slate-400 font-bold ml-1">to hit target</span>
                 </span>
              </div>
           </div>
        </motion.div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Trend Chart (Burn-up) */}
         <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm lg:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
               <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                     <TrendingUp className="w-6 h-6 text-brand-500" /> Cycle Trajectory
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Actual completion vs Ideal pace to hit target</p>
               </div>
               
               {/* Smart Coaching Message */}
               <motion.div 
                 initial={{ opacity: 0, x: 10 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ duration: 0.3 }}
                 className={`flex items-center gap-4 px-4 py-3 rounded-2xl border max-w-md transition-all h-16 ${
                   coachingMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/50' :
                   coachingMessage.type === 'warning' ? 'bg-amber-50 border-amber-100 shadow-sm shadow-amber-100/50' :
                   coachingMessage.type === 'danger' ? 'bg-rose-50 border-rose-100 shadow-sm shadow-rose-100/50' :
                   'bg-brand-50 border-brand-100 shadow-sm shadow-brand-100/50'
                }`}>
                   <div className={`p-2 rounded-xl shrink-0 ${
                       coachingMessage.type === 'success' ? 'bg-emerald-200 text-emerald-700' :
                       coachingMessage.type === 'warning' ? 'bg-amber-200 text-amber-700' :
                       coachingMessage.type === 'danger' ? 'bg-rose-200 text-rose-700' :
                       'bg-brand-200 text-brand-700'
                   }`}>
                      <Info className="w-4 h-4" />
                   </div>
                   <div className="flex flex-col min-w-0 justify-center w-full">
                      <span className={`text-[10px] font-black uppercase tracking-[0.15em] leading-none mb-1 ${
                         coachingMessage.type === 'success' ? 'text-emerald-800' :
                         coachingMessage.type === 'warning' ? 'text-amber-800' :
                         coachingMessage.type === 'danger' ? 'text-rose-800' :
                         'text-brand-800'
                      }`}>{coachingMessage.title}</span>
                      <span className="text-xs text-slate-700 font-bold line-clamp-2 leading-tight">
                         {activeMsg}
                      </span>
                   </div>
               </motion.div>
            </div>

            <div className="h-[320px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                        interval="preserveStartEnd"
                     />
                     <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                     />
                     <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                     
                     {/* Ideal Line (Dashed) */}
                     <Line 
                        type="monotone" 
                        dataKey="ideal" 
                        name="Target Pace"
                        stroke="#cbd5e1" 
                        strokeWidth={2} 
                        strokeDasharray="6 6" 
                        dot={false} 
                        activeDot={false}
                        isAnimationActive={false}
                     />

                     {/* Actual Area */}
                     <Area 
                        type="monotone" 
                        dataKey="completed" 
                        name="Completed"
                        stroke="#0ea5e9" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorCompleted)" 
                        connectNulls
                        animationDuration={1000}
                     />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Daily Activity (Bar) */}
         <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                  <Activity className="w-6 h-6 text-brand-500" /> Consistency Heatmap
               </h3>
               <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-sm bg-slate-100"></div>
                  <div className="w-2 h-2 rounded-sm bg-indigo-100"></div>
                  <div className="w-2 h-2 rounded-sm bg-indigo-300"></div>
                  <div className="w-2 h-2 rounded-sm bg-indigo-500"></div>
                  <div className="w-2 h-2 rounded-sm bg-indigo-700"></div>
               </div>
            </div>
            <p className="text-sm text-slate-500 font-medium mb-8">Daily output over the last 6 months</p>
            
            <div className="flex-1">
               <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {contributionData.slice(-182).map((day) => {
                     let color = "bg-slate-100";
                     if (day.count > 0) color = "bg-indigo-100";
                     if (day.count > 2) color = "bg-indigo-300";
                     if (day.count > 5) color = "bg-indigo-500";
                     if (day.count > 8) color = "bg-indigo-700";

                     return (
                        <div 
                           key={day.date}
                           className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm ${color} transition-all hover:scale-125 cursor-help relative group`}
                        >
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
                              {day.count} files on {new Date(day.date).toLocaleDateString()}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
            
            <div className="mt-6 pt-6 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <span>Streak: {insights.streak} Days</span>
               </div>
               <span>Last 6 Months</span>
            </div>
         </div>
      </div>
      
      {/* Forecast Section - Always Visible */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8"
      >
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                 <Calendar className="w-6 h-6 text-brand-500" /> Smart Forecast
              </h3>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Recommended daily targets</span>
           </div>
           
           {forecast.length > 0 ? (
               <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {forecast.slice(0, 7).map((day, idx) => (
                     <div key={idx} className={`relative p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all hover:scale-105 ${
                        day.isOff 
                          ? 'bg-slate-50 border-slate-200 opacity-70' 
                          : 'bg-indigo-50/50 border-indigo-100 hover:bg-indigo-50 hover:shadow-md'
                     }`}>
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day.dayName}</span>
                         <span className="text-xs font-semibold text-slate-600 mb-2">{day.dateStr}</span>
                         
                         {day.isOff ? (
                             <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-200 text-slate-500">Off</span>
                         ) : (
                             <>
                                <span className="text-xl font-bold text-indigo-600 leading-none">{day.target}</span>
                                <span className="text-[9px] text-indigo-400 font-medium mt-0.5">files</span>
                             </>
                         )}
                     </div>
                  ))}
               </div>
           ) : (
               <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-bold text-slate-600">No forecast needed</p>
                  <p className="text-xs text-slate-400 mt-1">You have either completed the cycle or it ends today. Check Cycle Progress for details.</p>
               </div>
           )}

           {forecast.length > 7 && (
              <p className="text-center text-xs text-slate-400 mt-4 italic">
                 + {forecast.length - 7} more days in cycle
              </p>
           )}
      </motion.div>

      {/* Bottom Section: Watchlist & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Urgent Watchlist */}
         <motion.div 
           initial={{ opacity: 0, x: -10 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.3 }}
           className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8"
         >
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                  <AlertCircle className="w-6 h-6 text-rose-500" /> Urgent Watchlist
               </h3>
               {urgentItems.length > 0 && (
                  <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    {urgentItems.length} items
                  </span>
               )}
            </div>
            
            <div className="space-y-4">
               {urgentItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                     <CheckCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                     <p className="text-sm font-bold">No urgent items pending.</p>
                  </div>
               ) : (
                  urgentItems.map(item => (
                     <motion.div 
                       key={item.id} 
                       whileHover={{ x: 4 }}
                       className="flex items-center justify-between p-4 bg-rose-50/30 border border-rose-100 rounded-2xl hover:bg-rose-50 transition-colors"
                     >
                        <div className="flex items-center gap-4">
                           <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
                           <div>
                              <p className="text-sm font-black text-slate-900">{item.manuscriptId}</p>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{item.journalCode}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-black text-rose-600 uppercase tracking-wider">Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'ASAP'}</p>
                           <p className="text-[10px] text-slate-400 font-bold mt-1">Rec: {new Date(item.dateReceived).toLocaleDateString()}</p>
                        </div>
                     </motion.div>
                  ))
               )}
            </div>
         </motion.div>

         {/* Recent Activity */}
         <motion.div 
           initial={{ opacity: 0, x: 10 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.3 }}
           className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 flex flex-col"
         >
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-brand-50 rounded-xl">
                    <Activity className="w-5 h-5 text-brand-600" />
                  </div>
                  Recent Activity
               </h3>
               <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Live Feed
               </div>
            </div>
            
            <div className="flex-1 space-y-1 relative">
               {/* Timeline Line */}
               {recentActivity.length > 0 && (
                  <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-100 to-transparent" />
               )}

               {recentActivity.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Inbox className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-sm font-bold">No activity recorded yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Start working to see your history here.</p>
                  </div>
               ) : (
                  recentActivity.map((item: any, idx) => (
                     <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={item.id} 
                        className="group relative flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-all cursor-default"
                     >
                        <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${
                           item.status === Status.WORKED ? 'bg-emerald-500 text-white shadow-emerald-200' :
                           item.status.startsWith('PENDING') ? 'bg-amber-500 text-white shadow-amber-200' :
                           item.status === Status.BILLED ? 'bg-indigo-500 text-white shadow-indigo-200' :
                           'bg-slate-400 text-white shadow-slate-200'
                        }`}>
                           {item.status === Status.WORKED ? <CheckCircle className="w-5 h-5" /> : 
                            item.status.startsWith('PENDING') ? <AlertTriangle className="w-5 h-5" /> : 
                            item.status === Status.BILLED ? <Coins className="w-5 h-5" /> :
                            <RefreshCcw className="w-5 h-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-start gap-2">
                              <div>
                                 <p className="text-sm font-black text-slate-800 truncate group-hover:text-brand-600 transition-colors">{item.manuscriptId}</p>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mt-0.5">
                                    {item.journalCode} • <span className={
                                       item.action === 'Completed' ? 'text-emerald-600' :
                                       item.action === 'Queried' ? 'text-amber-600' :
                                       item.action === 'Billed' ? 'text-indigo-600' :
                                       'text-slate-500'
                                    }>{item.action}</span>
                                 </p>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap bg-white px-2 py-0.5 rounded-lg border border-slate-100 shadow-sm">
                                 {getRelativeTime(item.dateUpdated)}
                              </span>
                           </div>
                           
                           {item.notes && item.notes.length > 0 && (
                              <div className="mt-2 p-2 bg-white/50 rounded-lg border border-slate-100/50 text-[11px] text-slate-500 italic line-clamp-1 group-hover:line-clamp-none transition-all">
                                 "{item.notes[item.notes.length - 1].content}"
                              </div>
                           )}
                        </div>
                     </motion.div>
                  ))
               )}
            </div>

            {recentActivity.length > 0 && (
               <button 
                  onClick={onViewHistory}
                  className="mt-6 w-full py-3 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
               >
                  <HistoryIcon className="w-3.5 h-3.5" />
                  View Reports
               </button>
            )}
         </motion.div>

      </div>
    </div>
  );
};

export default Dashboard;
