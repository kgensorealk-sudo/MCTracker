import React from 'react';
import { Search, RefreshCcw, Calendar, Download, X, Filter } from 'lucide-react';
import { Status } from '../types';

interface ManuscriptFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  onRefresh?: () => void;
  showDateFilters: boolean;
  setShowDateFilters: (val: boolean) => void;
  filterStatus: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER';
  setFilterStatus: (val: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER') => void;
  counts: Record<string, number>;
  onExport: () => void;
  dateRange: { start: string; end: string; field: string };
  setDateRange: (val: { start: string; end: string; field: string }) => void;
}

export const ManuscriptFilters: React.FC<ManuscriptFiltersProps> = ({
  search,
  setSearch,
  onRefresh,
  showDateFilters,
  setShowDateFilters,
  filterStatus,
  setFilterStatus,
  counts,
  onExport,
  dateRange,
  setDateRange
}) => {
  return (
    <div className="border-b border-slate-200 bg-slate-50/30">
      <div className="p-5 flex flex-col xl:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full xl:w-auto items-center">
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search ID, Journal, or Status..."
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
             onClick={onRefresh}
             className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm group"
             title="Refresh List"
          >
             <RefreshCcw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
          </button>
          <button
             onClick={() => setShowDateFilters(!showDateFilters)}
             className={`p-2.5 rounded-xl border transition-all ${showDateFilters ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
             title="Filter by Date"
          >
             <Calendar className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto items-center pb-1 xl:pb-0 hide-scrollbar">
          {(['ALL', 'HANDOVER', 'UNTOUCHED', 'PENDING_GROUP', 'WORKED'] as const).map(key => {
            const statusKey = key === 'ALL' ? 'ALL' : key === 'HANDOVER' ? 'HANDOVER' : key === 'UNTOUCHED' ? Status.UNTOUCHED : key === 'WORKED' ? Status.WORKED : 'PENDING_GROUP';
            return (
              <button
                key={statusKey}
                onClick={() => setFilterStatus(statusKey)}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                  filterStatus === statusKey
                    ? 'bg-slate-800 text-white shadow-md transform scale-105'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>
                  {key === 'ALL' ? 'All' : key === 'HANDOVER' ? 'Handover List' : key === 'PENDING_GROUP' ? 'Pending' : key.charAt(0) + key.slice(1).toLowerCase()}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                   filterStatus === statusKey ? 'bg-slate-600 text-slate-100' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[key as keyof typeof counts]}
                </span>
              </button>
            );
          })}
          <div className="h-6 w-px bg-slate-200 mx-2 hidden xl:block"></div>
          <button onClick={onExport} className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 whitespace-nowrap transition-all">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {showDateFilters && (
           <div className="px-5 pb-5 flex flex-wrap gap-4 items-center animate-scale-in origin-top border-t border-slate-200 pt-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                 <Filter className="w-4 h-4 text-slate-400" />
                 <span className="text-sm text-slate-700 font-medium">Filter by:</span>
                 <select 
                    className="text-sm border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white py-1.5"
                    value={dateRange.field}
                    onChange={e => setDateRange({...dateRange, field: e.target.value})}
                 >
                    <option value="dateReceived">Date Sent (Received)</option>
                    <option value="dateStatusChanged">Status / Completed Date</option>
                    <option value="dueDate">Due Date</option>
                 </select>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-sm text-slate-500">From</span>
                 <input type="date" className="text-sm border-slate-300 rounded-lg focus:ring-blue-500 bg-white px-2 py-1.5" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-sm text-slate-500">To</span>
                 <input type="date" className="text-sm border-slate-300 rounded-lg focus:ring-blue-500 bg-white px-2 py-1.5" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
              </div>
              {(dateRange.start || dateRange.end) && (
                  <button onClick={() => setDateRange({...dateRange, start: '', end: ''})} className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                     <X className="w-3 h-3" /> Clear
                  </button>
              )}
           </div>
      )}
    </div>
  );
};
