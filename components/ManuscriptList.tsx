
import React, { useState, useEffect, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { Search, Edit2, CheckCircle, Clock, Trash2, Zap, RefreshCcw, MessageSquare, Copy, Filter, AlertCircle, Inbox } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface ManuscriptListProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Manuscript>) => void;
  onRefresh?: () => void;
  activeFilter: Status | 'ALL' | 'PENDING_GROUP' | 'URGENT';
}

const ManuscriptList: React.FC<ManuscriptListProps> = ({ manuscripts, onEdit, onDelete, onUpdate, onRefresh, activeFilter }) => {
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL' | 'PENDING_GROUP' | 'URGENT'>(activeFilter);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  useEffect(() => { setFilterStatus(activeFilter); }, [activeFilter]);

  const filtered = useMemo(() => {
    return manuscripts.filter(m => {
      let match = filterStatus === 'ALL' || (
        filterStatus === 'PENDING_GROUP' 
          ? [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) 
          : (filterStatus === 'URGENT' ? m.priority === 'Urgent' && m.status !== Status.WORKED : m.status === filterStatus)
      );
      if (!match) return false;
      if (search && !m.manuscriptId.toLowerCase().includes(search.toLowerCase()) && !m.journalCode.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [manuscripts, filterStatus, search]);

  const handleCopyHandover = () => {
    const worked = manuscripts.filter(m => m.status === Status.WORKED).map(m => m.manuscriptId).join(', ');
    const pending = manuscripts.filter(m => [Status.PENDING_JM, Status.PENDING_TL].includes(m.status)).map(m => `${m.manuscriptId} (${m.status})`).join('\n');
    
    const text = `HANDOVER REPORT - ${new Date().toLocaleDateString()}\n\nWORKED:\n${worked || 'None'}\n\nPENDING:\n${pending || 'None'}`;
    navigator.clipboard.writeText(text);
    alert('Handover summary copied to clipboard!');
  };

  const getStatusStyle = (s: Status) => {
    const colors: Record<Status, {bg: string, text: string, dot: string}> = {
      [Status.WORKED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      [Status.BILLED]: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
      [Status.UNTOUCHED]: { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' },
      [Status.PENDING_JM]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
      [Status.PENDING_TL]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      [Status.PENDING_CED]: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' }
    };
    return colors[s] || { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' };
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
           {[
             { id: 'ALL', label: 'All Files', icon: Inbox },
             { id: Status.WORKED, label: 'Worked', icon: CheckCircle },
             { id: 'PENDING_GROUP', label: 'Pending', icon: Clock },
             { id: Status.PENDING_JM, label: 'JM Queries', icon: MessageSquare }
           ].map(t => (
             <button
               key={t.id}
               onClick={() => setFilterStatus(t.id as any)}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${filterStatus === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <t.icon className="w-3.5 h-3.5" /> {t.label}
             </button>
           ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleCopyHandover} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black hover:bg-slate-50 transition-all shadow-sm">
            <Copy className="w-3.5 h-3.5" /> Handover Text
          </button>
          <button onClick={onRefresh} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-all bg-white rounded-xl border border-slate-200 shadow-sm">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Filter by ID or Journal..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none text-sm transition-all font-medium" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{filtered.length} Work Items</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Manuscript Info</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Priority</th>
                <th className="px-8 py-5">Due Date</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => {
                const style = getStatusStyle(m.status);
                return (
                  <tr key={m.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-10 rounded-full ${style.dot} opacity-50`} />
                        <div>
                          <p className="font-black text-slate-800 tracking-tight text-base">{m.manuscriptId}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{m.journalCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${style.bg} ${style.text}`}>
                        <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      {m.priority === 'Urgent' ? (
                        <span className="flex items-center gap-1.5 text-rose-600 font-black text-[10px] uppercase">
                          <Zap className="w-3.5 h-3.5 fill-rose-600" /> Urgent
                        </span>
                      ) : m.priority === 'High' ? (
                        <span className="flex items-center gap-1.5 text-amber-600 font-black text-[10px] uppercase">
                          <AlertCircle className="w-3.5 h-3.5 fill-amber-600" /> High
                        </span>
                      ) : (
                        <span className="text-slate-400 font-black text-[10px] uppercase">Normal</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(m)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, id: m.id })} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center bg-slate-50/20">
              <p className="text-slate-400 font-bold">No assignments found in this view</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmationModal 
        isOpen={deleteConfirm.isOpen} 
        title="Confirm Deletion" 
        message="Are you sure you want to remove this manuscript from the worklog?" 
        variant="danger" 
        onConfirm={() => { if (deleteConfirm.id) onDelete(deleteConfirm.id); setDeleteConfirm({ isOpen: false, id: null }); }} 
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })} 
      />
    </div>
  );
};

export default ManuscriptList;
