import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LabelList } from 'recharts';
import { Manuscript, Status, UserSchedule } from '../types';
import { AlertCircle, Inbox, TrendingUp, Target, Settings, ShieldAlert, Sparkles, Gauge, Flame, Zap } from 'lucide-react';
import { calculateXP, calculateLevel, DAILY_QUESTS } from '../services/gamification';

interface DashboardProps {
  userName: string;
  manuscripts: Manuscript[];
  target: number;
  userSchedule: UserSchedule;
  onUpdateTarget: (target: number) => void;
  onFilterClick: (status: Status | 'ALL' | 'PENDING_GROUP') => void;
  onUpdateSchedule: (schedule: UserSchedule) => void;
}

const HeaderClock: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right tabular-nums">
       <p className="text-lg font-black text-slate-900 leading-none mb-1">
          {currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
       </p>
       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</p>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ userName, manuscripts, target, userSchedule, onUpdateTarget, onFilterClick, onUpdateSchedule }) => {
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const weights = userSchedule.weeklyWeights || [1, 1, 1, 1, 1, 1, 1];

  // 1. ADVANCED CYCLE LOGIC
  const cycle = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    let start: Date, end: Date, label: string;
    if (day >= 11 && day <= 25) {
      start = new Date(year, month, 11); end = new Date(year, month, 25);
      label = `Cycle 1 • ${start.toLocaleString('default', { month: 'short' })}`;
    } else {
      if (day >= 26) { start = new Date(year, month, 26); end = new Date(year, month + 1, 10); } 
      else { start = new Date(year, month - 1, 26); end = new Date(year, month, 10); }
      label = `Cycle 2 • ${start.toLocaleString('default', { month: 'short' })}`;
    }
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    
    let workingDaysLeft = 0;
    const itr = new Date();
    itr.setHours(0,0,0,0);
    while (itr <= end) {
      const iso = itr.toISOString().split('T')[0];
      const weight = weights[itr.getDay()] || 0;
      if (!userSchedule.daysOff.includes(iso) && weight > 0) workingDaysLeft++;
      itr.setDate(itr.getDate() + 1);
    }

    return { start, end, label, workingDaysLeft };
  }, [weights, userSchedule.daysOff]);

  // 2. INTELLIGENT STATISTICS
  const stats = useMemo(() => {
    const now = new Date();
    const inCycle = (ds?: string) => ds && new Date(ds) >= cycle.start && new Date(ds) <= cycle.end;
    
    const workedItems = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.BILLED);
    const cycleWorked = workedItems.filter(m => inCycle(m.completedDate || m.dateStatusChanged)).length;
    const workedToday = workedItems.filter(m => isTodayDate(m.completedDate || m.dateStatusChanged || m.dateUpdated)).length;
    
    const totalPending = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;
    const urgentFiles = manuscripts.filter(m => m.priority === 'Urgent' && m.status !== Status.WORKED && m.status !== Status.BILLED);
    const untouch = manuscripts.filter(m => m.status === Status.UNTOUCHED).length;
    
    const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const recentVelocity = workedItems.filter(m => new Date(m.completedDate || m.dateUpdated) >= threeDaysAgo).length / 3;

    return { cycleWorked, workedToday, totalPending, untouch, urgentFiles, recentVelocity };
  }, [manuscripts, cycle]);

  // 3. THE "BRAIN"
  const strategy = useMemo(() => {
    const remainingToTarget = Math.max(0, target - stats.cycleWorked);
    const daysLeft = cycle.workingDaysLeft || 0;
    
    const dailyForecast: {date: string, count: number, weight: number}[] = [];
    const itr = new Date();
    itr.setHours(0,0,0,0);
    
    let totalFutureWeight = 0;
    const tempItr = new Date(itr);
    while (tempItr <= cycle.end) {
      const iso = tempItr.toISOString().split('T')[0];
      if (!userSchedule.daysOff.includes(iso)) totalFutureWeight += (weights[tempItr.getDay()] || 0);
      tempItr.setDate(tempItr.getDate() + 1);
    }

    const itemsPerWeightUnit = totalFutureWeight > 0 ? remainingToTarget / totalFutureWeight : 0;
    
    const displayItr = new Date(itr);
    for (let i = 0; i < 7; i++) {
      const iso = displayItr.toISOString().split('T')[0];
      const weight = userSchedule.daysOff.includes(iso) ? 0 : (weights[displayItr.getDay()] || 0);
      dailyForecast.push({
        date: displayItr.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        count: Math.ceil(itemsPerWeightUnit * weight),
        weight
      });
      displayItr.setDate(displayItr.getDate() + 1);
      if (displayItr > cycle.end) break;
    }

    let mode: 'CRITICAL' | 'AHEAD' | 'BEHIND' | 'CONGESTED' | 'STEADY' = 'STEADY';
    let insight = "";
    let priorityAction = "";
    const idealVelocity = remainingToTarget / (daysLeft || 1);
    const velocityGap = idealVelocity - stats.recentVelocity;

    if (stats.urgentFiles.length >= 3) {
      mode = 'CONGESTED';
      insight = "Urgent backlog is building up. Your attention is fragmented.";
      priorityAction = `Clear all ${stats.urgentFiles.length} urgent files before regular processing.`;
    } else if (velocityGap > 2) {
      mode = 'BEHIND';
      insight = `Current pace (${stats.recentVelocity.toFixed(1)}/d) is lower than required (${idealVelocity.toFixed(1)}/d).`;
      priorityAction = "Consider a high-volume sprint today to stabilize the cycle.";
    } else if (stats.cycleWorked >= target) {
      mode = 'AHEAD';
      insight = "Target reached! Velocity is now pure career growth and bonus XP.";
      priorityAction = "Focus on cleaning the Untouched queue for next cycle's headstart.";
    } else if (daysLeft <= 2 && remainingToTarget > 5) {
      mode = 'CRITICAL';
      insight = "Cycle cutoff is imminent with a significant remaining workload.";
      priorityAction = "Bypass all Low-Priority files. Process only Ready-to-Work items.";
    } else {
      mode = 'STEADY';
      insight = "Pace is synchronized with capacity. Consistency is your best asset today.";
      priorityAction = `Achieve today's target of ${dailyForecast[0]?.count || 0} files to remain green.`;
    }

    return { dailyForecast, mode, insight, priorityAction, remainingToTarget, idealVelocity };
  }, [stats, target, cycle, weights, userSchedule.daysOff]);

  const levelData = calculateLevel(calculateXP(manuscripts, target));

  const todayQuota = strategy.dailyForecast[0]?.count || 0;
  const quotaProgress = todayQuota > 0 ? Math.round((stats.workedToday / todayQuota) * 100) : 100;
  const isTargetAchieved = stats.workedToday >= todayQuota && todayQuota > 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded uppercase tracking-widest">Studio Workspace</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v3.0 Strategic Analyst</div>
           </div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome, {userName}</h2>
        </div>
        <div className="flex items-center gap-6">
           <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                {levelData.level}
              </div>
              <div className="pr-2 border-r border-slate-100">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Rank</p>
                <p className="text-xs font-bold text-slate-800 leading-none">{levelData.title}</p>
              </div>
              <div className="pl-1">
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                 <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${strategy.mode === 'BEHIND' || strategy.mode === 'CRITICAL' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <p className="text-xs font-bold text-slate-800 leading-none capitalize">{strategy.mode.toLowerCase()}</p>
                 </div>
              </div>
           </div>
           <HeaderClock />
        </div>
      </div>

      {/* Hero Shift Progress Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
        {/* Worked Today Gauge */}
        <div className="md:col-span-2 bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-200 relative overflow-hidden flex flex-col justify-between h-64 border border-slate-800">
           <div className="absolute right-0 top-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
           <div className="absolute left-0 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
           
           <div className="relative flex justify-between items-start">
              <div>
                 <div className="flex items-center gap-2 mb-2">
                    <div className="px-2 py-0.5 bg-blue-500 text-[10px] font-black rounded uppercase tracking-widest text-white">Daily Performance</div>
                    {isTargetAchieved && <div className="px-2 py-0.5 bg-emerald-500 text-[10px] font-black rounded uppercase tracking-widest text-white flex items-center gap-1"><Flame className="w-3 h-3" /> Target Met</div>}
                 </div>
                 <h3 className="text-4xl font-black tracking-tighter">Shift Momentum</h3>
                 <p className="text-slate-400 text-sm mt-1 font-medium max-w-xs">Your real-time productivity progress for the current working session.</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Status</p>
                 <div className="flex items-center gap-2 justify-end">
                    <span className={`text-2xl font-black ${isTargetAchieved ? 'text-emerald-400' : 'text-blue-400'}`}>{quotaProgress}%</span>
                 </div>
              </div>
           </div>

           <div className="relative mt-8">
              <div className="flex justify-between items-end mb-4">
                 <div className="flex gap-12">
                    <div className="group cursor-help">
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Worked Today</p>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-white">{stats.workedToday}</span>
                          <span className="text-slate-500 font-bold">files</span>
                       </div>
                    </div>
                    <div className="group cursor-help">
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Today's Quota</p>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-slate-300">{todayQuota}</span>
                          <span className="text-slate-500 font-bold">goal</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex flex-col items-end">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Remaining</p>
                    <span className="text-2xl font-black text-indigo-400">{Math.max(0, todayQuota - stats.workedToday)}</span>
                 </div>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-700 shadow-inner">
                 <div 
                    className={`h-full rounded-full transition-all duration-1000 shadow-lg ${isTargetAchieved ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-emerald-500/20' : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/20'}`} 
                    style={{ width: `${Math.min(100, quotaProgress)}%` }}
                 ></div>
              </div>
           </div>
        </div>

        {/* Dynamic Context Card */}
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-100 transition-all">
           <div className="flex justify-between items-start">
              <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                 <Gauge className="w-8 h-8" />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cycle Projection</p>
                 <h4 className="text-2xl font-black text-slate-900 leading-tight">{stats.cycleWorked} / {target}</h4>
              </div>
           </div>
           
           <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                 <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{cycle.workingDaysLeft} days remaining in cycle</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-indigo-50/30 transition-colors">
                 <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Pace</span>
                 </div>
                 <p className="text-lg font-black text-slate-800 leading-none">{strategy.idealVelocity.toFixed(1)} <span className="text-xs text-slate-400 ml-1">items/day</span></p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
           <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                 <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Strategic Insight Engine</h3>
                 </div>
                 <button onClick={() => setShowScheduleSettings(!showScheduleSettings)} className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase transition-colors flex items-center gap-1">
                    <Settings className="w-3 h-3" /> Configure Workspace
                 </button>
              </div>

              {showScheduleSettings && (
                 <div className="p-6 bg-blue-50/30 border-b border-blue-50 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Daily Work Capacity (Weekly Weights)</p>
                          <div className="flex gap-1">
                             {['S','M','T','W','T','F','S'].map((d, i) => (
                               <button 
                                 key={i} 
                                 onClick={() => {
                                   const n = [...weights]; n[i] = n[i] > 0 ? 0 : 1;
                                   onUpdateSchedule({...userSchedule, weeklyWeights: n});
                                 }}
                                 className={`flex-1 py-2 rounded text-[10px] font-black transition-all ${weights[i] > 0 ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}
                               >
                                 {d}
                               </button>
                             ))}
                          </div>
                       </div>
                       <div className="flex flex-col justify-end">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Cycle Target Performance Adjustment</p>
                          <div className="flex items-center gap-3">
                             <input 
                               type="range" min="10" max="1000" step="5" value={target} 
                               onChange={(e) => onUpdateTarget(parseInt(e.target.value))}
                               className="flex-1 accent-blue-600"
                             />
                             <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden h-10 w-24">
                                <input 
                                  type="number"
                                  className="w-full h-full text-center text-sm font-black text-slate-900 outline-none"
                                  value={target}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    onUpdateTarget(Math.min(2000, Math.max(0, val)));
                                  }}
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              )}

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div>
                       <div className="flex items-center gap-2 mb-2 text-blue-600">
                          <ShieldAlert className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Capacity Analysis</span>
                       </div>
                       <p className="text-sm font-medium text-slate-600 leading-relaxed">{strategy.insight}</p>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl text-white shadow-xl relative overflow-hidden">
                       <div className="absolute right-0 top-0 p-2 opacity-10"><Target className="w-12 h-12" /></div>
                       <p className="text-[8px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-2">Priority Objective</p>
                       <p className="text-sm font-bold tracking-tight">{strategy.priorityAction}</p>
                    </div>
                 </div>
                 
                 <div className="flex flex-col">
                    <div className="flex justify-between items-end mb-4">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cycle Velocity Map</p>
                       <span className="text-[10px] font-bold text-slate-900">{stats.cycleWorked} of {target} Secured</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                       <div className={`h-full transition-all duration-1000 ${strategy.mode === 'BEHIND' ? 'bg-amber-500' : strategy.mode === 'CRITICAL' ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${(stats.cycleWorked / target) * 100}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                       <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Required Velocity</p>
                          <p className="text-lg font-black text-slate-900 leading-none">{strategy.idealVelocity.toFixed(1)} <span className="text-[10px] text-slate-400">/d</span></p>
                       </div>
                       <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recent Velocity</p>
                          <p className="text-lg font-black text-slate-900 leading-none">{stats.recentVelocity.toFixed(1)} <span className="text-[10px] text-slate-400">/d</span></p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Dynamic Workload Forecast</h3>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">Suggested distribution based on your weekly weightings and {cycle.workingDaysLeft} work-days remaining.</p>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-blue-600"></div><span className="text-[9px] font-bold text-slate-500 uppercase">Quota</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-slate-200"></div><span className="text-[9px] font-bold text-slate-500 uppercase">Weight</span></div>
                 </div>
              </div>
              <div className="h-64 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={strategy.dailyForecast} margin={{ top: 20, right: 0, left: -25, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8', fontWeight: 700}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#94a3b8'}} />
                       <Tooltip 
                         cursor={{fill: '#f8fafc', radius: 4}}
                         content={({ active, payload }) => {
                           if (active && payload && payload.length) {
                             const data = payload[0].payload;
                             return (
                               <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-[10px]">
                                 <p className="font-bold mb-2 opacity-60 uppercase tracking-widest">{data.date}</p>
                                 <p className="text-lg font-black text-blue-400">{data.count} <span className="text-[8px] text-white">MANUSCRIPTS</span></p>
                                 <p className="mt-1 opacity-60">Weight factor: {data.weight.toFixed(1)}x</p>
                               </div>
                             );
                           }
                           return null;
                         }}
                       />
                       <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32}>
                          {strategy.dailyForecast.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.count > 10 ? '#ef4444' : entry.count === 0 ? '#e2e8f0' : '#2563eb'} />
                          ))}
                          <LabelList 
                            dataKey="count" 
                            position="top" 
                            offset={8} 
                            style={{ fontSize: '10px', fontWeight: '800', fill: '#0f172a' }}
                            formatter={(val: any) => (Number(val) > 0 ? val : '')}
                          />
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           {/* Queue Composition Sidebar */}
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle className="w-20 h-20" /></div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Real-time Snapshot</p>
              
              <div className="space-y-4 relative z-10">
                 <div onClick={() => onFilterClick('PENDING_GROUP')} className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl cursor-pointer hover:border-rose-300 transition-all">
                    <div className="flex items-center gap-3">
                       <AlertCircle className="w-4 h-4 text-rose-600" />
                       <span className="text-xs font-bold text-rose-900">Active Queries</span>
                    </div>
                    <span className="text-sm font-black text-rose-600">{stats.totalPending}</span>
                 </div>
                 
                 <div onClick={() => onFilterClick(Status.UNTOUCHED)} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-3">
                       <Inbox className="w-4 h-4 text-slate-400" />
                       <span className="text-xs font-bold text-slate-700">Raw Queue</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{stats.untouch}</span>
                 </div>
                 
                 <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-3">
                       <TrendingUp className="w-4 h-4 text-blue-600" />
                       <span className="text-xs font-bold text-blue-900">Remaining Need</span>
                    </div>
                    <span className="text-sm font-black text-blue-600">{strategy.remainingToTarget}</span>
                 </div>

                 {/* Cycle Progress Mini Chart */}
                 <div className="mt-4 p-4 bg-slate-900 rounded-xl text-white">
                    <div className="flex justify-between items-end mb-2">
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Shift Momentum</p>
                       <span className="text-[10px] font-black text-blue-400">{quotaProgress}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${quotaProgress}%` }}></div>
                    </div>
                    <p className="text-[8px] text-slate-500 mt-2 font-medium">Progress towards today's calculated quota.</p>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Active Daily Quests</p>
              <div className="space-y-3">
                 {DAILY_QUESTS.map(q => {
                   const prog = q.progress(manuscripts);
                   const done = q.isCompleted(manuscripts);
                   const perc = Math.min(100, (prog / q.target) * 100);
                   return (
                     <div key={q.id} className={`p-3 rounded-xl border transition-all ${done ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                           <p className={`text-[11px] font-bold ${done ? 'text-emerald-700' : 'text-slate-700'}`}>{q.title}</p>
                           <span className="text-[9px] font-bold text-indigo-50">+{q.rewardXP} XP</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-1000 ${done ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${perc}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-1.5">
                           <span className="text-[8px] font-bold text-slate-400 uppercase">{q.description}</span>
                           <span className="text-[9px] font-black text-slate-600">{prog}/{q.target}</span>
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;