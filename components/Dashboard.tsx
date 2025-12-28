import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Manuscript, Status, UserSchedule } from '../types';
import { FileText, AlertCircle, CheckCircle, Calendar, Zap, Inbox, CalendarX, TrendingUp, Activity, MoreHorizontal, BarChart3, Coffee, Settings, Briefcase, Map, PartyPopper, AlertOctagon, ArrowRight, Lightbulb } from 'lucide-react';

interface DashboardProps {
  userName: string;
  manuscripts: Manuscript[];
  target: number;
  userSchedule: UserSchedule;
  onUpdateTarget: (target: number) => void;
  onFilterClick: (status: Status | 'ALL' | 'PENDING_GROUP') => void;
  onUpdateSchedule: (schedule: UserSchedule) => void;
}

const COLORS = {
  [Status.WORKED]: '#10b981', // Emerald 500
  [Status.UNTOUCHED]: '#94a3b8', // Slate 400
  [Status.PENDING_JM]: '#f43f5e', // Rose 500
  [Status.PENDING_TL]: '#f59e0b', // Amber 500
  [Status.PENDING_CED]: '#8b5cf6', // Violet 500
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-100 shadow-xl rounded-lg text-xs">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].fill }}></div>
            <span className="text-slate-500">{payload[0].name}:</span>
            <span className="font-bold text-slate-800">{payload[0].value}</span>
        </div>
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
    <div className="text-right mt-2 sm:mt-0">
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
    // Access directly to avoid unused variable warning if destructuring triggers it falsely
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

    return {
      totalFiles,
      totalWorked,
      totalUntouched,
      totalPending,
      cycleReceived,
      cycleWorked,
      cycleUntouched,
      cyclePending
    };
  }, [manuscripts, cycleDates]);

  const cycleData = useMemo(() => {
    const { endDate, cycleLabel } = cycleDates;
    const d = new Date();

    const percentage = Math.min(100, Math.round((stats.cycleWorked / target) * 100));

    // Calculate "Weighted Days Left" INCLUDING Today
    const tempToday = new Date();
    tempToday.setHours(0,0,0,0);
    
    let weightedDaysLeft = 0;
    const itrDate = new Date(tempToday);
    
    // We iterate until endDate
    while (itrDate <= endDate) {
        const isoDate = getLocalISODate(itrDate);
        const dayOfWeek = itrDate.getDay(); // 0 = Sun, 6 = Sat
        
        // If it's a manual day off, weight is 0
        if (!userSchedule.daysOff.includes(isoDate)) {
           // Otherwise add the weight for this day of week
           weightedDaysLeft += (weights[dayOfWeek] ?? 1);
        }
        
        itrDate.setDate(itrDate.getDate() + 1);
    }
    
    const calendarDaysLeft = Math.max(1, Math.ceil((endDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      label: cycleLabel,
      completed: stats.cycleWorked,
      percentage,
      calendarDaysLeft,
      weightedDaysLeft, // This represents "Full Work Day Equivalents" remaining
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
    
    // Safety against division by zero
    const effectiveDivisor = Math.max(0.1, cycleData.weightedDaysLeft);
    
    // The "Base Unit" is what a 100% day looks like
    const baseDailyTarget = remainingForCycleFromStartOfDay / effectiveDivisor;
    
    // Today's specific target is Base Unit * Today's Weight
    const todayWeight = weights[d.getDay()] ?? 1;
    let safeDailyTarget = Math.ceil(baseDailyTarget * todayWeight);

    // If today is manually marked off, override to 0
    const isoToday = getLocalISODate(d);
    if (userSchedule.daysOff.includes(isoToday)) {
      safeDailyTarget = 0;
    }

    // Cap logic
    if (safeDailyTarget > remainingForCycleFromStartOfDay) safeDailyTarget = remainingForCycleFromStartOfDay;
    if (cycleData.completed >= target) safeDailyTarget = 0;

    const remainingToday = Math.max(0, safeDailyTarget - todayCount);
    const percentage = safeDailyTarget > 0 ? Math.min(100, Math.round((todayCount / safeDailyTarget) * 100)) : 100;
    
    // Message logic moved to Coach block
    const isDayOff = userSchedule.daysOff.includes(isoToday) || todayWeight === 0;

    return { 
      count: todayCount, 
      target: safeDailyTarget, 
      remaining: remainingToday, 
      percentage, 
      isDayOff,
      baseDailyTarget // The "Ideal" average needed per full day
    };
  }, [manuscripts, target, cycleData, userSchedule, userName]);

  // --- Smart Planning & Coaching Logic ---
  const { forecast, coachingMessage } = useMemo(() => {
    const { endDate } = cycleDates;
    const remainingToTarget = Math.max(0, target - stats.cycleWorked);
    
    // 1. Forecast Calculation (Starting Tomorrow)
    const forecastDays = [];
    const itrDate = new Date();
    itrDate.setDate(itrDate.getDate() + 1); // Start tomorrow
    itrDate.setHours(0,0,0,0);

    let futureWeightedDays = 0;
    
    // First pass: Calculate total future weights
    const tempItr = new Date(itrDate);
    while (tempItr <= endDate) {
        const isoDate = getLocalISODate(tempItr);
        const dayOfWeek = tempItr.getDay();
        if (!userSchedule.daysOff.includes(isoDate)) {
           futureWeightedDays += (weights[dayOfWeek] ?? 1);
        }
        tempItr.setDate(tempItr.getDate() + 1);
    }

    // Base unit for future
    const safeFutureDivisor = Math.max(0.1, futureWeightedDays);
    const futureBaseUnit = remainingToTarget / safeFutureDivisor;

    // Second pass: Build Forecast Data
    while (itrDate <= endDate) {
       const isoDate = getLocalISODate(itrDate);
       const dayOfWeek = itrDate.getDay();
       const isOff = userSchedule.daysOff.includes(isoDate) || weights[dayOfWeek] === 0;
       const weight = isOff ? 0 : weights[dayOfWeek];
       
       let dayTarget = 0;
       if (!isOff) {
          dayTarget = Math.ceil(futureBaseUnit * weight);
       }

       // Don't show if target is reached
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

    // 2. Coaching Message Logic
    
    const itemsLeft = Math.max(0, target - stats.cycleWorked);
    // Calculate average needed per remaining "Work Day"
    const avgNeededPerWorkDay = cycleData.weightedDaysLeft > 0 
        ? (itemsLeft / cycleData.weightedDaysLeft) 
        : itemsLeft; 

    // Determine Pace status
    const idealDailyPace = Math.max(1, target / 15);
    const isBehind = avgNeededPerWorkDay > (idealDailyPace * 1.2); 
    const isWayBehind = avgNeededPerWorkDay > (idealDailyPace * 1.6); 
    
    let title = "";
    let messages: string[] = [];
    let type: "success" | "warning" | "neutral" | "danger" = "neutral";
    
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
            "Though it is your day off, it would be great if you can finish at least 5 items today so the following day will be less hustle.",
            "Rest is productive too. Come back stronger tomorrow.",
            "Enjoy the break! A fresh mind works faster."
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
          title = "Almost There";
          messages = [
             `You've completed ${countToday} files today, ${remainingToday} more to keep on pace.`,
             "Pushing further will be great to build a safety buffer.",
             "Just a final sprint to clear today's quota!"
          ];
          type = "warning"; // Encouraging yellow
       } else if (isWayBehind) {
          title = "Heavy Lifting";
          messages = [
            "Feel tired? Rest and take a nap, and hustle back hard. We're still a long way.",
            `We need to average ${avgNeeded} files per working day to catch up.`,
            "Don't panic. Focus on one file at a time.",
            "Consider prioritizing the easiest files first to build momentum."
          ];
          type = "danger";
       } else if (isBehind || remainingToday > 0) {
          title = "Let's Catch Up";
          messages = [
             `We need ${remainingToday} more today to stay on track.`,
             `Hey buddy, looks like we are out of pace. Please push further today.`,
             `Aim for about ${avgNeeded} items each subsequent day to smooth out the load.`,
             `Achieve at least ${dailyStats.target} files today to keep the pace.`
          ];
          type = isBehind ? "danger" : "neutral";
       } else {
          // Fallback / Early day
          title = "Good Start";
          messages = [
             "You are on track. Keep the rhythm going.",
             `Aim for ${remainingToday} more to stay ahead of the curve.`,
             "Consistency is key. You've got this."
          ];
          type = "success";
       }
    }
    
    // Pick 3 random unique messages
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

  const pieData = [
    { name: 'Worked', value: stats.totalWorked },
    { name: 'Untouched', value: stats.totalUntouched },
    { name: 'Pending', value: stats.totalPending },
  ].filter(d => d.value > 0);

  const activityData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = getLocalISODate(date);
      
      const count = manuscripts.filter(m => {
         const d = (m.status === Status.WORKED && m.completedDate) 
            ? m.completedDate 
            : (m.dateStatusChanged || m.dateUpdated);
         return d.startsWith(dateStr);
      }).length;
      data.push({ date: date.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
    return data;
  }, [manuscripts]);

  // Determine active message for carousel
  const activeMsgIndex = currentTipIndex % coachingMessage.messages.length;
  const activeMsg = coachingMessage.messages[activeMsgIndex];

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      
      {/* Header with Date */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center border-b border-slate-200 pb-4">
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

      {showScheduleSettings && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
           {/* Weekly Routine */}
           <div className="flex flex-col gap-2">
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
             
             <div className="mt-3 grid grid-cols-2 gap-3">
                {/* Saturday Control */}
                <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm">
                   <span className="text-xs font-bold text-indigo-900 block mb-2">Saturdays</span>
                   <div className="flex gap-1">
                      {[1, 0.5, 0].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateWeeklyWeight(6, w)}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                            weights[6] === w 
                              ? 'bg-indigo-600 text-white shadow-md' 
                              : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100'
                          }`}
                        >
                          {w === 1 ? 'FULL' : w === 0.5 ? 'LIGHT' : 'OFF'}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Sunday Control */}
                <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm">
                   <span className="text-xs font-bold text-indigo-900 block mb-2">Sundays</span>
                   <div className="flex gap-1">
                      {[1, 0.5, 0].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateWeeklyWeight(0, w)}
                          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                            weights[0] === w 
                              ? 'bg-indigo-600 text-white shadow-md' 
                              : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100'
                          }`}
                        >
                          {w === 1 ? 'FULL' : w === 0.5 ? 'LIGHT' : 'OFF'}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
           </div>

           {/* Today Control */}
           <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl shrink-0">
                  <CalendarX className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                   <h4 className="text-sm font-bold text-indigo-900">Single Day Off</h4>
                   <p className="text-xs text-indigo-700 mt-1">
                     Mark today as a rest day without changing your weekly routine.
                   </p>
                </div>
              </div>
              <button 
                onClick={toggleTodayOff} 
                className={`mt-3 w-full py-3 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 ${
                  userSchedule.daysOff.includes(getLocalISODate(new Date()))
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' 
                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:shadow-sm'
                }`}
              >
                 {userSchedule.daysOff.includes(getLocalISODate(new Date())) ? 'ON BREAK (Click to Work)' : 'MARK TODAY OFF'}
              </button>
           </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Files" 
          value={stats.totalFiles} 
          cycleValue={stats.cycleReceived}
          cycleLabel="Received this cycle"
          icon={<FileText className="w-5 h-5" />} 
          color="bg-blue-600"
          trend="All Time"
          onClick={() => onFilterClick('ALL')}
          delay="delay-100"
        />
        <StatCard 
          title="Untouched" 
          value={stats.totalUntouched} 
          cycleValue={stats.cycleUntouched}
          cycleLabel="untouched this cycle"
          icon={<Inbox className="w-5 h-5" />} 
          color="bg-slate-500"
          trend="Needs Action"
          onClick={() => onFilterClick(Status.UNTOUCHED)}
          delay="delay-100"
        />
        <StatCard 
          title="Pending" 
          value={stats.totalPending} 
          cycleValue={stats.cyclePending}
          cycleLabel="Queried this cycle"
          icon={<AlertCircle className="w-5 h-5" />} 
          color="bg-rose-500"
          trend="Queries"
          onClick={() => onFilterClick('PENDING_GROUP')}
          delay="delay-200"
        />
        <StatCard 
          title="Completed" 
          value={stats.totalWorked} 
          cycleValue={stats.cycleWorked}
          cycleLabel="Worked this cycle"
          icon={<CheckCircle className="w-5 h-5" />} 
          color="bg-emerald-500"
          trend="Finished"
          onClick={() => onFilterClick(Status.WORKED)}
          delay="delay-200"
        />
      </div>

      {/* Goals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cycle Progress */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-900/10 relative overflow-hidden flex flex-col justify-between group transition-transform hover:-translate-y-1 duration-300 animate-fade-in-up delay-300">
          <div className="absolute right-0 top-0 p-32 bg-indigo-600/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-600/30 transition-all duration-700"></div>
          
          <div className="relative z-10">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 text-indigo-300 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{cycleData.label}</span>
                  </div>
                  <h2 className="text-2xl font-bold">Cycle Goal</h2>
                </div>
                <div className="bg-white/10 px-3 py-1 rounded-xl backdrop-blur-md flex items-center gap-2 border border-white/10">
                   <span className="text-xs text-indigo-200 font-bold uppercase">Target</span>
                   <input 
                    type="number" 
                    value={target}
                    onChange={(e) => onUpdateTarget(Math.max(1, Number(e.target.value)))}
                    className="w-12 bg-transparent text-white font-bold text-center outline-none focus:border-b focus:border-indigo-400 transition-colors"
                   />
                </div>
             </div>
             
             <div className="mb-6">
                <div className="flex items-end gap-2 mb-2">
                   <span className="text-5xl font-bold tracking-tighter">{cycleData.percentage}%</span>
                   <span className="text-sm text-slate-400 mb-1.5">completed</span>
                </div>
                <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                   <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: `${cycleData.percentage}%` }}></div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-white/10">
                <div>
                   <p className="text-slate-400 text-xs">Completed</p>
                   <p className="font-bold text-lg">{cycleData.completed} <span className="text-slate-500 text-xs font-normal">/ {target}</span></p>
                </div>
                <div>
                   <p className="text-slate-400 text-xs">Effective Work Days Left</p>
                   <p className="font-bold text-lg flex items-center gap-2">
                      {cycleData.weightedDaysLeft.toFixed(1)}
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* Daily Progress */}
        <div className={`rounded-3xl p-8 shadow-2xl shadow-blue-900/10 relative overflow-hidden flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 text-white animate-fade-in-up delay-300 ${dailyStats.isDayOff ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-blue-600 to-indigo-800'}`}>
          <div className="absolute left-0 bottom-0 p-32 bg-white/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
               <div>
                 <div className="flex items-center gap-2 text-white/70 mb-1">
                   {dailyStats.isDayOff ? <Coffee className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                   <span className="text-xs font-bold uppercase tracking-widest">Daily Pace</span>
                 </div>
                 <h2 className="text-2xl font-bold">{dailyStats.isDayOff ? "Rest Day" : "Today's Progress"}</h2>
               </div>
               <div className="text-right">
                  <p className="text-3xl font-bold">{dailyStats.count}</p>
                  <p className="text-xs text-white/70 uppercase font-medium">Finished</p>
               </div>
            </div>

            <div className="mb-6">
               <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2 text-white/80">
                  <span>Progress</span>
                  <span>Target: {dailyStats.target}</span>
               </div>
               <div className="h-4 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10 shadow-inner">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${dailyStats.percentage}%` }}></div>
               </div>
            </div>

            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-md border border-white/10 flex gap-4 items-center">
               <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
               </div>
               <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-sm text-white mb-0.5">{coachingMessage.title}</p>
                  {/* Mini-Carousel for card view */}
                  <div className="h-4 relative">
                     <div key={activeMsgIndex} className="animate-fade-in-up absolute inset-0">
                       <p className="text-xs text-white/80 truncate">{activeMsg}</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- SMART PLAN & COACHING SECTION --- */}
      <div className="grid grid-cols-1 gap-6 animate-fade-in-up delay-300">
        
        {/* Pace Coach Banner (Sliding Carousel) */}
        <div className={`rounded-2xl p-6 border flex items-center gap-5 shadow-sm relative overflow-hidden min-h-[140px] ${
          coachingMessage.type === 'success' ? 'bg-gradient-to-r from-emerald-50 to-white border-emerald-100' :
          coachingMessage.type === 'danger' ? 'bg-gradient-to-r from-rose-50 to-white border-rose-100' :
          coachingMessage.type === 'warning' ? 'bg-gradient-to-r from-amber-50 to-white border-amber-100' :
          'bg-white border-slate-200'
        }`}>
          <div className={`p-4 rounded-full shrink-0 ${
             coachingMessage.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
             coachingMessage.type === 'danger' ? 'bg-rose-100 text-rose-600' :
             coachingMessage.type === 'warning' ? 'bg-amber-100 text-amber-600' :
             'bg-slate-100 text-slate-500'
          }`}>
             {coachingMessage.type === 'success' ? <PartyPopper className="w-6 h-6" /> :
              coachingMessage.type === 'danger' ? <AlertOctagon className="w-6 h-6" /> :
              <Map className="w-6 h-6" />
             }
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
               coachingMessage.type === 'success' ? 'text-emerald-800' :
               coachingMessage.type === 'danger' ? 'text-rose-800' :
               'text-slate-800'
            }`}>
              {coachingMessage.title}
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border opacity-70">
                Daily Tips
              </span>
            </h3>
            
            <div className="relative h-12 overflow-hidden">
               <div key={activeMsgIndex} className="animate-fade-in-up absolute inset-0 flex items-start">
                  <div className="flex items-start gap-3 text-sm">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      coachingMessage.type === 'success' ? 'bg-emerald-400' :
                      coachingMessage.type === 'danger' ? 'bg-rose-400' :
                      'bg-slate-400'
                    }`}></div>
                    <span className={`text-lg font-medium leading-relaxed ${
                      coachingMessage.type === 'success' ? 'text-emerald-700' :
                      coachingMessage.type === 'danger' ? 'text-rose-700' :
                      'text-slate-600'
                    }`}>
                      {activeMsg}
                    </span>
                  </div>
               </div>
            </div>

            {/* Pagination Dots */}
            {coachingMessage.messages.length > 1 && (
               <div className="flex gap-1.5 mt-2">
                 {coachingMessage.messages.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === activeMsgIndex 
                           ? (coachingMessage.type === 'success' ? 'w-6 bg-emerald-400' : coachingMessage.type === 'danger' ? 'w-6 bg-rose-400' : 'w-6 bg-slate-400') 
                           : (coachingMessage.type === 'success' ? 'w-1.5 bg-emerald-200' : coachingMessage.type === 'danger' ? 'w-1.5 bg-rose-200' : 'w-1.5 bg-slate-200')
                      }`}
                    />
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* Smart Schedule Horizontal Scroll */}
        {forecast.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                 <Map className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-slate-800">Smart Plan Ahead</h3>
                  <p className="text-xs text-slate-500">Calculated daily targets to hit your cycle goal on time.</p>
               </div>
             </div>
             
             <div className="flex gap-4 overflow-x-auto pb-4 pt-1 hide-scrollbar snap-x">
               {forecast.map((day, idx) => (
                 <div key={idx} className={`snap-center shrink-0 w-32 p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    day.isOff 
                      ? 'bg-slate-50 border-slate-100 text-slate-400' 
                      : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md'
                 }`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60">{day.dayName}</span>
                    <span className={`text-2xl font-bold ${day.isOff ? 'text-slate-300' : 'text-slate-800'}`}>
                      {day.isOff ? 'OFF' : day.target}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                       {day.dateStr}
                    </span>
                 </div>
               ))}
               <div className="snap-center shrink-0 w-32 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <CheckCircle className="w-6 h-6" />
                  <span className="text-xs font-bold">End of Cycle</span>
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up delay-300">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <Activity className="w-5 h-5 text-slate-400" /> Status Distribution
            </h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => {
                    let fill = '#94a3b8';
                    if (entry.name === 'Worked') fill = COLORS[Status.WORKED];
                    else if (entry.name === 'Untouched') fill = COLORS[Status.UNTOUCHED];
                    else if (entry.name.includes('Pending')) fill = COLORS[Status.PENDING_JM];
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-slate-400" /> Weekly Output
            </h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} allowDecimals={false} dx={-10} />
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: number; 
  cycleValue?: number; 
  cycleLabel?: string;
  icon: React.ReactNode; 
  color: string; 
  trend: string;
  onClick: () => void;
  delay?: string;
}> = ({ title, value, cycleValue, cycleLabel, icon, color, trend, onClick, delay = "" }) => (
  <button 
    onClick={onClick}
    className={`group relative w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-left overflow-hidden animate-fade-in-up ${delay}`}
  >
    {/* Colored accent line at bottom */}
    <div className={`absolute bottom-0 left-0 right-0 h-1 ${color} opacity-70 group-hover:opacity-100 transition-opacity`}></div>
    
    <div className="flex justify-between items-start mb-4">
       <div className={`p-3 rounded-xl transition-all duration-300 bg-slate-50 text-slate-500 group-hover:bg-slate-100 group-hover:scale-110 group-hover:text-slate-800`}>
         {icon}
       </div>
       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 group-hover:border-slate-200">
         {trend}
       </span>
    </div>
    <div>
       <p className="text-4xl font-bold text-slate-800 mb-1 group-hover:scale-105 transition-transform origin-left tracking-tight">{value}</p>
       <p className="text-sm font-medium text-slate-500 mb-3">{title}</p>
       
       {cycleValue !== undefined && (
         <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 text-xs group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-700 transition-colors">
           <span className="font-bold">{cycleValue}</span>
           <span className="opacity-70">{cycleLabel || 'this cycle'}</span>
         </div>
       )}
    </div>
  </button>
);

export default Dashboard;