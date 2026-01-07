import React, { useMemo, useState, useEffect } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Line, Cell } from 'recharts';
import { Manuscript, Status, UserSchedule } from '../types';
import { AlertCircle, CheckCircle, Zap, Inbox, TrendingUp, Activity, BarChart3, Coffee, Settings, Briefcase, Info, Trophy, AlertTriangle, Timer, Flame, Clock, Target, Calendar } from 'lucide-react';
import { calculateXP, calculateLevel } from '../services/gamification';

interface DashboardProps {
  userName: string;
  manuscripts: Manuscript[];
  target: number;
  userSchedule: UserSchedule;
  onUpdateTarget: (target: number) => void;
  onFilterClick: (status: Status | 'ALL' | 'PENDING_GROUP') => void;
  onUpdateSchedule: (schedule: UserSchedule) => void;
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

const Dashboard: React.FC<DashboardProps> = ({ 
  userName,
  manuscripts, 
  target, 
  userSchedule,
  onUpdateTarget, 
  onFilterClick,
  onUpdateSchedule
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
  const cycleDates = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const month = d.getMonth(); 
    const year = d.getFullYear();

    let startDate: Date;
    let endDate: Date;
    let cycleLabel: string;

    if (day >= 11 && day <= 25) {
      startDate = new Date(year, month, 11);
      endDate = new Date(year, month, 25);
      cycleLabel = `11th - 25th ${startDate.toLocaleString('default', { month: 'long' })}`;
    } else {
      if (day >= 26) {
        startDate = new Date(year, month, 26);
        endDate = new Date(year, month + 1, 10);
      } else {
        startDate = new Date(year, month - 1, 26);
        endDate = new Date(year, month, 10);
      }
      const startStr = startDate.toLocaleString('default', { month: 'short' });
      const endStr = endDate.toLocaleString('default', { month: 'short' });
      cycleLabel = `26th ${startStr} - 10th ${endStr}`;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate, cycleLabel };
  }, []);

  // --- Statistics Logic (Both Overall and Cycle) ---
  const stats = useMemo(() => {
    const inCycle = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= cycleDates.startDate && d <= cycleDates.endDate;
    };

    // Overall Totals
    const totalFiles = manuscripts.length;
    const totalWorked = manuscripts.filter(m => m.status === Status.WORKED).length;
    const totalUntouched = manuscripts.filter(m => m.status === Status.UNTOUCHED).length;
    const totalPending = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;

    // Cycle Specifics
    const cycleReceived = manuscripts.filter(m => inCycle(m.dateReceived)).length;
    
    // Cycle Worked: Completed Date falls in cycle
    const cycleWorked = manuscripts.filter(m => {
      if (m.status !== Status.WORKED) return false;
      return inCycle(m.completedDate || m.dateStatusChanged || m.dateUpdated);
    }).length;

    // Cycle Untouched: Untouched AND Received in this cycle
    const cycleUntouched = manuscripts.filter(m => 
      m.status === Status.UNTOUCHED && inCycle(m.dateReceived)
    ).length;

    // Cycle Pending: Pending AND Status Changed in this cycle (Fresh queries)
    const cyclePending = manuscripts.filter(m => 
      [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && 
      inCycle(m.dateStatusChanged || m.dateUpdated)
    ).length;

    // Breakdown for Pending Stat Card
    const pendingBreakdown = {
       JM: manuscripts.filter(m => m.status === Status.PENDING_JM).length,
       TL: manuscripts.filter(m => m.status === Status.PENDING_TL).length,
       CED: manuscripts.filter(m => m.status === Status.PENDING_CED).length
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
    const worked = manuscripts.filter(m => m.status === Status.WORKED);
    
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
             if (m.status !== Status.WORKED) return false;
             const d = m.completedDate || m.dateStatusChanged;
             return d && getLocalISODate(new Date(d)) === dateStr;
        });

        if (hasWork) streak++;
        else if (i === 0) continue; 
        else break; 
    }

