import React, { useState, useEffect, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { Search, Edit2, AlertCircle, CheckCircle, Clock, Download, Trash2, Inbox, AlertTriangle, Mail, CheckSquare, X, ListChecks, Calendar, Filter, MessageSquare, Send, FileCheck, ArrowUpDown, ArrowUp, ArrowDown, Zap, ChevronRight, Timer, RefreshCcw } from 'lucide-react';

interface ManuscriptListProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Manuscript>) => void;
  onBulkReview?: (ids: string[]) => void; 
  onRefresh?: () => void;
  activeFilter: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER';
}

type SortKey = 'status' | 'manuscriptId' | 'dateReceived' | 'priority' | 'statusDate';
type SortDirection = 'asc' | 'desc' | null;

const ManuscriptList: React.FC<ManuscriptListProps> = ({ manuscripts, onEdit, onDelete, onUpdate, onBulkUpdate, onBulkReview, onRefresh, activeFilter }) => {
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER'>(activeFilter);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ 
    start: '', 
    end: '', 
    field: 'dateReceived' 
  });

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'statusDate',
    direction: 'desc'
  });

  // Query Modal State
  const [queryModal, setQueryModal] = useState<{isOpen: boolean, manuscript: Manuscript | null}>({ isOpen: false, manuscript: null });
  const [queryNote, setQueryNote] = useState('');
  const [isQueryModalClosing, setIsQueryModalClosing] = useState(false);

  useEffect(() => {
    setFilterStatus(activeFilter);
    setSelectedIds(new Set()); 
  }, [activeFilter]);

  const pendingCount = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status)).length;
  const handoverCount = manuscripts.filter(m => m.status === Status.WORKED || m.status === Status.PENDING_JM).length;
  
  const counts = {
    ALL: manuscripts.length,
    UNTOUCHED: manuscripts.filter(m => m.status === Status.UNTOUCHED).length,
    PENDING_GROUP: pendingCount,
    WORKED: manuscripts.filter(m => m.status === Status.WORKED).length,
    HANDOVER: handoverCount
  };

  const statusWeight: Record<Status, number> = {
    [Status.BILLED]: 5,
    [Status.WORKED]: 4,
    [Status.PENDING_CED]: 3,
    [Status.PENDING_TL]: 2,
    [Status.PENDING_JM]: 1,
    [Status.UNTOUCHED]: 0
  };

  const priorityWeight = {
    'Urgent': 3,
    'High': 2,
    'Normal': 1
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    let result = manuscripts.filter(m => {
      let matchesStatus = false;
      if (filterStatus === 'ALL') matchesStatus = true;
      else if (filterStatus === 'PENDING_GROUP') {
        matchesStatus = [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
      } else if (filterStatus === 'HANDOVER') {
        matchesStatus = m.status === Status.WORKED || m.status === Status.PENDING_JM;
      } else {
        matchesStatus = m.status === filterStatus;
      }

      const statusLabel = m.status.toLowerCase().replace(/_/g, ' ');
      const matchesSearch = 
        m.manuscriptId.toLowerCase().includes(search.toLowerCase()) || 
        m.journalCode.toLowerCase().includes(search.toLowerCase()) ||
        statusLabel.includes(search.toLowerCase());

      const matchesDate = (() => {
        if (!dateRange.start && !dateRange.end) return true;
        let dateValue: string | undefined;
        if (dateRange.field === 'dateStatusChanged') {
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

    if (sortConfig.direction) {
      result.sort((a, b) => {
        let valA: any;
        let valB: any;
        switch (sortConfig.key) {
          case 'status':
            valA = statusWeight[a.status];
            valB = statusWeight[b.status];
            break;
          case 'manuscriptId':
            valA = a.manuscriptId.toLowerCase();
            valB = b.manuscriptId.toLowerCase();
            break;
          case 'priority':
            valA = priorityWeight[a.priority] || 0;
            valB = priorityWeight[b.priority] || 0;
            break;
          case 'statusDate':
            valA = new Date((a.status === Status.WORKED && a.completedDate) ? a.completedDate : (a.dateStatusChanged || a.dateUpdated)).getTime();
            valB = new Date((b.status === Status.WORKED && b.completedDate) ? b.completedDate : (b.dateStatusChanged || b.dateUpdated)).getTime();
            break;
          default:
            valA = new Date(a[sortConfig.key as keyof Manuscript] as string || 0).getTime();
            valB = new Date(b[sortConfig.key as keyof Manuscript] as string || 0).getTime();
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [manuscripts, filterStatus, search, dateRange, sortConfig]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length && filteredAndSorted.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(m => m.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleDirectBulkStatusChange = (status: Status) => {
    if (window.confirm(`Are you sure you want to mark ${selectedIds.size} items as ${status}?`)) {
      onBulkUpdate(Array.from(selectedIds), { status });
      setSelectedIds(new Set());
    }
  };

  const handleReviewBulk = () => {
    if (onBulkReview) {
      onBulkReview(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleQuickStatusUpdate = (m: Manuscript, newStatus: Status) => {
    const now = new Date().toISOString();
    const updates: Partial<Manuscript> = {
      status: newStatus,
      dateStatusChanged: now,
      dateUpdated: now,
    };
    if (newStatus === Status.WORKED) updates.completedDate = now;
    onUpdate(m.id, updates);
  };

  const handleQuickAction = (m: Manuscript, action: 'WORKED' | 'QUERY_JM') => {
    if (action === 'QUERY_JM') {
      setQueryModal({ isOpen: true, manuscript: m });
      setQueryNote(''); 
      return;
    }
    if (action === 'WORKED') {
      const isConfirmed = window.confirm(`Are you sure you want to mark ${m.manuscriptId} as WORKED?`);
      if (!isConfirmed) return;
    }
    handleQuickStatusUpdate(m, Status.WORKED);
  };

  const handleSendEmail = (m: Manuscript) => {
    let recipient = '';
    let subject = '';
    let body = '';
    const lastNote = m.notes[0]?.content || "N/A";
    switch(m.status) {
      case Status.PENDING_JM:
        recipient = 'JM_CONTACT@publisher.com';
        subject = `Query: ${m.manuscriptId} - ${m.journalCode}`;
        body = `Hi JM Team,\n\nRegarding manuscript ${m.manuscriptId} (${m.journalCode}), I have a query:\n\n${lastNote}\n\nPlease let me know how to proceed.\n\nRegards,\nAnalyst`;
        break;
      case Status.PENDING_TL:
        recipient = 'TL_CONTACT@publisher.com';
        subject = `TL Assistance Required: ${m.manuscriptId}`;
        body = `Hi Team,\n\nI need TL assistance for ${m.manuscriptId}.\n\nContext:\n${lastNote}\n\nThanks!`;
        break;
      case Status.PENDING_CED:
        recipient = 'CED_CONTACT@publisher.com';
        subject = `Urgent Escalation: ${m.manuscriptId}`;
        body = `Hi CED,\n\nEscalating manuscript ${m.manuscriptId} for status review.\n\nPriority: ${m.priority}\nLast Note: ${lastNote}\n\nBest,`;
        break;
      default:
        recipient = '';
        subject = `Follow-up: ${m.manuscriptId}`;
        body = `Hi,\n\nChecking in on the status of ${m.manuscriptId}.\n\nThanks.`;
    }
    const mailtoUrl = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    onUpdate(m.id, { dateEmailed: new Date().toISOString() });
  };

  const handleCloseQueryModal = () => {
    setIsQueryModalClosing(true);
    setTimeout(() => {
        setQueryModal({ isOpen: false, manuscript: null });
        setIsQueryModalClosing(false);
    }, 200);
  };

  const handleSubmitQuery = () => {
    if (!queryModal.manuscript) return;
    const now = new Date().toISOString();
    const noteContent = queryNote.trim() ? queryNote : "JM Query Raised";
    const updates: Partial<Manuscript> = {
      status: Status.PENDING_JM,
      dateStatusChanged: now,
      dateUpdated: now,
      dateQueried: now, 
      notes: [
        { id: crypto.randomUUID(), content: noteContent, timestamp: Date.now() },
        ...(queryModal.manuscript.notes || [])
      ]
    };
    setIsQueryModalClosing(true);
    setTimeout(() => {
        onUpdate(queryModal.manuscript!.id, updates);
        setQueryModal({ isOpen: false, manuscript: null });
        setQueryNote('');
        setIsQueryModalClosing(false);
    }, 200);
  };

  const downloadCSV = () => {
    const headers = ['Manuscript ID', 'Journal', 'Date Sent', 'Due Date', 'Status', 'Status Date', 'Submitted Date', 'Priority', 'Remarks'];
    const rows = filteredAndSorted.map(m => {
      const notesContent = m.notes.map(n => `[${new Date(n.timestamp).toLocaleDateString()}] ${n.content}`).join('; ');
      let submittedDate = '';
      if (m.status === Status.WORKED || m.status === Status.BILLED) {
          const rawDate = m.completedDate || m.dateStatusChanged || m.dateUpdated;
          submittedDate = new Date(rawDate).toLocaleDateString();
      }
      const statusDateRaw = m.dateStatusChanged || m.dateUpdated;
      const statusDate = new Date(statusDateRaw).toLocaleDateString();
      return [
        m.manuscriptId, m.journalCode, new Date(m.dateReceived).toLocaleDateString(),
        m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '',
        m.status, statusDate, submittedDate, m.priority,
        `"${notesContent.replace(/"/g, '""')}"`
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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

  const getStatusHub = (m: Manuscript) => {
    const status = m.status;
    const dateChanged = new Date(m.dateStatusChanged || m.dateUpdated);
    const ageHours = (new Date().getTime() - dateChanged.getTime()) / (1000 * 3600);
    const isCongested = ageHours > 24 && status !== Status.WORKED && status !== Status.BILLED;

    const config = {
      [Status.WORKED]: { label: 'Worked', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'emerald' },
      [Status.BILLED]: { label: 'Billed', icon: <FileCheck className="w-3.5 h-3.5" />, color: 'indigo' },
      [Status.UNTOUCHED]: { label: 'Untouched', icon: <Inbox className="w-3.5 h-3.5" />, color: 'slate' },
      [Status.PENDING_JM]: { label: 'JM Query', icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'rose' },
      [Status.PENDING_TL]: { label: 'TL Query', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'amber' },
      [Status.PENDING_CED]: { label: 'Email CED', icon: <Mail className="w-3.5 h-3.5" />, color: 'violet' },
    };

    const current = config[status] || { label: status, icon: <Clock className="w-3.5 h-3.5" />, color: 'gray' };

    return (
      <div className="relative group/hub">
        {/* Main Badge */}
        <div className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black border shadow-sm transition-all duration-300 cursor-default whitespace-nowrap
          ${isCongested ? 'animate-pulse ring-2 ring-rose-200' : ''}
          ${current.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
          ${current.color === 'indigo' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : ''}
          ${current.color === 'slate' ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
          ${current.color === 'rose' ? 'bg-rose-50 text-rose-700 border-rose-100' : ''}
          ${current.color === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
          ${current.color === 'violet' ? 'bg-violet-50 text-violet-700 border-violet-100' : ''}
        `}>
          {isCongested ? <Zap className="w-3.5 h-3.5 text-rose-600" /> : current.icon}
          {isCongested ? `Congested: ${current.label}` : current.label}
        </div>

        {/* Hover Quick Switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 opacity-0 group-hover/hub:opacity-100 pointer-events-none group-hover/hub:pointer-events-auto transition-all duration-300 z-20 flex bg-white border border-slate-200 rounded-full p-1 shadow-xl translate-y-2 group-hover/hub:translate-y-0">
          {(Object.entries(config) as [Status, any][]).map(([s, cfg]) => (
            <button
              key={s}
              onClick={() => handleQuickStatusUpdate(m, s)}
              className={`p-1.5 rounded-full transition-colors hover:scale-110 active:scale-95 ${m.status === s ? 'bg-slate-100 text-slate-900' : `text-${cfg.color}-600 hover:bg-${cfg.color}-50`}`}
              title={`Switch to ${cfg.label}`}
            >
              {cfg.icon}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const isTodayDate = (dateString?: string) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  const isActivityToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3 h-3 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="w-3 h-3 text-blue-600" />;
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative animate-fade-in-up">
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl px-6 py-4 shadow-2xl z-50 flex items-center gap-5 animate-fade-in-up border border-white/10 ring-1 ring-black/20">
           <span className="font-bold text-sm whitespace-nowrap px-3 bg-white/10 rounded-lg py-1.5">{selectedIds.size} selected</span>
           <div className="h-6 w-px bg-white/20"></div>
           <button onClick={handleReviewBulk} className="flex items-center gap-2 hover:text-emerald-300 transition-colors text-sm font-semibold">
             <ListChecks className="w-5 h-5" /> Review Items
           </button>
           <div className="h-6 w-px bg-white/20"></div>
           <button onClick={() => handleDirectBulkStatusChange(Status.BILLED)} className="flex items-center gap-2 hover:text-indigo-300 transition-colors text-sm font-semibold">
             <FileCheck className="w-5 h-5" /> Mark Billed
           </button>
           <div className="h-6 w-px bg-white/20"></div>
           <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full">
             <X className="w-5 h-5" />
           </button>
        </div>
      )}

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
            <button onClick={downloadCSV} className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 whitespace-nowrap transition-all">
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

      <div className="overflow-x-auto min-h-[400px]">
        {filterStatus === 'HANDOVER' && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
             <FileCheck className="w-5 h-5 text-indigo-600" />
             <p className="text-sm text-indigo-800 font-medium">
               Handover View: <span className="font-bold">Worked (Ready)</span> and <span className="font-bold text-rose-700">JM Queries</span>.
             </p>
          </div>
        )}
        <table className="w-full text-center text-sm text-slate-600">
          <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 w-10 text-center">
                <input type="checkbox" checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length} onChange={handleSelectAll} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors" />
              </th>
              <th className="px-6 py-4 text-center">Interactive Status</th>
              <th 
                className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                onClick={() => handleSort('statusDate')}
              >
                <div className="flex items-center justify-center gap-1">
                  Timeline {renderSortIcon('statusDate')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                onClick={() => handleSort('manuscriptId')}
              >
                <div className="flex items-center justify-center gap-1">
                  ID / Journal {renderSortIcon('manuscriptId')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                onClick={() => handleSort('dateReceived')}
              >
                <div className="flex items-center justify-center gap-1">
                  Date Sent {renderSortIcon('dateReceived')}
                </div>
              </th>
              <th className="px-6 py-4 text-center">Due Date</th>
              <th 
                className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center justify-center gap-1">
                  Priority {renderSortIcon('priority')}
                </div>
              </th>
              <th className="px-6 py-4 min-w-[200px] text-center">Remarks</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-24 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="w-12 h-12 text-slate-200" />
                    <p>{search ? 'No matches found.' : 'Empty queue.'}</p>
                  </div>
                </td>
              </tr>
            )}
            {filteredAndSorted.map((m) => {
               const displayDateRaw = (m.status === Status.WORKED || m.status === Status.BILLED) && m.completedDate ? m.completedDate : (m.dateStatusChanged || m.dateUpdated);
               const dateObj = new Date(displayDateRaw);
               const isActivityTodayFlag = isActivityToday(dateObj);
               
               // Rule: Don't show "Due Today" badge if already Worked or Billed
               const isDueToday = isTodayDate(m.dueDate) && (m.status !== Status.WORKED && m.status !== Status.BILLED);
               
               const isSelected = selectedIds.has(m.id);
               
               // Query Duration logic
               const ageInDays = Math.floor((new Date().getTime() - dateObj.getTime()) / (1000 * 3600 * 24));

               return (
                <tr key={m.id} className={`group transition-all duration-200 ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'} ${m.status === Status.PENDING_JM ? 'bg-rose-50/10' : ''}`}>
                  <td className="px-6 py-4 text-center">
                    <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(m.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center">
                      {getStatusHub(m)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-[10px] font-bold ${isActivityTodayFlag ? 'text-blue-600' : 'text-slate-500'}`}>
                        {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {[Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && (
                        <div className="flex items-center gap-1 text-[9px] text-rose-500 font-black mt-1 uppercase tracking-tighter">
                          <Timer className="w-2.5 h-2.5" /> {ageInDays === 0 ? 'Today' : `${ageInDays}d ago`}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col gap-0.5 items-center">
                      <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{m.manuscriptId}</span>
                      <span className="text-slate-400 text-[10px] font-mono">{m.journalCode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-700">{new Date(m.dateReceived).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm ${isDueToday ? 'font-black text-rose-600' : 'text-slate-700'}`}>
                        {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}
                      </span>
                      {isDueToday && (
                        <span className="text-[9px] font-black text-white bg-rose-600 px-1.5 py-0.5 rounded uppercase leading-none tracking-widest animate-pulse">Due Today</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <select
                      value={m.priority}
                      onChange={(e) => onUpdate(m.id, { priority: e.target.value as any })}
                      className={`block w-full text-[10px] font-black px-2 py-1 rounded-lg border appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center ${
                        m.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                        m.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                        'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <option value="Normal">NORMAL</option>
                      <option value="High">HIGH</option>
                      <option value="Urgent">URGENT</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col gap-1.5 items-center">
                      {m.notes.slice(0, 1).map((note) => (
                        <div key={note.id} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 w-full max-w-[180px]">
                          <div className="text-[11px] text-slate-600 line-clamp-2 text-center">{note.content}</div>
                        </div>
                      ))}
                      {m.notes.length === 0 && <span className="text-[10px] text-slate-300 italic">No remarks</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <div className="flex justify-center items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      {m.status !== Status.WORKED && m.status !== Status.BILLED && (
                        <>
                          <button onClick={() => handleSendEmail(m)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all" title="Email Query"><Send className="w-4 h-4" /></button>
                          {m.status !== Status.PENDING_JM && (
                            <button onClick={() => handleQuickAction(m, 'QUERY_JM')} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all" title="Query JM"><AlertCircle className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => handleQuickAction(m, 'WORKED')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all" title="Resolve"><CheckSquare className="w-4 h-4" /></button>
                        </>
                      )}
                      <button onClick={() => onEdit(m)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(m.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
               );
            })}
          </tbody>
        </table>
      </div>

      {queryModal.isOpen && queryModal.manuscript && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md ${isQueryModalClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
          <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 ${isQueryModalClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
             <div className="bg-rose-50 p-4 border-b border-rose-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <div className="p-2 bg-rose-100 rounded-full">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                   </div>
                   <div>
                      <h3 className="font-bold text-rose-900">Query to JM</h3>
                      <p className="text-xs text-rose-700">{queryModal.manuscript.manuscriptId}</p>
                   </div>
                </div>
                <button onClick={handleCloseQueryModal} className="p-1 hover:bg-rose-200 rounded-full text-rose-400 hover:text-rose-700 transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             <div className="p-6 text-center">
                <label className="block text-sm font-bold text-slate-700 mb-2">Query Details</label>
                <div className="relative">
                  <MessageSquare className="absolute top-3 left-3 w-4 h-4 text-slate-400" />
                  <textarea
                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-100 transition-all text-sm min-h-[100px] resize-none text-center"
                     placeholder="State the issue clearly..."
                     value={queryNote}
                     onChange={(e) => setQueryNote(e.target.value)}
                     autoFocus
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">This moves status to PENDING_JM</p>
             </div>
             <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                <button onClick={handleCloseQueryModal} className="px-4 py-2 text-slate-600 hover:bg-white rounded-xl text-sm font-medium">Cancel</button>
                <button onClick={handleSubmitQuery} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"><Send className="w-4 h-4" /> Raise Query</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManuscriptList;