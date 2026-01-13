
import React, { useMemo, useState, useEffect } from 'react';
import { Manuscript, Status } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { Trophy, TrendingUp, Clock, FileText, History, Search, Zap, LayoutGrid, ClipboardList, FileSearch, AlertCircle, BarChart3, Coins, DollarSign, Wallet, Settings2, ArrowUpRight, AlertTriangle, CheckCircle, FileCheck } from 'lucide-react';
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
  const [showRateSettings, setShowRateSettings] = useState(false);
  
  // Rate state matching BillingReconciliationModal for consistency
  const [usdRate, setUsdRate] = useState<number>(() => parseFloat(localStorage.getItem('billing_usd_rate') || '1.19'));
  const [phpRate, setPhpRate] = useState<number>(() => parseFloat(localStorage.getItem('billing_php_rate') || '70.41'));

  useEffect(() => {
    localStorage.setItem('billing_usd_rate', usdRate.toString());
    localStorage.setItem('billing_php_rate', phpRate.toString());
  }, [usdRate, phpRate]);

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
    const cycleGroups: Record<string, { info: CycleInfo; files: Manuscript[] }> = {};
    let totalWorked = 0;
    
    const getMonthKey = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } catch { return null; }
    };

    const formatLabel = (key: string) => {
      const [year, month] = key.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    };

    manuscripts.forEach(m => {
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
        // Deterministic Date Selection: 
        // 1. completedDate is the most accurate work timestamp.
        // 2. dateStatusChanged is used for fresh WORKED items.
        // 3. dateUpdated/Received as safety fallbacks.
        const workDate = m.completedDate || m.dateStatusChanged || m.dateUpdated || m.dateReceived;
        const monthKey = getMonthKey(workDate);
        
        if (monthKey) {
            if (!months[monthKey]) months[monthKey] = { count: 0, totalTat: 0, countWithTat: 0 };
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

        const cycle = getCycleForDate(workDate);
        if (!cycleGroups[cycle.id]) cycleGroups[cycle.id] = { info: cycle, files: [] };
        cycleGroups[cycle.id].files.push(m);
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

    const sortedCycles = Object.values(cycleGroups).sort((a, b) => b.info.id.localeCompare(a.info.id));

    const cycleChartData = [...sortedCycles].reverse().map(c => ({
      name: c.info.label.split(' (')[0],
      count: c.files.length,
      earnings: c.files.length * phpRate,
      usd: c.files.length * usdRate
    }));

    const totalEarningsPhp = totalWorked * phpRate;
    const totalEarningsUsd = totalWorked * usdRate;

    return {
      chartData,
      totalWorked,
      totalEarningsPhp,
      totalEarningsUsd,
      cycleGroups,
      sortedCycles,
      cycleChartData
    };
  }, [manuscripts, phpRate, usdRate]);

  if (stats.sortedCycles.length > 0 && !selectedCycleId) {
     setSelectedCycleId(stats.sortedCycles[0].info.id);
  }

  const selectedCycleStats = useMemo(() => {
    if (!selectedCycleId || !stats.cycleGroups[selectedCycleId]) return null;
    const files = stats.cycleGroups[selectedCycleId].files;
    const billedCount = files.filter(f => f.status === Status.BILLED).length;
    const workedCount = files.filter(f => f.status === Status.WORKED).length;
    return {
        total: files.length,
        billedCount,
        workedCount,
        percentBilled: Math.round((billedCount / files.length) * 100),
        pendingPhp: workedCount * phpRate,
        billedPhp: billedCount * phpRate
    };
  }, [selectedCycleId, stats.cycleGroups, phpRate]);

  return (
    <div className="space-y-8 animate-fade-in-up pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-indigo-600" />
            History & Reports
          </h2>
          <p className="text-slate-500 text-sm">Productivity trends, cycle analysis, and earnings history.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
             onClick={() => setShowRateSettings(!showRateSettings)}
             className={`p-2.5 rounded-xl border transition-all ${showRateSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
             title="Earnings Rates"
          >
             <Settings2 className="w-5 h-5" />
          </button>
          <button 
             onClick={() => setIsReconModalOpen(true)}
             className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
             <ClipboardList className="w-4 h-4" />
             Reconcile Billing
          </button>
        </div>
      </div>

      {/* Rate Configuration Popover */}
      {showRateSettings && (
         <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 animate-fade-in-up grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3" /> Rate Per File (USD)
              </label>
              <input 
                type="number" step="0.01" 
                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2.5 font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                value={usdRate} onChange={e => setUsdRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Coins className="w-3 h-3" /> Rate Per File (PHP)
              </label>
              <input 
                type="number" step="0.01" 
                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2.5 font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 transition-all"
                value={phpRate} onChange={e => setPhpRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="bg-white/60 p-3 rounded-xl border border-indigo-100 flex justify-between items-center h-[46px]">
               <span className="text-[10px] font-bold text-indigo-400 uppercase">Implied FX:</span>
               <span className="text-sm font-mono font-bold text-indigo-600">{(phpRate / (usdRate || 1)).toFixed(4)}</span>
            </div>
         </div>
      )}

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute right-0 top-0 p-4 opacity-10 transform rotate-12 group-hover:scale-110 transition-transform">
             <Wallet className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-bold uppercase text-xs tracking-wider mb-3">Lifetime Earnings (Est.)</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tight">₱{stats.totalEarningsPhp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-bold text-emerald-100 bg-black/10 w-fit px-3 py-1 rounded-lg backdrop-blur-sm border border-white/10">
               <DollarSign className="w-3.5 h-3.5" /> {stats.totalEarningsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="flex justify-between items-start mb-4">
              <div>
                 <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Lifetime Worked</p>
                 <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.totalWorked}</h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
                 <FileText className="w-6 h-6 text-indigo-600" />
              </div>
           </div>
           <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Monthly Potential:</span>
              <span className="text-sm font-bold text-slate-700 ml-auto flex items-center gap-1 text-emerald-600">
                 <ArrowUpRight className="w-4 h-4" /> ₱{(stats.totalEarningsPhp / Math.max(1, stats.chartData.length)).toFixed(0)}/mo
              </span>
           </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start mb-4">
              <div>
                 <p className="text-slate-400 font-bold uppercase text-xs tracking-wider">Productivity Pace</p>
                 <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats.totalWorked > 0 ? (stats.totalWorked / Math.max(1, stats.sortedCycles.length)).toFixed(1) : 0}</h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
                 <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
           </div>
           <div className="text-xs text-slate-400 font-medium">Average files per billing cycle</div>
        </div>
      </div>

      {/* Cycle Detail Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-page-enter">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileSearch className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="font-bold text-slate-800">Cycle Worked Details</h3>
                  <p className="text-xs text-slate-500 font-medium">Files handled and billing verification status</p>
               </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
               {selectedCycleStats && selectedCycleStats.workedCount > 0 && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl animate-pulse">
                     <AlertTriangle className="w-4 h-4 text-rose-500" />
                     <span className="text-xs font-bold text-rose-700">{selectedCycleStats.workedCount} items pending billing</span>
                  </div>
               )}
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
         </div>

         {selectedCycleStats && (
            <div className="px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
               <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Verification Progress</p>
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${selectedCycleStats.percentBilled}%` }}></div>
                     </div>
                     <span className="text-xs font-bold text-slate-700">{selectedCycleStats.percentBilled}%</span>
                  </div>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Confirmed Payout</p>
                  <p className="text-sm font-bold text-emerald-600">₱{selectedCycleStats.billedPhp.toLocaleString()}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Awaiting Billing</p>
                  <p className="text-sm font-bold text-rose-600">₱{selectedCycleStats.pendingPhp.toLocaleString()}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Cycle Total (Est.)</p>
                  <p className="text-sm font-black text-slate-800">₱{(selectedCycleStats.billedPhp + selectedCycleStats.pendingPhp).toLocaleString()}</p>
               </div>
            </div>
         )}
         
         <div className="overflow-x-auto max-h-[450px] custom-scrollbar">
            <table className="w-full text-sm text-center">
               <thead className="bg-slate-50/80 text-slate-500 font-bold text-[11px] uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                     <th className="px-6 py-4">Manuscript ID</th>
                     <th className="px-6 py-4">Verification</th>
                     <th className="px-6 py-4">Journal</th>
                     <th className="px-6 py-4">Completed</th>
                     <th className="px-6 py-4">Est. Payout</th>
                     <th className="px-6 py-4">Action</th>
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
                        const isBilled = m.status === Status.BILLED;
                        return (
                           <tr key={m.id} className={`transition-colors group ${isBilled ? 'hover:bg-slate-50/80' : 'bg-rose-50/20 hover:bg-rose-50/40'}`}>
                              <td className="px-6 py-4 font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.manuscriptId}</td>
                              <td className="px-6 py-4 text-center">
                                 {isBilled ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-tight">
                                       <CheckCircle className="w-3 h-3" /> Billed
                                    </span>
                                 ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 uppercase tracking-tight animate-pulse">
                                       <AlertTriangle className="w-3 h-3" /> Worked
                                    </span>
                                 )}
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-mono text-[11px] uppercase tracking-tighter">{m.journalCode}</td>
                              <td className="px-6 py-4">
                                 <span className="text-slate-600 font-bold bg-slate-50 px-2 py-0.5 rounded">
                                    {new Date(m.completedDate || m.dateStatusChanged || '').toLocaleDateString()}
                                 </span>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-col items-center">
                                    <span className={`text-sm font-bold ${isBilled ? 'text-emerald-600' : 'text-slate-400'}`}>₱{phpRate.toFixed(2)}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">${usdRate.toFixed(2)}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 {!isBilled && (
                                    <button 
                                       onClick={() => onBulkUpdate([m.id], { status: Status.BILLED })}
                                       className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                                       title="Quick Mark as Billed"
                                    >
                                       <FileCheck className="w-4 h-4" />
                                    </button>
                                 )}
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Cycle Performance & Earnings Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Output Volume Graph */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" /> Cycle Volume
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Number of files per cycle</p>
                </div>
            </div>
            <div className="h-[280px] w-full">
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
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} height={40} angle={-5} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
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
                            <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#cycleGradient)" maxBarSize={50} isAnimationActive={false}>
                              {stats.cycleChartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fillOpacity={0.8 + (index / stats.cycleChartData.length) * 0.2} />
                              ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm font-medium">Insufficient cycle history.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Earnings Trend Graph */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" /> Earnings History
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Estimated PHP payout per cycle</p>
                </div>
            </div>
            <div className="h-[280px] w-full">
                {stats.cycleChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.cycleChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="earnGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} height={40} angle={-5} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} hide />
                            <Tooltip 
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xl text-xs">
                                                <p className="font-bold mb-2 text-slate-500 border-b border-slate-100 pb-1">{label}</p>
                                                <p className="text-lg font-black text-emerald-600">₱{payload[0].value?.toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">${(payload[0].value / phpRate * usdRate).toFixed(2)} USD</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#earnGradient)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm font-medium">Add worked files to see earnings chart.</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Monthly Statistics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
           <div className="flex flex-col mb-6">
              <div className="flex items-center justify-between">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Monthly Volume
                 </h3>
                 <div className="px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Output Metric
                 </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Total manuscripts completed per calendar month.</p>
           </div>
           <div className="h-[250px] w-full">
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
                    <Clock className="w-5 h-5 text-amber-500" /> Efficiency Metric
                 </h3>
                 <div className="px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Speed Metric
                 </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Average days taken to complete a file.</p>
           </div>
           <div className="h-[250px] w-full">
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
