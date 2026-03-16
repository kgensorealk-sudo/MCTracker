import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Manuscript, Status } from '../types';
import { useManuscriptList } from '../hooks/useManuscriptList';
import { Search, Edit2, AlertCircle, CheckCircle, Trash2, Inbox, AlertTriangle, Mail, CheckSquare, X, ChevronDown, ChevronUp, History, PlayCircle, Square, CheckSquare as CheckSquareIcon, FileText, RefreshCcw, Copy, Check } from 'lucide-react';

interface ManuscriptListProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Manuscript>) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkReview: (ids: string[]) => void;
  activeFilter: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER';
}

const ManuscriptList: React.FC<ManuscriptListProps> = ({ 
  manuscripts, onEdit, onDelete, onUpdate, onBulkUpdate, onBulkDelete, onBulkReview, activeFilter 
}) => {
  const {
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filteredManuscripts: filtered,
  } = useManuscriptList(manuscripts, activeFilter);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal State
  const [queryModal, setQueryModal] = useState<{
    isOpen: boolean, 
    manuscript: Manuscript | null,
    flags: { jm: boolean, tl: boolean, ced: boolean }
  }>({ 
    isOpen: false, 
    manuscript: null,
    flags: { jm: false, tl: false, ced: false }
  });
  const [queryNote, setQueryNote] = useState('');
  
  const [quickUpdateModal, setQuickUpdateModal] = useState<{
    isOpen: boolean, 
    manuscript: Manuscript | null, 
    targetStatus: Status | null
  }>({ isOpen: false, manuscript: null, targetStatus: null });
  const [quickNote, setQuickNote] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => setFilterStatus(activeFilter), [activeFilter, setFilterStatus]);

  const filteredWithDates = useMemo(() => {
    return filtered.filter(m => {
      let matchesDate = true;
      if (startDate || endDate) {
        const itemDate = new Date(m.dateStatusChanged || m.dateUpdated || m.dateReceived);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) matchesDate = false;
        }
      }
      return matchesDate;
    });
  }, [filtered, startDate, endDate]);

  const getSlaInfo = (m: Manuscript) => {
    if (m.status === Status.WORKED || m.status === Status.BILLED || !m.dueDate) return null;
    const due = new Date(m.dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const hours = diff / (1000 * 3600);
    
    if (hours < 0) return { label: 'Overdue', color: 'text-rose-600 bg-rose-50', pulse: true };
    if (hours < 24) return { label: 'Due Soon', color: 'text-amber-600 bg-amber-50', pulse: true };
    return null;
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredWithDates.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredWithDates.map(f => f.id)));
  };

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkAction = (action: 'billed' | 'worked' | 'delete' | 'review') => {
    const ids = Array.from(selectedIds);
    if (action === 'billed') onBulkUpdate(ids, { status: Status.BILLED });
    else if (action === 'worked') onBulkUpdate(ids, { status: Status.WORKED, completedDate: new Date().toISOString() });
    else if (action === 'delete') onBulkDelete(ids);
    else if (action === 'review') onBulkReview(ids);
    
    if (action !== 'review') setSelectedIds(new Set());
  };

  const getStatusBadge = (m: Manuscript) => {
    const status = m.status;
    const isPending = [Status.PENDING, Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(status);
    
    const config = {
      [Status.WORKED]: { label: 'Worked', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      [Status.PENDING]: { label: 'Pending', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
      [Status.PENDING_JM]: { label: 'JM Query', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-rose-50 text-rose-700 border-rose-200' },
      [Status.UNTOUCHED]: { label: 'Untouched', icon: <Inbox className="w-3 h-3" />, color: 'bg-slate-100 text-slate-600 border-slate-200' },
      [Status.PENDING_TL]: { label: 'TL Query', icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
      [Status.PENDING_CED]: { label: 'Email CED', icon: <Mail className="w-3 h-3" />, color: 'bg-violet-50 text-violet-700 border-violet-200' },
      [Status.BILLED]: { label: 'Billed', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    };

    // If it's any PENDING status, show all active flags
    if (isPending) {
        const activeFlags = [];
        const flags = m.pendingFlags || { jm: false, tl: false, ced: false };
        
        // Include the status itself as a flag if it's one of the specific ones
        const jm = flags.jm || status === Status.PENDING_JM;
        const tl = flags.tl || status === Status.PENDING_TL;
        const ced = flags.ced || status === Status.PENDING_CED;

        if (jm) activeFlags.push({ label: 'JM', color: 'bg-rose-500 text-white' });
        if (tl) activeFlags.push({ label: 'TL', color: 'bg-amber-500 text-white' });
        if (ced) activeFlags.push({ label: 'CED', color: 'bg-violet-500 text-white' });
        
        if (activeFlags.length > 0) {
            return (
                <div className="flex flex-wrap gap-1">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        {activeFlags.length > 1 ? 'Multi-Query' : 'Pending'}
                    </div>
                    {activeFlags.map(f => (
                        <div key={f.label} className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase ${f.color}`}>
                            {f.label}
                        </div>
                    ))}
                </div>
            );
        }
    }

    const c = config[status] || config[Status.UNTOUCHED];
    return (
      <motion.div 
        key={status}
        initial={status === Status.WORKED ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 25 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${c.color}`}
      >
        {c.icon} {c.label}
      </motion.div>
    );
  };

  return (
    <div className="relative pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-200/60 overflow-hidden"
      >
        <div className="p-8 bg-slate-50/30 border-b border-slate-200/60 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search IDs, Journals, or Remarks..."
                className="input-field pl-11"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex overflow-x-auto hide-scrollbar gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              {(['ALL', 'HANDOVER', 'PENDING_GROUP', Status.UNTOUCHED, Status.WORKED, Status.BILLED] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setFilterStatus(key as any)}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filterStatus === key ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                >
                  {key === 'ALL' ? 'All Files' : key === 'PENDING_GROUP' ? 'All Pending' : key === 'HANDOVER' ? 'Worked & JM' : key === Status.UNTOUCHED ? 'Untouched' : key === Status.WORKED ? 'Worked' : 'Billed'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Range:</span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
                <span className="text-slate-300 text-xs">to</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
                {(startDate || endDate || search || filterStatus !== 'ALL') && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); setFilterStatus('ALL'); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100"
                    title="Reset All Filters"
                  >
                    <RefreshCcw className="w-3 h-3" /> Reset All
                  </button>
                )}
              </div>
            </div>
            
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing:</span>
              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase">
                {filteredWithDates.length} of {manuscripts.length} Files
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-200/60">
              <tr className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                <th className="px-8 py-5 w-12">
                   <button onClick={toggleAll} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      {selectedIds.size === filteredWithDates.length && filteredWithDates.length > 0 ? <CheckSquareIcon className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                   </button>
                </th>
                <th className="px-6 py-5">Manuscript</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Remarks</th>
                <th className="px-6 py-5">Activity</th>
                <th className="px-8 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWithDates.map(m => {
                const sla = getSlaInfo(m);
                return (
                <React.Fragment key={m.id}>
                  <tr 
                    className={`group hover:bg-slate-50/80 transition-all cursor-pointer ${expandedId === m.id ? 'bg-indigo-50/30' : ''} ${selectedIds.has(m.id) ? 'bg-indigo-50/50' : ''} ${m.status === Status.WORKED ? 'bg-emerald-50/10' : ''}`} 
                    onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  >
                    <td className="px-8 py-5" onClick={(e) => toggleRow(m.id, e)}>
                       <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(m.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 group-hover:border-slate-300 bg-white'}`}>
                          {selectedIds.has(m.id) && <CheckSquareIcon className="w-4 h-4 text-white" />}
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl transition-colors ${expandedId === m.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                           {expandedId === m.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                             <p className="text-sm font-bold text-slate-900 leading-tight">{m.manuscriptId}</p>
                             <button 
                               onClick={(e) => { e.stopPropagation(); handleCopy(m.id, m.manuscriptId); }}
                               className={`p-1 rounded transition-all ${copiedId === m.id ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100'}`}
                               title="Copy Manuscript ID"
                             >
                               {copiedId === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                             </button>
                             {sla && (
                               <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${sla.color} ${sla.pulse ? 'animate-pulse' : ''}`}>
                                 {sla.label}
                               </span>
                             )}
                           </div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">{m.journalCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">{getStatusBadge(m)}</td>
                    <td className="px-6 py-5 max-w-[200px]">
                      {m.notes && m.notes.length > 0 ? (
                        <div className="flex items-start gap-2 group/note">
                          <div className="p-1 bg-slate-100 rounded text-slate-400 mt-0.5">
                            <FileText className="w-3 h-3" />
                          </div>
                          <p className="text-[11px] font-medium text-slate-600 line-clamp-2 leading-tight">
                            {m.notes[0].content}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic tracking-widest">No Remarks</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-bold text-slate-700">{new Date(m.dateStatusChanged || m.dateUpdated).toLocaleDateString()}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5 tracking-wider">{new Date(m.dateStatusChanged || m.dateUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center gap-1">
                        {m.status !== Status.WORKED && m.status !== Status.BILLED && (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.WORKED }); }} 
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                              title="Direct Worked"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.PENDING_CED }); }} 
                              className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-all" 
                              title="CED"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.PENDING_TL }); }} 
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                              title="TL Query"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setQueryModal({ 
                                  isOpen: true, 
                                  manuscript: m,
                                  flags: {
                                    jm: m.status === Status.PENDING_JM || (m.status === Status.PENDING && !!m.pendingFlags?.jm),
                                    tl: m.status === Status.PENDING_TL || (m.status === Status.PENDING && !!m.pendingFlags?.tl),
                                    ced: m.status === Status.PENDING_CED || (m.status === Status.PENDING && !!m.pendingFlags?.ced)
                                  }
                                }); 
                              }} 
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" 
                              title="Raise Queries"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <div className="w-px h-4 bg-slate-200 mx-1 self-center" />
                        <button onClick={(e) => { e.stopPropagation(); onEdit(m); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(m.id); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === m.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-16 py-8">
                        <div className="flex flex-col md:flex-row gap-12">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                              <History className="w-3.5 h-3.5" /> Audit Timeline
                            </p>
                            <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                              <div className="relative pl-8">
                                <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-indigo-50 shadow-sm" />
                                <p className="text-xs font-bold text-slate-800">Initial Import / Received</p>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{new Date(m.dateReceived).toLocaleString()}</p>
                              </div>
                              {m.notes.map(note => (
                                <div key={note.id} className="relative pl-8">
                                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-slate-300 ring-4 ring-white" />
                                  <p className="text-xs font-medium text-slate-600 leading-relaxed">{note.content}</p>
                                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{new Date(note.timestamp).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="w-full md:w-80 space-y-4">
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quick Status Update</p>
                                <div className="grid grid-cols-2 gap-2">
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.WORKED }); }}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors border border-emerald-100"
                                   >
                                      <CheckCircle className="w-3 h-3" /> Worked
                                   </button>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.PENDING_CED }); }}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-50 text-violet-700 text-[10px] font-black uppercase hover:bg-violet-100 transition-colors border border-violet-100"
                                   >
                                      <Mail className="w-3 h-3" /> CED
                                   </button>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); setQuickUpdateModal({ isOpen: true, manuscript: m, targetStatus: Status.PENDING_TL }); }}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-black uppercase hover:bg-amber-100 transition-colors border border-amber-100"
                                   >
                                      <AlertTriangle className="w-3 h-3" /> TL Query
                                   </button>
                                   <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setQueryModal({ 
                                          isOpen: true, 
                                          manuscript: m,
                                          flags: {
                                            jm: m.status === Status.PENDING_JM || (m.status === Status.PENDING && !!m.pendingFlags?.jm),
                                            tl: m.status === Status.PENDING_TL || (m.status === Status.PENDING && !!m.pendingFlags?.tl),
                                            ced: m.status === Status.PENDING_CED || (m.status === Status.PENDING && !!m.pendingFlags?.ced)
                                          }
                                        }); 
                                      }}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-black uppercase hover:bg-rose-100 transition-colors border border-rose-100"
                                   >
                                      <AlertCircle className="w-3 h-3" /> Raise Queries
                                   </button>
                                </div>
                             </div>
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Priority Settings</p>
                                <div className="space-y-4">
                                   <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-500">Tier:</span>
                                      <span className={`text-xs font-black uppercase px-2 py-1 rounded-lg ${m.priority === 'Urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                         {m.priority}
                                      </span>
                                   </div>
                                   <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-slate-500">Target Due:</span>
                                      <span className="text-xs font-bold text-slate-800">{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'ASAP'}</span>
                                   </div>
                                </div>
                             </div>
                             <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-lg">
                                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Internal Ref</p>
                                <p className="text-xs font-mono break-all opacity-80">{m.id}</p>
                             </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )})}
            </tbody>
          </table>
          {filteredWithDates.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Inbox className="w-10 h-10 text-slate-200" />
              </div>
              <p className="font-bold text-slate-400 uppercase tracking-[0.2em] text-xs">No matching records found</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Update Modal */}
      {quickUpdateModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
          >
             <div className={`p-8 border-b border-slate-100 flex justify-between items-center ${
               quickUpdateModal.targetStatus === Status.WORKED ? 'bg-emerald-50/30' : 
               quickUpdateModal.targetStatus === Status.PENDING_CED ? 'bg-violet-50/30' : 'bg-amber-50/30'
             }`}>
               <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl shadow-lg ${
                    quickUpdateModal.targetStatus === Status.WORKED ? 'bg-emerald-600 shadow-emerald-200' : 
                    quickUpdateModal.targetStatus === Status.PENDING_CED ? 'bg-violet-600 shadow-violet-200' : 'bg-amber-600 shadow-amber-200'
                  }`}>
                    {quickUpdateModal.targetStatus === Status.WORKED ? <CheckCircle className="w-6 h-6 text-white" /> : 
                     quickUpdateModal.targetStatus === Status.PENDING_CED ? <Mail className="w-6 h-6 text-white" /> : <AlertTriangle className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Update to {
                        quickUpdateModal.targetStatus === Status.WORKED ? 'Worked' : 
                        quickUpdateModal.targetStatus === Status.PENDING_CED ? 'CED' : 'TL Query'
                      }
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">{quickUpdateModal.manuscript?.manuscriptId}</p>
                  </div>
               </div>
               <button onClick={() => { setQuickUpdateModal({isOpen: false, manuscript: null, targetStatus: null}); setQuickNote(''); }} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X className="w-5 h-5" />
               </button>
             </div>

             <div className="p-8 space-y-6">
               <div>
                 <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Optional Note (Leave empty for auto-remark)</label>
                 <textarea 
                    className="w-full p-5 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 min-h-[100px] text-sm font-medium transition-all"
                    placeholder="Add a specific note or just click proceed..."
                    value={quickNote}
                    onChange={e => setQuickNote(e.target.value)}
                    autoFocus
                 />
               </div>
             </div>

             <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => { setQuickUpdateModal({isOpen: false, manuscript: null, targetStatus: null}); setQuickNote(''); }} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors">Cancel</button>
                <button 
                  onClick={() => {
                    if (!quickUpdateModal.manuscript || !quickUpdateModal.targetStatus) return;
                    const updates: any = { 
                      status: quickUpdateModal.targetStatus, 
                      dateStatusChanged: new Date().toISOString(),
                      dateUpdated: new Date().toISOString()
                    };
                    if (quickUpdateModal.targetStatus === Status.WORKED) {
                      updates.completedDate = new Date().toISOString();
                    }
                    if (quickNote.trim()) {
                      updates.notes = [{ id: crypto.randomUUID(), content: quickNote, timestamp: Date.now() }, ...(quickUpdateModal.manuscript.notes || [])];
                    }
                    onUpdate(quickUpdateModal.manuscript.id, updates);
                    setQuickUpdateModal({isOpen: false, manuscript: null, targetStatus: null});
                    setQuickNote('');
                  }}
                  className={`flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl transition-all shadow-lg active:scale-95 ${
                    quickUpdateModal.targetStatus === Status.WORKED ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700' : 
                    quickUpdateModal.targetStatus === Status.PENDING_CED ? 'bg-violet-600 shadow-violet-200 hover:bg-violet-700' : 'bg-amber-600 shadow-amber-200 hover:bg-amber-700'
                  }`}
                >
                  Proceed Update
                </button>
             </div>
          </motion.div>
        </div>
      )}

      {/* Query Modal */}
      {queryModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200"
          >
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-600 rounded-2xl shadow-lg shadow-rose-200">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Raise Queries</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">{queryModal.manuscript?.manuscriptId}</p>
                  </div>
               </div>
               <button onClick={() => { setQueryModal({isOpen: false, manuscript: null, flags: {jm: false, tl: false, ced: false}}); setQueryNote(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
               </button>
             </div>

             <div className="p-8 space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Reasons (Multiple Allowed)</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setQueryModal(prev => ({ ...prev, flags: { ...prev.flags, jm: !prev.flags.jm }}))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${queryModal.flags.jm ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}
                    >
                      {queryModal.flags.jm && <CheckSquareIcon className="w-3 h-3" />} JM Query
                    </button>
                    <button
                      onClick={() => setQueryModal(prev => ({ ...prev, flags: { ...prev.flags, tl: !prev.flags.tl }}))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${queryModal.flags.tl ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-100' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                    >
                      {queryModal.flags.tl && <CheckSquareIcon className="w-3 h-3" />} TL Query
                    </button>
                    <button
                      onClick={() => setQueryModal(prev => ({ ...prev, flags: { ...prev.flags, ced: !prev.flags.ced }}))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${queryModal.flags.ced ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-100' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'}`}
                    >
                      {queryModal.flags.ced && <CheckSquareIcon className="w-3 h-3" />} Email CED
                    </button>
                  </div>
                </div>

               <div>
                 <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Internal Issues / Remarks</label>
                 <textarea 
                    className="w-full p-5 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-rose-100 focus:border-rose-400 min-h-[120px] text-sm font-medium transition-all"
                    placeholder="Describe what needs fixing (e.g., 'missing figure 2', 'author name mismatch')..."
                    value={queryNote}
                    onChange={e => setQueryNote(e.target.value)}
                 />
                 <div className="mt-3 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Confidential Internal Notes</p>
                 </div>
               </div>
             </div>

             <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => { setQueryModal({isOpen: false, manuscript: null, flags: {jm: false, tl: false, ced: false}}); setQueryNote(''); }} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors">Cancel</button>
                <button 
                  disabled={!queryModal.flags.jm && !queryModal.flags.tl && !queryModal.flags.ced}
                  onClick={() => {
                    if (!queryModal.manuscript) return;
                    const { jm, tl, ced } = queryModal.flags;
                    
                    // Determine primary status if only one is selected, otherwise use PENDING
                    let status = Status.PENDING;
                    if (jm && !tl && !ced) status = Status.PENDING_JM;
                    else if (tl && !jm && !ced) status = Status.PENDING_TL;
                    else if (ced && !jm && !tl) status = Status.PENDING_CED;

                    onUpdate(queryModal.manuscript.id, { 
                      status, 
                      pendingFlags: { jm, tl, ced },
                      dateStatusChanged: new Date().toISOString(),
                      dateUpdated: new Date().toISOString(),
                      notes: [{ id: crypto.randomUUID(), content: queryNote || "Queries Raised", timestamp: Date.now() }, ...(queryModal.manuscript.notes || [])]
                    });
                    setQueryModal({ isOpen: false, manuscript: null, flags: {jm: false, tl: false, ced: false} });
                    setQueryNote('');
                  }} 
                  className="flex-[2] py-4 text-xs font-black uppercase tracking-widest text-white bg-rose-600 rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                >
                  Confirm Status Change
                </button>
             </div>
          </motion.div>
        </div>
      )}

      {/* Floating Premium Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
           <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-8 text-white min-w-[600px] ring-1 ring-white/20">
              <div className="flex items-center gap-4 pr-8 border-r border-white/10">
                 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-black shadow-lg shadow-indigo-500/30 text-lg">
                    {selectedIds.size}
                 </div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block mb-0.5">Selection</span>
                    <span className="text-sm font-bold whitespace-nowrap">Analyst Batch Mode</span>
                 </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => handleBulkAction('billed')}
                  className="px-5 py-2.5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                 >
                   <CheckSquare className="w-4 h-4 text-indigo-400" /> Mark Billed
                 </button>
                 <button 
                  onClick={() => handleBulkAction('worked')}
                  className="px-5 py-2.5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                 >
                   <CheckCircle className="w-4 h-4 text-emerald-400" /> Mark Worked
                 </button>
                 <button 
                  onClick={() => handleBulkAction('review')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95"
                 >
                   <PlayCircle className="w-4 h-4" /> Start Review
                 </button>
                 <button 
                  onClick={() => handleBulkAction('delete')}
                  className="px-4 py-2.5 hover:bg-rose-500/20 text-rose-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>

              <button 
                onClick={() => setSelectedIds(new Set())}
                className="p-2.5 hover:bg-white/10 rounded-full ml-auto text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ManuscriptList;