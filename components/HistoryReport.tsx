
import React, { useMemo, useState } from 'react';
import { Manuscript, Status } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Trophy, TrendingUp, Clock, FileText, History, Search, Zap, LayoutGrid, ClipboardList, FileSearch, AlertCircle, BarChart3 } from 'lucide-react';
import BillingReconciliationModal from './BillingReconciliationModal';

interface HistoryReportProps {
  manuscripts: Manuscript[];
  userName: string;
  onBulkUpdate: (ids: string[], updates: Partial<Manuscript>) => void;
}

interface CycleInfo {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
}

const HistoryReport: React.FC<HistoryReportProps> = ({ manuscripts, onBulkUpdate }) => {
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);

  // Helper: Determine which Cycle a date belongs to
  const getCycleForDate = (dateStr: string): CycleInfo => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    let startDate: Date;
    let endDate: Date;
    let label: string;
    let id: string;

    if (day >= 11 && day <= 25) {
      startDate = new Date(year, month, 11);
      endDate = new Date(year, month, 25);
      label = `11-25 ${startDate.toLocaleString('default', { month: 'short' })} ${year}`;
      id = `${year}-${String(month + 1).padStart(2, '0')}-C1`;
    } else {
      if (day >= 26) {
        startDate = new Date(year, month, 26);
        const nextMonth = new Date(year, month + 1, 10);
        endDate = nextMonth;
      } else {
        startDate = new Date(year, month - 1, 26);
        endDate = new Date(year, month, 10);
      }
      label = `${startDate.toLocaleString('default', { month: 'short' })} 26 - ${endDate.toLocaleString('default', { month: 'short' })} 10 (${endDate.getFullYear()})`;
      id = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-C2`;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { id, label, startDate, endDate };
  };

  const stats = useMemo(() => {
    const months: Record<string, { count: number; totalTat: number; countWithTat: number }> = {};
    const dailyStats: Record<string, { worked: number; queried: number }> = {};
    const dailyUniqueFiles: Record<string, Set<string>> = {};
    const cycleGroups: Record<string, { info: CycleInfo; files: Manuscript[] }> = {};
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

    const addToFileSet = (dateStr: string, id: string) => {
      const d = dateStr.split('T')[0];
      if (!dailyUniqueFiles[d]) dailyUniqueFiles[d] = new Set();
      dailyUniqueFiles[d].add(id);
    };

    manuscripts.forEach(m => {
      // 1. Monthly Stats (Worked and Billed items count as "Worked" for history)
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
        const workDate = m.completedDate || m.dateStatusChanged || m.dateUpdated || m.dateReceived;
        const monthKey = getMonthKey(workDate);
        
        if (monthKey) {
            if (!months[monthKey]) {
              months[monthKey] = { count: 0, totalTat: 0, countWithTat: 0 };
            }
            months[monthKey].count += 1;
            totalWorked++;

            const start = new Date(m.dateReceived).getTime();
            const end = new Date(workDate).getTime();
            if (!isNaN(start) && !isNaN(end)) {
                const days = Math.max(0, (end - start) / (1000 * 3600 * 24));
                months[monthKey].totalTat += days;
                months[monthKey].countWithTat += 1;
            }
        }

        // 2. Cycle Grouping
        const cycle = getCycleForDate(workDate);
        if (!cycleGroups[cycle.id]) {
          cycleGroups[cycle.id] = { info: cycle, files: [] };
        }
        cycleGroups[cycle.id].files.push(m);
      }

      // 3. Daily Stats Tracking
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
         const raw = m.completedDate || m.dateStatusChanged || m.dateUpdated;
         if (raw) {
             const d = raw.split('T')[0];
             if (!dailyStats[d]) dailyStats[d] = { worked: 0, queried: 0 };
             dailyStats[d].worked++;
             workDates.add(d);
             addToFileSet(raw, m.id);
         }
      }
      
      if (m.dateQueried) {
         const dStr = m.dateQueried.split('T')[0];
         if (!dailyStats[dStr]) dailyStats[dStr] = { worked: 0, queried: 0 };
         dailyStats[dStr].queried++;
         addToFileSet(m.dateQueried, m.id);
      } else if ([Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)) {
         const raw = m.dateStatusChanged || m.dateUpdated;
         if (raw) {
            const dStr = raw.split('T')[0];
            if (!dailyStats[dStr]) dailyStats[dStr] = { worked: 0, queried: 0 };
            dailyStats[dStr].queried++;
            addToFileSet(raw, m.id);
         }
      }
    });

    const chartData = Object.entries(months)
      .map(([key, data]) => ({
        key,
        label: formatLabel(key),
        count: data.count,
        avgTat: data.countWithTat > 0 ? parseFloat((data.totalTat / data.countWithTat).toFixed(1)) : 0
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const overallTat = chartData.reduce((acc, curr) => acc + (curr.avgTat * curr.count), 0) / Math.max(1, totalWorked);

    // Calculate Top Productive Cycle
    const sortedCyclesByCount = Object.values(cycleGroups)
      .map(group => ({
        label: group.info.label,
        count: group.files.length,
        id: group.info.id
      }))
      .sort((a, b) => b.count - a.count);
    
    const topCycle = sortedCyclesByCount[0] || { label: 'N/A', count: 0, id: '' };

    // Daily Records
    let maxWorkedDay = { date: 'N/A', count: 0 };
    let maxActivityDay = { date: 'N/A', count: 0 };
    Object.entries(dailyStats).forEach(([date, counts]) => {
        if (counts.worked > maxWorkedDay.count) maxWorkedDay = { date, count: counts.worked };
    });
    Object.entries(dailyUniqueFiles).forEach(([date, fileSet]) => {
        if (fileSet.size > maxActivityDay.count) maxActivityDay = { date, count: fileSet.size };
    });

    // Streak
    const sortedDates = Array.from(workDates).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;
    sortedDates.forEach(dateStr => {
        const currentDate = new Date(dateStr);
        currentDate.setHours(0,0,0,0);
        if (!prevDate) {
            currentStreak = 1;
        } else {
            const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) currentStreak++;
            else currentStreak = 1;
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        prevDate = currentDate;
    });

    // Sorted Cycles for dropdown
    const sortedCycles = Object.values(cycleGroups).sort((a, b) => b.info.id.localeCompare(a.info.id));

    // Cycle performance data for the new graph
    const cycleChartData = [...sortedCycles].reverse().map(c => ({
      name: c.info.label.split(' (')[0],
      count: c.files.length
    }));

    return {
      chartData,
      topCycle,
      totalWorked,
      overallTat: overallTat.toFixed(1),
      maxStreak,
      records: {
        bestWorked: { ...maxWorkedDay, label: maxWorkedDay.date !== 'N/A' ? new Date(maxWorkedDay.date).toLocaleDateString() : 'N/A' },
        peakActivity: { ...maxActivityDay, label: maxActivityDay.date !== 'N/A' ? new Date(maxActivityDay.date).toLocaleDateString() : 'N/A' }
      },
      cycleGroups,
      sortedCycles,
      cycleChartData
    };
  }, [manuscripts]);

  // Set default cycle on load
  if (stats.sortedCycles.length > 0 && !selectedCycleId) {
     setSelectedCycleId(stats.sortedCycles[0].info.id);
  }

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-indigo-600" />
            History & Reports
          </h2>
          <p className="text-slate-500 text-sm">Long-term productivity trends and detailed cycle analysis.</p>
        </div>
        <button 
           onClick={() => setIsReconModalOpen(true)}
           className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
        >
           <ClipboardList className="w-4 h-4" />
           Reconcile Billing
        </button>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute right-0 top-0 p-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform">
             <Trophy className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-indigo-100 font-bold uppercase text-xs tracking-wider mb-3">Top Productive Cycle</p>
            <div className="flex items-end gap-2">
              <h3 className="text-4xl font-bold">{stats.topCycle.count}</h3>
              <span className="text-indigo-200 text-sm mb-1 font-medium">files completed</span>
            </div>
            <p className="mt-3 text-sm font-semibold bg-white/20 inline-block px-3 py-1 rounded-lg backdrop-blur-sm">
              {stats.topCycle.label}
            </p>
          </div>
        </div>

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

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow hover:border-indigo-200 group">
             <div className="p-4 bg-indigo-50 rounded-full shrink-0 group-hover:bg-indigo-100 transition-colors">
                <LayoutGrid className="w-8 h-8 text-indigo-600" />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Peak Activity (1 Day)</p>
                <div className="flex items-baseline gap-2 mt-1">
                   <h3 className="text-2xl font-bold text-slate-800">{stats.records.peakActivity.count} files</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate mt-1">
                    {stats.records.peakActivity.label}
                </p>
             </div>
          </div>
      </div>

      {/* Cycle Performance Graph */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
              <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-500" /> Cycle Output History
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Completion volume per individual billing cycle (11th-25th & 26th-10th)</p>
              </div>
              <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                  Performance Trend
              </div>
          </div>
          <div className="h-[300px] w-full">
              {stats.cycleChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.cycleChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                              <linearGradient id="cycleGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8} />
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#94a3b8' }} 
                              interval={0}
                              angle={-10}
                              textAnchor="end"
                              height={50}
                          />
                          <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#94a3b8' }} 
                          />
                          <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                      return (
                                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs">
                                              <p className="font-bold mb-1 opacity-70">{label}</p>
                                              <p className="text-base">Files: <span className="text-indigo-300 font-bold">{payload[0].value}</span></p>
                                          </div>
                                      );
                                  }
                                  return null;
                              }}
                          />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#cycleGradient)" maxBarSize={60} isAnimationActive={false}>
                            {stats.cycleChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fillOpacity={0.8 + (index / stats.cycleChartData.length) * 0.2} />
                            ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                      <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm font-medium">Insufficient cycle history to display graph.</p>
                  </div>
              )}
          </div>
      </div>

      {/* Cycle History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-page-enter">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileSearch className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="font-bold text-slate-800">Cycle Worked Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Detailed breakdown of files handled per cycle</p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Filter Cycle:</label>
               <select 
                  className="text-sm border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 py-2 px-3 font-semibold text-slate-700 min-w-[200px]"
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
               >
                  {stats.sortedCycles.map(c => (
                     <option key={c.info.id} value={c.info.id}>{c.info.label} ({c.files.length} files)</option>
                  ))}
               </select>
            </div>
         </div>
         
         <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
            <table className="w-full text-sm text-center">
               <thead className="bg-slate-50/80 text-slate-500 font-bold text-[11px] uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                     <th className="px-6 py-4">Manuscript ID</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4">Journal</th>
                     <th className="px-6 py-4">Received</th>
                     <th className="px-6 py-4">Completed</th>
                     <th className="px-6 py-4">Performance</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {!selectedCycleId || stats.cycleGroups[selectedCycleId]?.files.length === 0 ? (
                     <tr>
                        <td colSpan={6} className="px-6 py-24 text-center text-slate-400">
                           <div className="flex flex-col items-center gap-2">
                              <Search className="w-8 h-8 opacity-20" />
                              <p>No records found for this cycle.</p>
                           </div>
                        </td>
                     </tr>
                  ) : (
                     stats.cycleGroups[selectedCycleId].files.map((m) => {
                        const start = new Date(m.dateReceived).getTime();
                        const end = new Date(m.completedDate || m.dateStatusChanged || '').getTime();
                        const tat = Math.max(0, (end - start) / (1000 * 3600 * 24)).toFixed(1);
                        const isFast = parseFloat(tat) <= 1;

                        return (
                           <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-6 py-4 font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.manuscriptId}</td>
                              <td className="px-6 py-4 text-center">
                                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tight ${
                                   m.status === Status.BILLED ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                                 }`}>
                                   {m.status === Status.BILLED ? 'Billed' : 'Worked'}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-mono text-[11px] uppercase tracking-tighter">{m.journalCode}</td>
                              <td className="px-6 py-4 text-slate-600 font-medium">{new Date(m.dateReceived).toLocaleDateString()}</td>
                              <td className="px-6 py-4">
                                 <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                    {new Date(m.completedDate || m.dateStatusChanged || '').toLocaleDateString()}
                                 </span>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex justify-center items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFast ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                       {tat}d TAT
                                    </span>
                                    {isFast && <Zap className="w-3 h-3 text-indigo-400 fill-indigo-400" />}
                                 </div>
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Monthly Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <p className="text-xs text-slate-500 mt-1">Total manuscripts completed per calendar month.</p>
           </div>
           <div className="h-[300px] w-full flex-1 min-h-[300px]">
              {stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} />
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
                            <Cell key={`cell-${index}`} fill={entry.count >= 30 ? '#6366f1' : '#cbd5e1'} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                   <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm font-medium">No history data available yet.</p>
                </div>
              )}
           </div>
        </div>

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
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={30} />
                      <Tooltip 
                         cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                         content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                               return (
                                  <div className="bg-white border border-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg shadow-xl">
                                     <p className="font-bold mb-1 border-b border-slate-100 pb-1">{label}</p>
                                     <p className="flex items-center gap-2 text-sm">Avg TAT: <span className="text-amber-600 font-bold">{payload[0].value} days</span></p>
                                  </div>
                               );
                            }
                            return null;
                         }}
                      />
                      <Line type="monotone" dataKey="avgTat" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#f59e0b' }} isAnimationActive={false} />
                   </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                   <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-sm font-medium">No turnaround data available.</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {isReconModalOpen && (
         <BillingReconciliationModal 
            manuscripts={manuscripts}
            onClose={() => setIsReconModalOpen(false)}
            sortedCycles={stats.sortedCycles}
            initialCycleId={selectedCycleId}
            onBulkUpdate={onBulkUpdate}
         />
      )}
    </div>
  );
};

export default HistoryReport;
