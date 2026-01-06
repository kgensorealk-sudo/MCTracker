import React, { useState, useEffect } from 'react';
import { Manuscript, Status } from '../types';
import { Search, Edit2, AlertCircle, CheckCircle, Clock, Download, Trash2, Inbox, AlertTriangle, Mail, CheckSquare, X, ListChecks, Calendar, Filter } from 'lucide-react';

interface ManuscriptListProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Manuscript>) => void;
  onBulkReview?: (ids: string[]) => void; // New optional prop for review mode
  activeFilter: Status | 'ALL' | 'PENDING_GROUP';
}

const ManuscriptList: React.FC<ManuscriptListProps> = ({ manuscripts, onEdit, onDelete, onUpdate, onBulkUpdate, onBulkReview, activeFilter }) => {
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL' | 'PENDING_GROUP'>(activeFilter);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Date Filtering State
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    start: '', 
    end: '', 
    field: 'dateReceived' // Default to Date Sent
  });

  useEffect(() => {
    setFilterStatus(activeFilter);
    setSelectedIds(new Set()); // Reset selection on filter change
  }, [activeFilter]);

  // Compute counts for the tabs
  const pendingCount = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;
  const counts = {
    ALL: manuscripts.length,
    UNTOUCHED: manuscripts.filter(m => m.status === Status.UNTOUCHED).length,
    PENDING_GROUP: pendingCount,
    WORKED: manuscripts.filter(m => m.status === Status.WORKED).length,
  };

  const filtered = manuscripts.filter(m => {
    // 1. Status Filter
    let matchesStatus = false;
    if (filterStatus === 'ALL') matchesStatus = true;
    else if (filterStatus === 'PENDING_GROUP') {
      matchesStatus = [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
    } else {
      matchesStatus = m.status === filterStatus;
    }

    // 2. Search Filter
    const matchesSearch = 
      m.manuscriptId.toLowerCase().includes(search.toLowerCase()) || 
      m.journalCode.toLowerCase().includes(search.toLowerCase());

    // 3. Date Filter
    const matchesDate = (() => {
      if (!dateRange.start && !dateRange.end) return true;
      
      let dateValue: string | undefined;
      
      if (dateRange.field === 'dateStatusChanged') {
           // For Worked items, we prioritize completedDate. For others, status changed date.
           dateValue = (m.status === Status.WORKED && m.completedDate) 
             ? m.completedDate 
             : (m.dateStatusChanged || m.dateUpdated);
      } else if (dateRange.field === 'dueDate') {
           dateValue = m.dueDate;
      } else {
           dateValue = m.dateReceived;
      }
      
      if (!dateValue) return false;
      
      const itemTime = new Date(dateValue).getTime();
      if (isNaN(itemTime)) return false;
      
      const startTime = dateRange.start ? new Date(dateRange.start).setHours(0,0,0,0) : -Infinity;
      const endTime = dateRange.end ? new Date(dateRange.end).setHours(23,59,59,999) : Infinity;
      
      return itemTime >= startTime && itemTime <= endTime;
    })();

    return matchesStatus && matchesSearch && matchesDate;
  });

  // --- Selection Logic ---
  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Direct Update (no modal)
  const handleDirectBulkStatusChange = (status: Status) => {
    if (window.confirm(`Are you sure you want to mark ${selectedIds.size} items as ${status}?`)) {
      onBulkUpdate(Array.from(selectedIds), { status });
      setSelectedIds(new Set());
    }
  };

  // Interactive Review Mode
  const handleReviewBulk = () => {
    if (onBulkReview) {
      onBulkReview(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // --- Quick Action Handlers ---
  const handleQuickAction = (m: Manuscript, action: 'WORKED' | 'QUERY_JM') => {
    const now = new Date().toISOString();
    const updates: Partial<Manuscript> = {
      dateStatusChanged: now,
      dateUpdated: now
    };

    if (action === 'WORKED') {
      updates.status = Status.WORKED;
      updates.completedDate = now;

      // Add Note Logic
      const noteContent = m.status === Status.PENDING_JM ? "Resolved" : "Done";
      const newNote = {
        id: crypto.randomUUID(),
        content: noteContent,
        timestamp: Date.now()
      };
      updates.notes = [newNote, ...(m.notes || [])];

    } else if (action === 'QUERY_JM') {
      updates.status = Status.PENDING_JM;
    }

    onUpdate(m.id, updates);
  };

  const downloadCSV = () => {
    const headers = ['Manuscript ID', 'Journal', 'Date Sent', 'Due Date', 'Status', 'Status Date', 'Submitted Date', 'Priority', 'Remarks'];
    const rows = filtered.map(m => {
      // Concatenate all notes for CSV
      const notesContent = m.notes
        .map(n => `[${new Date(n.timestamp).toLocaleDateString()}] ${n.content}`)
        .join('; ');

      // Logic for Submitted Date: Only show if WORKED
      let submittedDate = '';
      if (m.status === Status.WORKED) {
          const rawDate = m.completedDate || m.dateStatusChanged || m.dateUpdated;
          submittedDate = new Date(rawDate).toLocaleDateString();
      }
      
      const statusDateRaw = m.dateStatusChanged || m.dateUpdated;
      const statusDate = new Date(statusDateRaw).toLocaleDateString();

      return [
        m.manuscriptId,
        m.journalCode,
        new Date(m.dateReceived).toLocaleDateString(),
        m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '',
        m.status,
        statusDate,
        submittedDate,
        m.priority,
        `"${notesContent.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `manuscripts_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusBadge = (status: Status) => {
    switch (status) {
      case Status.WORKED:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle className="w-3.5 h-3.5" /> Worked</span>;
      case Status.UNTOUCHED:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200"><Inbox className="w-3.5 h-3.5" /> Untouched</span>;
      case Status.PENDING_JM:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100"><AlertCircle className="w-3.5 h-3.5" /> JM Query</span>;
      case Status.PENDING_TL:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100"><AlertTriangle className="w-3.5 h-3.5" /> TL Query</span>;
      case Status.PENDING_CED:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-100"><Mail className="w-3.5 h-3.5" /> Email CED</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">Unknown</span>;
    }
  };

  // Helper to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative animate-fade-in-up">
      {/* Bulk Action Bar (Fixed at bottom) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl px-6 py-3 shadow-2xl z-50 flex items-center gap-4 animate-fade-in-up border border-slate-700">
           <span className="font-bold text-sm whitespace-nowrap px-2 bg-slate-800 rounded-lg py-1">{selectedIds.size} selected</span>
           <div className="h-4 w-px bg-slate-700"></div>
           
           {/* Primary Action: Review & Work */}
           <button 
             onClick={handleReviewBulk}
             className="flex items-center gap-2 hover:text-emerald-400 transition-colors text-sm font-medium"
             title="Open selected items one by one to mark as worked"
           >
             <ListChecks className="w-4 h-4" /> Review & Mark Worked
           </button>

           <div className="h-4 w-px bg-slate-700"></div>

           <button 
             onClick={() => handleDirectBulkStatusChange(Status.PENDING_JM)}
             className="flex items-center gap-2 hover:text-rose-400 transition-colors text-sm font-medium"
           >
             <AlertCircle className="w-4 h-4" /> JM Query
           </button>
           <div className="h-4 w-px bg-slate-700"></div>
           <button 
             onClick={() => setSelectedIds(new Set())}
             className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-full"
           >
             <X className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50/50">
        <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-center">
          <div className="flex gap-2 w-full xl:w-auto items-center">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search ID, Journal code..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
               onClick={() => setShowDateFilters(!showDateFilters)}
               className={`p-2.5 rounded-xl border transition-all ${showDateFilters ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-inner' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'}`}
               title="Filter by Date"
            >
               <Calendar className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex gap-2 w-full xl:w-auto overflow-x-auto items-center pb-1 xl:pb-0 hide-scrollbar">
            {(['ALL', 'UNTOUCHED', 'PENDING_GROUP', 'WORKED'] as const).map(key => {
              const statusKey = key === 'ALL' ? 'ALL' : key === 'UNTOUCHED' ? Status.UNTOUCHED : key === 'WORKED' ? Status.WORKED : 'PENDING_GROUP';
              
              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(statusKey)}
                  className={`px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                    filterStatus === statusKey
                      ? 'bg-slate-900 text-white shadow-md transform scale-105'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>
                    {key === 'ALL' ? 'All Files' : 
                     key === 'PENDING_GROUP' ? 'Pending / Queries' : 
                     key.charAt(0) + key.slice(1).toLowerCase()}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                     filterStatus === statusKey 
                      ? 'bg-slate-700 text-slate-100' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {counts[key as keyof typeof counts]}
                  </span>
                </button>
              );
            })}
            <div className="h-6 w-px bg-slate-200 mx-2 hidden xl:block"></div>
            <button
              onClick={downloadCSV}
              className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 whitespace-nowrap transition-all"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Date Filter Section */}
        {showDateFilters && (
             <div className="px-4 pb-4 flex flex-wrap gap-4 items-center animate-scale-in origin-top border-t border-slate-200 pt-4 bg-slate-50">
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
                   <input 
                      type="date" 
                      className="text-sm border-slate-300 rounded-lg focus:ring-blue-500 bg-white px-2 py-1.5"
                      value={dateRange.start}
                      onChange={e => setDateRange({...dateRange, start: e.target.value})}
                   />
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-sm text-slate-500">To</span>
                   <input 
                      type="date" 
                      className="text-sm border-slate-300 rounded-lg focus:ring-blue-500 bg-white px-2 py-1.5"
                      value={dateRange.end}
                      onChange={e => setDateRange({...dateRange, end: e.target.value})}
                   />
                </div>
                {(dateRange.start || dateRange.end) && (
                    <button 
                       onClick={() => setDateRange({...dateRange, start: '', end: ''})}
                       className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                       <X className="w-3 h-3" /> Clear
                    </button>
                )}
             </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors"
                />
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Status Date</th>
              <th className="px-4 py-3">ID / Journal</th>
              <th className="px-4 py-3">Date Sent</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3 min-w-[200px]">Remarks</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-24 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-slate-200" />
                    <p>No manuscripts found matching your criteria.</p>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((m) => {
               const displayDateRaw = m.status === Status.WORKED && m.completedDate 
                 ? m.completedDate 
                 : (m.dateStatusChanged || m.dateUpdated);
               const dateObj = new Date(displayDateRaw);
               const displayDate = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
               const isActivityToday = isToday(dateObj);
               const isSelected = selectedIds.has(m.id);

               return (
                <tr key={m.id} className={`group transition-colors duration-200 ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => handleSelectOne(m.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(m.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs ${isActivityToday ? 'text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full' : 'text-slate-500'}`}>
                      {displayDate}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{m.manuscriptId}</span>
                      </div>
                      <div className="text-slate-400 text-xs font-mono">{m.journalCode}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                     <div className="text-slate-700">{new Date(m.dateReceived).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                     <div className={`text-slate-700 ${!m.dueDate ? 'text-slate-400 italic' : ''}`}>
                       {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'None'}
                     </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={m.priority}
                      onChange={(e) => onUpdate(m.id, { priority: e.target.value as any })}
                      className={`block w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        m.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 
                        m.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100' : 
                        'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      
                      {m.notes.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {m.notes.map((note) => (
                            <div key={note.id} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                              <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{note.content}</div>
                              <div className="text-[10px] text-slate-400 mt-1 text-right flex justify-end items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(note.timestamp).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">No remarks</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      
                      {/* Quick Action Buttons */}
                      {m.status !== Status.WORKED && (
                        <>
                          {/* Query Button - Only show for Untouched or other Pending types that aren't JM yet */}
                          {m.status !== Status.PENDING_JM && (
                            <button
                              onClick={() => handleQuickAction(m, 'QUERY_JM')}
                              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-all shadow-sm hover:shadow"
                              title="Query to JM"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Mark Worked Button */}
                          <button
                            onClick={() => handleQuickAction(m, 'WORKED')}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-all shadow-sm hover:shadow"
                            title={m.status === Status.PENDING_JM ? "Mark Resolved" : "Mark Done"}
                          >
                            <CheckSquare className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button 
                        onClick={() => onEdit(m)}
                        className="p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-all"
                        title="Edit Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => onDelete(m.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManuscriptList;