
import React from 'react';
import { Manuscript, Status } from '../types';
import { CheckCircle, AlertCircle, Inbox, AlertTriangle, Mail, Edit2, Trash2 } from 'lucide-react';

interface ManuscriptTableProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
}

export const ManuscriptTable: React.FC<ManuscriptTableProps> = ({
  manuscripts,
  onEdit,
  onDelete
}) => {
  const statusConfig: Record<Status, { label: string; icon: React.ReactNode; color: string }> = {
    [Status.WORKED]: { label: 'Worked', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    [Status.BILLED]: { label: 'Billed', icon: <CheckCircle className="w-3 h-3" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    [Status.UNTOUCHED]: { label: 'Untouched', icon: <Inbox className="w-3 h-3" />, color: 'bg-slate-100 text-slate-600 border-slate-200' },
    [Status.PENDING]: { label: 'Pending', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' }, // Fix: Added Status.PENDING
    [Status.PENDING_JM]: { label: 'JM Query', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-rose-50 text-rose-700 border-rose-200' },
    [Status.PENDING_TL]: { label: 'TL Query', icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    [Status.PENDING_CED]: { label: 'Email CED', icon: <Mail className="w-3 h-3" />, color: 'bg-violet-50 text-violet-700 border-violet-200' },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <th className="px-4 py-3">Manuscript ID</th>
            <th className="px-4 py-3">Journal</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {manuscripts.map(m => {
            const config = statusConfig[m.status];
            return (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-3 font-bold text-slate-700">{m.manuscriptId}</td>
                <td className="px-4 py-3 text-slate-500">{m.journalCode}</td>
                <td className="px-4 py-3">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${config.color}`}>
                    {config.icon}
                    {config.label}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold ${m.priority === 'Urgent' ? 'text-rose-600' : m.priority === 'High' ? 'text-amber-600' : 'text-slate-400'}`}>
                    {m.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(m)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(m.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
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
  );
};
