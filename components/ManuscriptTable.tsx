import React from 'react';
import { Manuscript, Status } from '../types';
import { CheckCircle, FileCheck, Inbox, AlertCircle, AlertTriangle, Mail, Clock, Zap, ArrowUpDown, ArrowUp, ArrowDown, Timer, MessageSquare, History as HistoryIcon, Edit2, Trash2, Send, CheckSquare } from 'lucide-react';
import { isTodayDate, isActivityToday } from '../lib/utils';

interface ManuscriptTableProps {
  filteredAndSorted: Manuscript[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  onSort: (key: any) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  filterStatus: Status | 'ALL' | 'PENDING_GROUP' | 'HANDOVER';
  search: string;
  onQuickAction: (m: Manuscript, action: 'WORKED' | 'QUERY_JM') => void;
  onSendEmail: (m: Manuscript) => void;
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
}

export const ManuscriptTable: React.FC<ManuscriptTableProps> = ({
  filteredAndSorted,
  selectedIds,
  onSelectAll,
  onSelectOne,
  sortConfig,
  onSort,
  onUpdate,
  filterStatus,
  search,
  onQuickAction,
  onSendEmail,
  onEdit,
  onDelete
}) => {

  const handleQuickStatusUpdate = (m: Manuscript, newStatus: Status) => {
    onUpdate(m.id, { status: newStatus });
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

        <div className="absolute left-1/2 -translate-x-1/2 top-0 opacity-0 group-hover/hub:opacity-100 pointer-events-none group-hover/hub:pointer-events-auto transition-all duration-300 z-30 flex bg-white border border-slate-200 rounded-full p-1 shadow-xl translate-y-2 group-hover/hub:translate-y-0">
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

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3 h-3 text-blue-600" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="w-3 h-3 text-blue-600" />;
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  };

  return (
    <div className="overflow-x-auto min-h-[400px]">
      {filterStatus === 'HANDOVER' && (
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
           <FileCheck className="w-5 h-5 text-indigo-600" />
           <p className="text-sm text-indigo-800 font-medium">
             Handover View: <span className="font-bold">Worked (Ready)</span> and <span className="font-bold text-rose-700">JM Queries</span>.
           </p>
        </div>
      )}
      <table className="w-full text-center text-sm text-slate-600 border-separate border-spacing-0">
        <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 w-10 text-center sticky top-0 bg-slate-50/80 z-10">
              <input type="checkbox" checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length} onChange={onSelectAll} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors" />
            </th>
            <th className="px-6 py-4 text-center sticky top-0 bg-slate-50/80 z-10">Interactive Status</th>
            <th 
              className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none sticky top-0 bg-slate-50/80 z-10"
              onClick={() => onSort('statusDate')}
            >
              <div className="flex items-center justify-center gap-1">
                Timeline {renderSortIcon('statusDate')}
              </div>
            </th>
            <th 
              className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none sticky top-0 bg-slate-50/80 z-10"
              onClick={() => onSort('manuscriptId')}
            >
              <div className="flex items-center justify-center gap-1">
                ID / Journal {renderSortIcon('manuscriptId')}
              </div>
            </th>
            <th 
              className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none sticky top-0 bg-slate-50/80 z-10"
              onClick={() => onSort('dateReceived')}
            >
              <div className="flex items-center justify-center gap-1">
                Date Sent {renderSortIcon('dateReceived')}
              </div>
            </th>
            <th className="px-6 py-4 text-center sticky top-0 bg-slate-50/80 z-10">Due Date</th>
            <th 
              className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors select-none sticky top-0 bg-slate-50/80 z-10"
              onClick={() => onSort('priority')}
            >
              <div className="flex items-center justify-center gap-1">
                Priority {renderSortIcon('priority')}
              </div>
            </th>
            <th className="px-6 py-4 min-w-[220px] text-center sticky top-0 bg-slate-50/80 z-10">Remarks History</th>
            <th className="px-6 py-4 text-center sticky top-0 bg-slate-50/80 z-10">Actions</th>
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
             const isDueToday = isTodayDate(m.dueDate) && (m.status !== Status.WORKED && m.status !== Status.BILLED);
             const isSelected = selectedIds.has(m.id);
             const ageInDays = Math.floor((new Date().getTime() - dateObj.getTime()) / (1000 * 3600 * 24));

             return (
              <tr key={m.id} className={`group transition-all duration-200 ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'} ${m.status === Status.PENDING_JM ? 'bg-rose-50/10' : ''}`}>
                <td className="px-6 py-4 text-center border-b border-slate-50">
                  <input type="checkbox" checked={isSelected} onChange={() => onSelectOne(m.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 transition-colors" />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center border-b border-slate-50">
                  <div className="flex justify-center">
                    {getStatusHub(m)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center border-b border-slate-50">
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
                <td className="px-6 py-4 text-center border-b border-slate-50">
                  <div className="flex flex-col gap-0.5 items-center">
                    <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{m.manuscriptId}</span>
                    <span className="text-slate-400 text-[10px] font-mono">{m.journalCode}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-slate-700 border-b border-slate-50">{new Date(m.dateReceived).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-center border-b border-slate-50">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-sm ${isDueToday ? 'font-black text-rose-600' : 'text-slate-700'}`}>
                      {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}
                    </span>
                    {isDueToday && (
                      <span className="text-[9px] font-black text-white bg-rose-600 px-1.5 py-0.5 rounded uppercase leading-none tracking-widest animate-pulse">Due Today</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center border-b border-slate-50">
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
                <td className="px-6 py-4 text-center relative group/remarks border-b border-slate-50">
                  <div className="flex flex-col gap-1.5 items-center">
                    {m.notes.length > 0 ? (
                      <div className="relative w-full max-w-[200px] py-1">
                        <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100 group-hover/remarks:border-indigo-200 group-hover/remarks:bg-white group-hover/remarks:shadow-sm transition-all cursor-default overflow-hidden">
                          <div className="text-[11px] text-slate-600 line-clamp-2 text-center leading-relaxed">
                            {m.notes[0].content}
                          </div>
                        </div>
                        {m.notes.length > 1 && (
                          <div className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-black shadow-lg border border-white z-10 transition-transform group-hover/remarks:scale-110">
                            {m.notes.length}
                          </div>
                        )}
                        
                        {/* History Panel with Smooth Transition */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200 opacity-0 invisible scale-95 group-hover/remarks:opacity-100 group-hover/remarks:visible group-hover/remarks:scale-100 transition-all duration-300 z-50 p-5 origin-top text-center overflow-hidden">
                           <div className="flex items-center justify-center gap-2 mb-4 border-b border-slate-50 pb-3">
                              <HistoryIcon className="w-4 h-4 text-indigo-500" />
                              <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Remark History</span>
                           </div>
                           <div className="space-y-4 max-h-56 overflow-y-auto custom-scrollbar px-1 pr-2">
                              {m.notes.map((note, idx) => (
                                <div key={note.id} className={`text-left relative pl-3 ${idx !== m.notes.length - 1 ? 'border-l-2 border-slate-100 pb-4' : 'pl-3'}`}>
                                   <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-indigo-400"></div>
                                   <p className="text-[11px] text-slate-700 font-semibold leading-relaxed">{note.content}</p>
                                   <p className="text-[9px] text-slate-400 mt-1 font-bold flex items-center gap-1.5">
                                      <Clock className="w-2.5 h-2.5" />
                                      {new Date(note.timestamp).toLocaleDateString()} at {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> No remarks</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center whitespace-nowrap border-b border-slate-50">
                  <div className="flex justify-center items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    {m.status !== Status.WORKED && m.status !== Status.BILLED && (
                      <>
                        <button onClick={() => onSendEmail(m)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all" title="Email Query"><Send className="w-4 h-4" /></button>
                        {m.status !== Status.PENDING_JM && (
                          <button onClick={() => onQuickAction(m, 'QUERY_JM')} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all" title="Query JM"><AlertCircle className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => onQuickAction(m, 'WORKED')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all" title="Resolve"><CheckSquare className="w-4 h-4" /></button>
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
  );
};