    // 2. Urgent Watchlist
    const urgent = manuscripts
        .filter(m => m.status !== Status.WORKED && m.priority === 'Urgent')
        .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime())
        .slice(0, 3);

    // 3. Recent Activity (Last 5 modified)
    const recent = [...manuscripts]
        .sort((a, b) => new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime())
        .slice(0, 5);

    return { 
        insights: { tat: avgTat, streak },
        urgentItems: urgent,
        recentActivity: recent
    };
  }, [manuscripts]);

  // --- Gamification Logic ---
  const levelData = useMemo(() => {
     const xp = calculateXP(manuscripts, target);
     return calculateLevel(xp);
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
    const todayCount = manuscripts.filter(m => {
      if (m.status !== Status.WORKED) return false;
      const dateStr = m.completedDate || m.dateStatusChanged || m.dateUpdated;
      const date = new Date(dateStr);
      return date.getDate() === d.getDate() && 
             date.getMonth() === d.getMonth() && 
             date.getFullYear() === d.getFullYear();
    }).length;

    const completedPriorToTodayInCycle = Math.max(0, cycleData.completed - todayCount);
    const remainingForCycleFromStartOfDay = Math.max(0, target - completedPriorToTodayInCycle);
    
    const effectiveDivisor = Math.max(0.1, cycleData.weightedDaysLeft);
    const baseDailyTarget = remainingForCycleFromStartOfDay / effectiveDivisor;
    const todayWeight = weights[d.getDay()] ?? 1;
    let safeDailyTarget = Math.ceil(baseDailyTarget * todayWeight);

    const isoToday = getLocalISODate(d);
    if (userSchedule.daysOff.includes(isoToday)) {
      safeDailyTarget = 0;
    }

    if (safeDailyTarget > remainingForCycleFromStartOfDay) safeDailyTarget = remainingForCycleFromStartOfDay;
    if (cycleData.completed >= target) safeDailyTarget = 0;

    const remainingToday = Math.max(0, safeDailyTarget - todayCount);
    const percentage = safeDailyTarget > 0 ? Math.min(100, Math.round((todayCount / safeDailyTarget) * 100)) : 100;
    
    const isDayOff = userSchedule.daysOff.includes(isoToday) || todayWeight === 0;

    return { 
      count: todayCount, 
      target: safeDailyTarget, 
      remaining: remainingToday, 
      percentage, 
      isDayOff,
      baseDailyTarget
    };
  }, [manuscripts, target, cycleData, userSchedule, userName]);

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

  // 2. Daily Activity Data (Bar Chart)
  const activityData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const dateIterator = new Date();
      dateIterator.setDate(dateIterator.getDate() - i);
      
      const count = manuscripts.filter(m => {
         if (m.status !== Status.WORKED) return false;

         const dRaw = m.completedDate || m.dateStatusChanged || m.dateUpdated;
         if (!dRaw) return false;
         
         const mDate = new Date(dRaw);
         return mDate.getDate() === dateIterator.getDate() &&
                mDate.getMonth() === dateIterator.getMonth() &&
                mDate.getFullYear() === dateIterator.getFullYear();
      }).length;
      
      data.push({ date: dateIterator.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
    return data;
  }, [manuscripts]);

  // Determine active message for carousel
  const activeMsgIndex = currentTipIndex % coachingMessage.messages.length;
  const activeMsg = coachingMessage.messages[activeMsgIndex];

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      
      {/* Header with Date & Level Banner */}
      <div className="flex flex-col gap-6 border-b border-slate-200/60 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center">
          <div>
             <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h2>
             <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500 text-sm">Overview of your productivity and workflow</p>
                <button 
                  onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                  className={`text-xs px-2 py-0.5 rounded-md border transition-colors flex items-center gap-1 ${showScheduleSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600'}`}
                >
                  <Settings className="w-3 h-3" />
                  {showScheduleSettings ? 'Close Settings' : 'Smart Pacing'}
                </button>
             </div>
          </div>
          <HeaderClock />
        </div>

        {/* Level Banner */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 flex items-center gap-5 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden ring-1 ring-white/10">
           <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
              <Trophy className="w-24 h-24" />
           </div>
           
           <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg border-4 border-slate-700 shadow-lg shrink-0 z-10">
              {levelData.level}
           </div>
           <div className="flex-1 z-10">
              <div className="flex justify-between items-end mb-1.5">
                 <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Current Rank</span>
                    <h3 className="font-bold text-base leading-tight text-indigo-300">{levelData.title}</h3>
                 </div>
                 <span className="text-xs font-mono text-slate-400">
                    {levelData.currentXP} <span className="text-slate-600">/</span> {levelData.nextLevelXP} XP
                 </span>
              </div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-600/30">
                 <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-1000 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ width: `${levelData.progressPercent}%` }}></div>
              </div>
           </div>
        </div>
      </div>

      {showScheduleSettings && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up backdrop-blur-sm">
           {/* Weekly Routine */}
           <div className="flex flex-col gap-3">
             <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl shrink-0">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                   <h4 className="text-sm font-bold text-indigo-900">Weekly Routine</h4>
                   <p className="text-xs text-indigo-700 mt-1">
                     Adjust your typical workload to calculate smarter daily targets.
                   </p>
                </div>
             </div>
             
             <div className="mt-2 grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                  const weight = weights[idx] ?? 1;
                  return (
                    <button
                      key={day}
                      onClick={() => updateWeeklyWeight(idx, weight === 1 ? 0 : 1)}
                      className={`py-2 rounded-lg text-[10px] sm:text-xs font-bold border transition-all flex flex-col items-center gap-1.5 ${
                         weight > 0 
                          ? 'bg-white border-indigo-200 text-indigo-700 shadow-sm' 
                          : 'bg-indigo-100/30 border-indigo-100 text-indigo-300'
                      }`}
                    >
                      <span>{day}</span>
                      <span className={`w-2 h-2 rounded-full ${weight > 0 ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.6)]' : 'bg-slate-300'}`}></span>
                    </button>
                  )
                })}
             </div>
           </div>

           {/* Toggle Today */}
           <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                 <div className="p-2 bg-pink-100 rounded-xl shrink-0">
                   <Coffee className="w-5 h-5 text-pink-600" />
                 </div>
                 <div className="flex-1">
                    <h4 className="text-sm font-bold text-pink-900">Instant Day Off</h4>
                    <p className="text-xs text-pink-700 mt-1">
                      Taking a break today? Toggle this to pause your daily target.
                    </p>
                 </div>
                 <button
                   onClick={toggleTodayOff}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 ${
                     dailyStats.isDayOff ? 'bg-pink-600' : 'bg-slate-200'
                   }`}
                 >
                   <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      dailyStats.isDayOff ? 'translate-x-6' : 'translate-x-1'
                   }`} />
                 </button>
              </div>

              {/* Quick Target Edit */}
              <div className="mt-auto pt-4 border-t border-indigo-200/50 flex items-center justify-between">
                 <span className="text-xs font-bold text-indigo-800">Cycle Goal:</span>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onUpdateTarget(Math.max(1, target - 5))}
                      className="w-7 h-7 rounded-lg bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 font-bold transition-colors"
                    >-</button>
                    <span className="text-base font-mono font-bold w-10 text-center text-indigo-900">{target}</span>
                    <button 
                      onClick={() => onUpdateTarget(target + 5)}
                      className="w-7 h-7 rounded-lg bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-50 font-bold transition-colors"
                    >+</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Cycle Progress Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Target className="w-16 h-16" />
           </div>
           <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cycle Progress</p>
                 <p className="text-[10px] text-slate-400 mt-0.5">{cycleData.label}</p>
              </div>
              <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${cycleData.percentage >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
                 {cycleData.percentage}%
              </div>
           </div>
           <div className="flex items-baseline gap-1 relative z-10">
              <h3 className="text-3xl font-bold text-slate-800">{stats.cycleWorked}</h3>
              <span className="text-sm text-slate-400 font-medium">/ {target}</span>
           </div>
           <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${cycleData.percentage >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                style={{ width: `${cycleData.percentage}%` }}
              ></div>
           </div>
           <div className="mt-2 flex justify-between text-[10px] text-slate-400 font-medium relative z-10">
              <span>Ends {cycleData.endDateStr}</span>
              <span>Proj: {cycleData.projectedFinishStr}</span>
           </div>
        </div>

        {/* Daily Target Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Timer className="w-16 h-16" />
           </div>
           <div className="flex justify-between items-start mb-3 relative z-10">
              <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Target</p>
                 <p className="text-[10px] text-slate-400 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
              </div>
              {dailyStats.isDayOff && (
                 <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">Day Off</span>
              )}
           </div>
           
           <div className="flex items-baseline gap-1 relative z-10">
              <h3 className="text-3xl font-bold text-slate-800">{dailyStats.count}</h3>
              <span className="text-sm text-slate-400 font-medium">/ {dailyStats.target}</span>
           </div>

           <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyStats.count >= dailyStats.target ? 'bg-emerald-500' : 'bg-indigo-500'
                }`} 
                style={{ width: `${dailyStats.percentage}%` }}
              ></div>
           </div>
           
           <div className="mt-2 text-[10px] text-slate-500 font-medium relative z-10">
              {dailyStats.remaining > 0 ? (
                 <span className="text-indigo-600 font-bold">{dailyStats.remaining} more to go!</span>
              ) : (
                 <span className="text-emerald-600 font-bold">Daily goal crushed!</span>
              )}
           </div>
        </div>

        {/* Pending Card */}
        <div 
           onClick={() => onFilterClick('PENDING_GROUP')}
           className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all cursor-pointer hover:border-amber-200"
        >
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertTriangle className="w-16 h-16 text-amber-500" />
           </div>
           <div className="mb-2 relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Actions</p>
           </div>
           <div className="flex items-center gap-2 mb-4 relative z-10">
              <h3 className="text-3xl font-bold text-slate-800">{stats.totalPending}</h3>
              {stats.cyclePending > 0 && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">+{stats.cyclePending} new</span>}
           </div>
           <div className="grid grid-cols-3 gap-2 relative z-10">
              <div className="text-center bg-rose-50 rounded-lg p-1.5">
                 <div className="text-xs font-bold text-rose-700">{stats.pendingBreakdown.JM}</div>
                 <div className="text-[9px] text-rose-400 font-bold">JM</div>
              </div>
              <div className="text-center bg-amber-50 rounded-lg p-1.5">
                 <div className="text-xs font-bold text-amber-700">{stats.pendingBreakdown.TL}</div>
                 <div className="text-[9px] text-amber-400 font-bold">TL</div>
              </div>
              <div className="text-center bg-violet-50 rounded-lg p-1.5">
                 <div className="text-xs font-bold text-violet-700">{stats.pendingBreakdown.CED}</div>
                 <div className="text-[9px] text-violet-400 font-bold">CED</div>
              </div>
           </div>
        </div>

        {/* Insights Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-16 h-16 text-blue-500" />
           </div>
           <div className="mb-4 relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Efficiency</p>
           </div>
           
           <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-medium">Avg Turnaround</span>
                 <span className="text-sm font-bold text-slate-800">{insights.tat} <span className="text-[10px] text-slate-400 font-normal">days</span></span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-medium">Active Streak</span>
                 <span className="text-sm font-bold text-orange-600 flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-orange-600" /> {insights.streak} <span className="text-[10px] text-slate-400 font-normal">days</span>
                 </span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-500 font-medium">Untouched</span>
                 <span 
                    className={`text-sm font-bold cursor-pointer hover:underline ${stats.totalUntouched > 10 ? 'text-red-600' : 'text-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); onFilterClick(Status.UNTOUCHED); }}
                 >
                    {stats.totalUntouched} <span className="text-[10px] text-slate-400 font-normal">files</span>
                 </span>
              </div>
           </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* Trend Chart (Burn-up) */}
         <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
               <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-blue-500" /> Cycle Trajectory
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Actual completion vs Ideal pace to hit target</p>
               </div>
               
               {/* Smart Coaching Message - FIXED HEIGHT */}
               <div className={`hidden sm:flex items-center gap-3 px-3 py-2 rounded-xl border max-w-md transition-colors h-14 ${
                  coachingMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                  coachingMessage.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                  coachingMessage.type === 'danger' ? 'bg-rose-50 border-rose-100' :
                  'bg-blue-50 border-blue-100'
               }`}>
                  <div className={`p-1.5 rounded-full shrink-0 ${
                      coachingMessage.type === 'success' ? 'bg-emerald-200 text-emerald-700' :
                      coachingMessage.type === 'warning' ? 'bg-amber-200 text-amber-700' :
                      coachingMessage.type === 'danger' ? 'bg-rose-200 text-rose-700' :
                      'bg-blue-200 text-blue-700'
                  }`}>
                     <Info className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col min-w-0 justify-center w-full">
                     <span className={`text-[10px] font-bold uppercase tracking-wider leading-none mb-0.5 ${
                        coachingMessage.type === 'success' ? 'text-emerald-800' :
                        coachingMessage.type === 'warning' ? 'text-amber-800' :
                        coachingMessage.type === 'danger' ? 'text-rose-800' :
                        'text-blue-800'
                     }`}>{coachingMessage.title}</span>
                     <span className="text-xs text-slate-700 font-medium animate-fade-in line-clamp-2 leading-tight h-8 flex items-center">
                        {activeMsg}
                     </span>
                  </div>
               </div>
            </div>

            <div className="h-[280px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                        interval="preserveStartEnd"
                     />
                     <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                     />
                     <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                     
                     {/* Ideal Line (Dashed) */}
                     <Line 
                        type="monotone" 
                        dataKey="ideal" 
                        name="Target Pace"
                        stroke="#cbd5e1" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                        dot={false} 
                        activeDot={false}
                        isAnimationActive={false}
                     />

                     {/* Actual Area */}
                     <Area 
                        type="monotone" 
                        dataKey="completed" 
                        name="Completed"
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorCompleted)" 
                        connectNulls
                     />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Daily Activity (Bar) */}
         <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
               <BarChart3 className="w-5 h-5 text-emerald-500" /> Last 7 Days
            </h3>
            {/* FIX: Changed from flex-1 to fixed height to prevent resize loops in Recharts */}
            <div className="h-[220px] w-full mt-4">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                     />
                     <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} 
                     />
                     <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        content={({ active, payload, label }) => {
                           if (active && payload && payload.length) {
                              return (
                                 <div className="bg-slate-900 text-white text-xs py-1 px-2 rounded">
                                    <span className="font-bold">{payload[0].value}</span> files on {label}
                                 </div>
                              );
                           }
                           return null;
                        }}
                     />
                     {/* FIX: Re-enabled animation (removed isAnimationActive={false}) */}
                     <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {activityData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.count >= (dailyStats.baseDailyTarget || 5) ? '#10b981' : '#94a3b8'} />
                        ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
      
      {/* Forecast Section - Always Visible */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
           <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Calendar className="w-5 h-5 text-indigo-500" /> Smart Forecast
              </h3>
              <span className="text-xs text-slate-500">Recommended daily targets to finish cycle on time</span>
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
      </div>

      {/* Bottom Section: Watchlist & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Urgent Watchlist */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" /> Urgent Watchlist
               </h3>
               {urgentItems.length > 0 && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">{urgentItems.length} items</span>}
            </div>
            
            <div className="space-y-3">
               {urgentItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                     <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                     <p className="text-sm">No urgent items pending.</p>
                  </div>
               ) : (
                  urgentItems.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl hover:bg-red-50 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                           <div>
                              <p className="text-sm font-bold text-slate-800">{item.manuscriptId}</p>
                              <p className="text-xs text-slate-500">{item.journalCode}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs font-semibold text-red-600">Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'ASAP'}</p>
                           <p className="text-[10px] text-slate-400">Rec: {new Date(item.dateReceived).toLocaleDateString()}</p>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>

         {/* Recent Activity */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
               <Activity className="w-5 h-5 text-indigo-500" /> Recent Activity
            </h3>
            
            <div className="space-y-0">
               {recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
               ) : (
                  recentActivity.map((item, idx) => (
                     <div key={item.id} className={`flex items-center justify-between py-3 ${idx !== recentActivity.length - 1 ? 'border-b border-slate-50' : ''}`}>
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full shrink-0 ${
                              item.status === Status.WORKED ? 'bg-emerald-100 text-emerald-600' :
                              item.status === Status.UNTOUCHED ? 'bg-slate-100 text-slate-500' :
                              'bg-amber-100 text-amber-600'
                           }`}>
                              {item.status === Status.WORKED ? <CheckCircle className="w-4 h-4" /> : 
                               item.status === Status.UNTOUCHED ? <Inbox className="w-4 h-4" /> : 
                               <Clock className="w-4 h-4" />}
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-slate-700">{item.manuscriptId}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                 {item.journalCode} 
                                 <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                                 {new Date(item.dateUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                           </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                           item.status === Status.WORKED ? 'text-emerald-700 bg-emerald-50' : 
                           item.status === Status.UNTOUCHED ? 'text-slate-600 bg-slate-100' : 
                           'text-amber-700 bg-amber-50'
                        }`}>
                           {item.status.replace(/_/g, ' ')}
                        </span>
                     </div>
                  ))
               )}
            </div>
         </div>

      </div>
    </div>
  );
};

export default Dashboard;