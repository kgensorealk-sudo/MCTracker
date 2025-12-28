import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Manuscript, Status, UserSchedule } from '../types';
import { FileText, AlertCircle, CheckCircle, Calendar, Zap, Inbox, CalendarX, TrendingUp, Activity, MoreHorizontal, BarChart3, Coffee, CalendarOff, Settings, Briefcase, RefreshCw } from 'lucide-react';

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
      <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-xs">
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

  // Default weights if missing (Full week)
  const weights = userSchedule.weeklyWeights || [1, 1, 1, 1, 1, 1, 1];

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
    const { startDate, endDate } = cycleDates;
    const inCycle = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= startDate && d <= endDate;
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
    const { startDate, endDate, cycleLabel } = cycleDates;
    const d = new Date();

    const percentage = Math.min(100, Math.round((stats.cycleWorked / target) * 100));

    // Calculate "Weighted Days Left"
    const tempToday = new Date();
    tempToday.setHours(0,0,0,0);
    
    let weightedDaysLeft = 0;
    const itrDate = new Date(tempToday);
    
    while (itrDate <= endDate) {
        const isoDate = itrDate.toISOString().split('T')[0];
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
    const isoToday = d.toISOString().split('T')[0];
    if (userSchedule.daysOff.includes(isoToday)) {
      safeDailyTarget = 0;
    }

    if (safeDailyTarget > remainingForCycleFromStartOfDay) safeDailyTarget = remainingForCycleFromStartOfDay;
    if (cycleData.completed >= target) safeDailyTarget = 0;

    const remainingToday = Math.max(0, safeDailyTarget - todayCount);
    const percentage = safeDailyTarget > 0 ? Math.min(100, Math.round((todayCount / safeDailyTarget) * 100)) : 100;
    
    let message = "";
    let suggestion = "";
    const isDayOff = userSchedule.daysOff.includes(isoToday) || todayWeight === 0;

    if (cycleData.completed >= target) {
      message = "Goal Reached";
      suggestion = `Cycle target hit.`;
    } else if (isDayOff) {
      message = "Day Off";
      suggestion = "Recharge.";
    } else if (todayWeight < 1 && todayWeight > 0) {
      // Partial day message
      if (todayCount >= safeDailyTarget) {
        message = "Light Day Done";
        suggestion = "Enjoy the rest.";
      } else {
        message = "Light Schedule";
        suggestion = `Aiming for ${remainingToday} more.`;
      }
    } else if (todayCount >= safeDailyTarget) {
      message = "On Track";
      suggestion = "Pace is good.";
    } else {
      message = "Below Pace";
      suggestion = `Need ${remainingToday} more.`;
    }

    return { 
      count: todayCount, 
      target: safeDailyTarget, 
      remaining: remainingToday, 
      percentage, 
      message,
      suggestion, 
      isDayOff 
    };
  }, [manuscripts, target, cycleData, userSchedule, userName]);

  const toggleTodayOff = () => {
    const today = new Date().toISOString().split('T')[0];
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
      const dateStr = date.toISOString().split('T')[0];
      
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header with Date */}
      <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center border-b border-slate-200 pb-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h2>
           <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm">Overview of your productivity and workflow</p>
              <button 
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${showScheduleSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600'}`}
              >
                <Settings className="w-3 h-3" />
                {showScheduleSettings ? 'Close Settings' : 'Smart Pacing'}
              </button>
           </div>
        </div>
        <HeaderClock />
      </div>

      {showScheduleSettings && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-down">
           {/* Weekly Routine */}
           <div className="flex flex-col gap-2">
             <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                   <h4 className="text-sm font-bold text-indigo-900">Weekly Routine</h4>
                   <p className="text-xs text-indigo-700 mt-1">
                     Adjust your typical workload to calculate smarter daily targets.
                   </p>
                </div>
             </div>
             
             <div className="mt-2 grid grid-cols-2 gap-3">
                {/* Saturday Control */}
                <div className="bg-white p-2 rounded-lg border border-indigo-200 shadow-sm">
                   <span className="text-xs font-bold text-indigo-900 block mb-1">Saturdays</span>
                   <div className="flex gap-1">
                      {[1, 0.5, 0].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateWeeklyWeight(6, w)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded ${
                            weights[6] === w 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100'
                          }`}
                        >
                          {w === 1 ? 'FULL' : w === 0.5 ? 'LIGHT' : 'OFF'}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Sunday Control */}
                <div className="bg-white p-2 rounded-lg border border-indigo-200 shadow-sm">
                   <span className="text-xs font-bold text-indigo-900 block mb-1">Sundays</span>
                   <div className="flex gap-1">
                      {[1, 0.5, 0].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateWeeklyWeight(0, w)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded ${
                            weights[0] === w 
                              ? 'bg-indigo-600 text-white' 
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
                <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
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
                className={`mt-2 w-full py-2 px-3 text-xs font-bold rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  userSchedule.daysOff.includes(new Date().toISOString().split('T')[0])
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                 {userSchedule.daysOff.includes(new Date().toISOString().split('T')[0]) ? 'ON BREAK (Click to Work)' : 'MARK TODAY OFF'}
              </button>
           </div>
        </div>
      )}

      {/* Stats Cards Grid - New Look */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          title="Total Files" 
          value={stats.totalFiles} 
          cycleValue={stats.cycleReceived}
          cycleLabel="Received this cycle"
          icon={<FileText className="w-5 h-5" />} 
          color="border-b-blue-500"
          trend="All Time"
          onClick={() => onFilterClick('ALL')}
        />
        <StatCard 
          title="Untouched" 
          value={stats.totalUntouched} 
          cycleValue={stats.cycleUntouched}
          cycleLabel="untouched this cycle"
          icon={<Inbox className="w-5 h-5" />} 
          color="border-b-slate-400"
          trend="Needs Action"
          onClick={() => onFilterClick(Status.UNTOUCHED)}
        />
        <StatCard 
          title="Pending" 
          value={stats.totalPending} 
          cycleValue={stats.cyclePending}
          cycleLabel="Queried this cycle"
          icon={<AlertCircle className="w-5 h-5" />} 
          color="border-b-rose-500"
          trend="Queries"
          onClick={() => onFilterClick('PENDING_GROUP')}
        />
        <StatCard 
          title="Completed" 
          value={stats.totalWorked} 
          cycleValue={stats.cycleWorked}
          cycleLabel="Worked this cycle"
          icon={<CheckCircle className="w-5 h-5" />} 
          color="border-b-emerald-500"
          trend="Finished"
          onClick={() => onFilterClick(Status.WORKED)}
        />
      </div>

      {/* Goals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cycle Progress */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group">
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
                <div className="bg-white/10 px-3 py-1 rounded-lg backdrop-blur-md flex items-center gap-2 border border-white/10">
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
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                   <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${cycleData.percentage}%` }}></div>
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
        <div className={`rounded-3xl p-8 shadow-xl relative overflow-hidden flex flex-col justify-between transition-colors duration-500 text-white ${dailyStats.isDayOff ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-blue-600 to-indigo-800'}`}>
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
               <div className="h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${dailyStats.percentage}%` }}></div>
               </div>
            </div>

            <div className="bg-black/20 rounded-xl p-4 backdrop-blur-md border border-white/10 flex gap-4 items-center">
               <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
               </div>
               <div>
                  <p className="font-bold text-sm text-white mb-0.5">{dailyStats.message}</p>
                  <p className="text-xs text-white/80">{dailyStats.suggestion}</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
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

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-slate-400" /> Weekly Output
            </h3>
            <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#64748b'}} allowDecimals={false} />
                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
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
}> = ({ title, value, cycleValue, cycleLabel, icon, color, trend, onClick }) => (
  <button 
    onClick={onClick}
    className={`group relative w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 text-left overflow-hidden`}
  >
    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-white border-b-4 ${color}`}></div>
    <div className="flex justify-between items-start mb-4">
       <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors text-slate-600 group-hover:text-slate-900">
         {icon}
       </div>
       <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
         {trend}
       </span>
    </div>
    <div>
       <p className="text-3xl font-bold text-slate-800 mb-1 group-hover:scale-105 transition-transform origin-left">{value}</p>
       <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
       
       {cycleValue !== undefined && (
         <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-xs">
           <span className="font-bold text-slate-700">{cycleValue}</span>
           <span className="text-slate-400">{cycleLabel || 'this cycle'}</span>
         </div>
       )}
    </div>
  </button>
);

export default Dashboard;