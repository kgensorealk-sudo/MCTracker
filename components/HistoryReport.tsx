import React, { useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { Calendar, Trophy, TrendingUp, Clock, FileText, ArrowUpRight, ArrowDownRight, History, Flame, Search, Zap, AlertCircle, HelpCircle } from 'lucide-react';

interface HistoryReportProps {
  manuscripts: Manuscript[];
  userName: string;
}

const HistoryReport: React.FC<HistoryReportProps> = ({ manuscripts }) => {
  
  const stats = useMemo(() => {
    const months: Record<string, { count: number; totalTat: number; countWithTat: number }> = {};
    const dailyStats: Record<string, { worked: number; queried: number }> = {};
    const workDates = new Set<string>();
    let totalWorked = 0;
    
    // Helper to get Year-Month key
    const getMonthKey = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } catch {
        return null;
      }
    };

    // Helper to format key to Label
    const formatLabel = (key: string) => {
      const [year, month] = key.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    manuscripts.forEach(m => {
      // 1. Monthly Stats (Worked only)
      if (m.status === Status.WORKED) {
        // Robust Date Selection: explicit completedDate -> status change -> updated -> received
        const workDate = m.completedDate || m.dateStatusChanged || m.dateUpdated || m.dateReceived;
        const key = getMonthKey(workDate);
        
        if (key) {
            if (!months[key]) {
              months[key] = { count: 0, totalTat: 0, countWithTat: 0 };
            }
            
            months[key].count += 1;
            totalWorked++;

            // Calculate Turnaround Time (TAT)
            const start = new Date(m.dateReceived).getTime();
            const end = new Date(workDate).getTime();
            
            if (!isNaN(start) && !isNaN(end)) {
                const days = Math.max(0, (end - start) / (1000 * 3600 * 24));
                months[key].totalTat += days;
                months[key].countWithTat += 1;
            }
        }
      }

      // 2. Daily Stats (Worked & Queried)
      // WORKED
      if (m.status === Status.WORKED) {
         const raw = m.completedDate || m.dateStatusChanged || m.dateUpdated;
         if (raw) {
             const d = raw.split('T')[0];
             if (!dailyStats[d]) dailyStats[d] = { worked: 0, queried: 0 };
             dailyStats[d].worked++;
             workDates.add(d);
         }
      }
      
      // QUERIED (Pending JM/TL/CED) - New Robust Logic
      // Priority 1: Use persistent dateQueried if available (Handles resolved queries)
      if (m.dateQueried) {
         const d = m.dateQueried.split('T')[0];
         if (!dailyStats[d]) dailyStats[d] = { worked: 0, queried: 0 };
         dailyStats[d].queried++;
      } 
      // Priority 2: Fallback for old data - use current status date if currently pending
      else if ([Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)) {
         const raw = m.dateStatusChanged || m.dateUpdated;
         if (raw) {
            const d = raw.split('T')[0];
            if (!dailyStats[d]) dailyStats[d] = { worked: 0, queried: 0 };
            dailyStats[d].queried++;
         }
      }
    });

    // --- Process Monthly Data ---
    const chartData = Object.entries(months)
      .map(([key, data]) => ({
        key,
        label: formatLabel(key),
        count: data.count,
        avgTat: data.countWithTat > 0 ? parseFloat((data.totalTat / data.countWithTat).toFixed(1)) : 0
      }))
      .sort((a, b) => a.key.localeCompare(b.key)); // Sort chronologically

    const topMonth = [...chartData].sort((a, b) => b.count - a.count)[0];

    // Last Month vs Current Month
    const now = new Date();
    const currentKey = getMonthKey(now.toISOString());
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = getMonthKey(lastMonthDate.toISOString()) || '';

    const currentStats = (currentKey && months[currentKey]) ? months[currentKey] : { count: 0 };
    const lastStats = (lastMonthKey && months[lastMonthKey]) ? months[lastMonthKey] : { count: 0 };

    const overallTat = chartData.reduce((acc, curr) => acc + (curr.avgTat * curr.count), 0) / Math.max(1, totalWorked);

    // --- Process Daily Records ---
    let maxWorkedDay = { date: 'N/A', count: 0 };
    let maxQueryDay = { date: 'N/A', count: 0 };

    Object.entries(dailyStats).forEach(([date, counts]) => {
        if (counts.worked > maxWorkedDay.count) maxWorkedDay = { date, count: counts.worked };
        if (counts.queried > maxQueryDay.count) maxQueryDay = { date, count: counts.queried };
    });

    // --- Process Streak ---
    const sortedDates = Array.from(workDates).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    sortedDates.forEach(dateStr => {
        const currentDate = new Date(dateStr);
        // Normalize time
        currentDate.setHours(0,0,0,0);

        if (!prevDate) {
            currentStreak = 1;
        } else {
            const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
                currentStreak++;
            } else {
                currentStreak = 1;
            }
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        prevDate = currentDate;
    });

    const formatDate = (d: string) => {
        if (d === 'N/A') return d;
        try {
            return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return d;
        }
    };

    return {
      chartData,
      topMonth,
      totalWorked,
      overallTat: overallTat.toFixed(1),
      maxStreak,
      comparison: {
        current: currentStats.count,
        last: lastStats.count,
        diff: currentStats.count - lastStats.count,
        lastMonthLabel: lastMonthKey ? formatLabel(lastMonthKey) : 'Last Month'
      },
      records: {
        bestWorked: { ...maxWorkedDay, label: formatDate(maxWorkedDay.date) },
        mostQueried: { ...maxQueryDay, label: formatDate(maxQueryDay.date) }
      }
    };
  }, [manuscripts]);

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
          <History className="w-8 h-8 text-indigo-600" />
          History & Reports
        </h2>
        <p className="text-slate-500 text-sm">Historical analysis of your productivity and performance trends.</p>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Top Productive Month */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute right-0 top-0 p-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform">
             <Trophy className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100 font-bold uppercase text-xs tracking-wider mb-3">Top Productive Month</p>
            <div className="flex items-end gap-2">
              <h3 className="text-4xl font-bold">{stats.topMonth?.count || 0}</h3>
              <span className="text-indigo-200 text-sm mb-1 font-medium">files completed</span>
            </div>
            <p className="mt-3 text-sm font-semibold bg-white/20 inline-block px-3 py-1 rounded-lg backdrop-blur-sm">
              {stats.topMonth?.label || 'N/A'}
            </p>
          </div>
        </div>

        {/* Last Month Report */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
              <div>
                 <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Last Month ({stats.comparison.lastMonthLabel})</p>
                 <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.comparison.last}</h3>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
                 <Calendar className="w-6 h-6 text-slate-500" />
              </div>
           </div>
           
           <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Vs Current Month:</span>
              <span className={`flex items-center text-sm font-bold ${stats.comparison.diff >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                 {stats.comparison.diff > 0 ? '+' : ''}{stats.comparison.diff}
                 {stats.comparison.diff >= 0 ? <ArrowUpRight className="w-4 h-4 ml-1" /> : <ArrowDownRight className="w-4 h-4 ml-1" />}
              </span>
           </div>
        </div>

         {/* Total Lifetime */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
              <div>
                 <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Lifetime Worked</p>
                 <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.totalWorked}</h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
                 <FileText className="w-6 h-6 text-emerald-600" />
              </div>
           </div>
           <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Avg Turnaround:</span>
              <span className="text-sm font-bold text-slate-700 flex items-center">
                 <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> {stats.overallTat} days
              </span>
           </div>
        </div>
      </div>

      {/* All-Time Records Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow hover:border-orange-200 group">
             <div className="p-4 bg-orange-50 rounded-full shrink-0 group-hover:bg-orange-100 transition-colors">
                <Flame className="w-8 h-8 text-orange-600" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Best Day (Worked)</p>
                <div className="flex items-baseline gap-2 mt-1">
                   <h3 className="text-2xl font-bold text-slate-800">{stats.records.bestWorked.count} files</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-1" title={stats.records.bestWorked.label}>
                    {stats.records.bestWorked.label}
                </p>
             </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow hover:border-rose-200 group">
             <div className="p-4 bg-rose-50 rounded-full shrink-0 group-hover:bg-rose-100 transition-colors">
                <Search className="w-8 h-8 text-rose-600" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Most Queries (1 Day)</p>
                <div className="flex items-baseline gap-2 mt-1">
                   <h3 className="text-2xl font-bold text-slate-800">{stats.records.mostQueried.count} queries</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-1" title={stats.records.mostQueried.label}>
                    {stats.records.mostQueried.label}
                </p>
             </div>
          </div>

           <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow hover:border-blue-200 group">
             <div className="p-4 bg-blue-50 rounded-full shrink-0 group-hover:bg-blue-100 transition-colors">
                <Zap className="w-8 h-8 text-blue-600" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Longest Streak</p>
                <div className="flex items-baseline gap-2 mt-1">
                   <h3 className="text-2xl font-bold text-slate-800">{stats.maxStreak} days</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-1">
                   Consecutive working days
                </p>
             </div>
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Monthly Productivity Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
           <div className="flex flex-col mb-6">
              <div className="flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Monthly Output
                 </h3>
                 <div className="px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Volume Metric
                 </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Total manuscripts completed per month.</p>
           </div>

           <div className="h-[300px] w-full flex-1 min-h-[300px]">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                         dataKey="label" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 11, fill: '#94a3b8' }} 
                         interval="preserveStartEnd"
                      />
                      <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 11, fill: '#94a3b8' }} 
                         width={30}
                      />
                      <Tooltip 
                         cursor={{fill: '#f8fafc'}}
                         content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                               return (
                                  <div className="bg-slate-900 text-white text-xs py-2 px-3 rounded-lg shadow-xl">
                                     <p className="font-bold mb-1 opacity-70">{label}</p>
                                     <p className="text-base">Completed: <span className="text-indigo-300 font-bold">{payload[0].value}</span></p>
                                  </div>
                               );
                            }
                            return null;
                         }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50} isAnimationActive={false}>
                         {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.key === stats.topMonth?.key ? '#6366f1' : '#cbd5e1'} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                   <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm font-medium">No history data available yet.</p>
                   <p className="text-xs opacity-75">Mark files as 'Worked' to see charts.</p>
                </div>
              )}
           </div>
           
           {/* Detailed Explanation: Output */}
           <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                 <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Understanding this Graph
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                 <div>
                    <span className="font-semibold text-indigo-600 block mb-1">What it tracks</span>
                    <p className="text-slate-600 leading-relaxed">
                       The sheer volume of work you finish. Each bar represents the total count of files marked as <span className="font-mono bg-indigo-50 text-indigo-700 px-1 rounded font-bold">WORKED</span> in that month.
                    </p>
                 </div>
                 <div>
                    <span className="font-semibold text-indigo-600 block mb-1">Why it matters</span>
                    <p className="text-slate-600 leading-relaxed">
                       Higher bars mean higher productivity. The <span className="text-indigo-500 font-bold">purple bar</span> highlights your personal best month ever.
                    </p>
                 </div>
              </div>
           </div>
        </div>

        {/* Turnaround Time Trend */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
           <div className="flex flex-col mb-6">
              <div className="flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" /> Turnaround Efficiency
                 </h3>
                 <div className="px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Speed Metric
                 </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Average days taken to complete a file.</p>
           </div>

           <div className="h-[300px] w-full flex-1 min-h-[300px]">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                         dataKey="label" 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 11, fill: '#94a3b8' }} 
                         interval="preserveStartEnd"
                      />
                      <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tick={{ fontSize: 11, fill: '#94a3b8' }} 
                         width={30}
                      />
                      <Tooltip 
                         cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                         content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                               return (
                                  <div className="bg-white border border-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg shadow-xl">
                                     <p className="font-bold mb-1 border-b border-slate-100 pb-1">{label}</p>
                                     <p className="flex items-center gap-2 text-sm">
                                        Avg TAT: <span className="text-amber-600 font-bold">{payload[0].value} days</span>
                                     </p>
                                  </div>
                               );
                            }
                            return null;
                         }}
                      />
                      <Line 
                         type="monotone" 
                         dataKey="avgTat" 
                         stroke="#f59e0b" 
                         strokeWidth={3} 
                         dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                         activeDot={{ r: 6, fill: '#f59e0b' }}
                         isAnimationActive={false}
                      />
                   </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                   <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm font-medium">No turnaround data available.</p>
                   <p className="text-xs opacity-75">Complete more files to track efficiency.</p>
                </div>
              )}
           </div>
           
           {/* Detailed Explanation: Speed */}
           <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                 <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Understanding this Graph
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                 <div>
                    <span className="font-semibold text-amber-600 block mb-1">What it tracks</span>
                    <p className="text-slate-600 leading-relaxed">
                       Speed. It measures the average gap between <span className="font-mono bg-slate-200 px-1 rounded font-bold">Date Sent</span> and <span className="font-mono bg-slate-200 px-1 rounded font-bold">Date Completed</span> for files finished that month.
                    </p>
                 </div>
                 <div>
                    <span className="font-semibold text-amber-600 block mb-1">Why it matters</span>
                    <p className="text-slate-600 leading-relaxed">
                       <span className="font-bold text-slate-800">Lower is better.</span> A downward line means you are working faster. Spikes often indicate difficult batches or backlog clearing.
                    </p>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
         <div className="p-6 border-b border-slate-100 bg-slate-50/30">
            <h3 className="font-bold text-slate-800">Monthly Detailed Breakdown</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                     <th className="px-6 py-4">Month</th>
                     <th className="px-6 py-4">Files Completed</th>
                     <th className="px-6 py-4">Avg Turnaround</th>
                     <th className="px-6 py-4">Performance Tier</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {stats.chartData.length === 0 && (
                     <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                           No data available yet. Start completing manuscripts to populate this report.
                        </td>
                     </tr>
                  )}
                  {[...stats.chartData].reverse().map((row) => (
                     <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-700">{row.label}</td>
                        <td className="px-6 py-4 text-slate-600">{row.count}</td>
                        <td className="px-6 py-4 text-slate-600">{row.avgTat} days</td>
                        <td className="px-6 py-4">
                           {row.count >= 50 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                 <Trophy className="w-3.5 h-3.5" /> Elite
                              </span>
                           ) : row.count >= 30 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                 <TrendingUp className="w-3.5 h-3.5" /> High
                              </span>
                           ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                 Standard
                              </span>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default HistoryReport;