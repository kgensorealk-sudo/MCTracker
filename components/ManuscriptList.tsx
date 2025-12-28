import React, { useState, useEffect } from 'react';
import { Manuscript, Status } from '../types';
import { Search, Edit2, AlertCircle, CheckCircle, Clock, Download, Trash2, Inbox, AlertTriangle, Mail, CheckSquare } from 'lucide-react';

interface ManuscriptListProps {
  manuscripts: Manuscript[];
  onEdit: (m: Manuscript) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Manuscript>) => void;
  activeFilter: Status | 'ALL' | 'PENDING_GROUP';
}

const ManuscriptList: React.FC<ManuscriptListProps> = ({ manuscripts, onEdit, onDelete, onUpdate, activeFilter }) => {
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL' | 'PENDING_GROUP'>(activeFilter);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setFilterStatus(activeFilter);
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
    let matchesStatus = false;
    if (filterStatus === 'ALL') matchesStatus = true;
    else if (filterStatus === 'PENDING_GROUP') {
      matchesStatus = [Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status);
    } else {
      matchesStatus = m.status === filterStatus;
    }

    const matchesSearch = 
      m.manuscriptId.toLowerCase().includes(search.toLowerCase()) || 
      m.journalCode.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const downloadCSV = () => {
    // Removed 'Issues', Renamed 'Completed Date' to 'Submitted Date'
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
        // Removed issueTypes
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
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Worked</span>;
      case Status.UNTOUCHED:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><Inbox className="w-3.5 h-3.5" /> Untouched</span>;
      case Status.PENDING_JM:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200"><AlertCircle className="w-3.5 h-3.5" /> Pending: JM Query</span>;
      case Status.PENDING_TL:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200"><AlertTriangle className="w-3.5 h-3.5" /> Pending: TL Query</span>;
      case Status.PENDING_CED:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200"><Mail className="w-3.5 h-3.5" /> Pending: Email CED</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">Unknown</span>;
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search ID, Journal..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto items-center">
          {(['ALL', 'UNTOUCHED', 'PENDING_GROUP', 'WORKED'] as const).map(key => {
            const statusKey = key === 'ALL' ? 'ALL' : key === 'UNTOUCHED' ? Status.UNTOUCHED : key === 'WORKED' ? Status.WORKED : 'PENDING_GROUP';
            
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(statusKey)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
                  filterStatus === statusKey
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>
                  {key === 'ALL' ? 'All Files' : 
                   key === 'PENDING_GROUP' ? 'Pending / Queries' : 
                   key.charAt(0) + key.slice(1).toLowerCase()}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                   filterStatus === statusKey 
                    ? 'bg-slate-600 text-slate-100' 
                    : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                }`}>
                  {counts[key as keyof typeof counts]}
                </span>
              </button>
            );
          })}
          <div className="h-8 w-px bg-slate-300 mx-2 hidden md:block"></div>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-xs border-b border-slate-200">
            <tr>
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
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  No manuscripts found matching your criteria.
                </td>
              </tr>
            )}
            {filtered.map((m) => {
               // Determine which date to show for Status Date
               // For WORKED, prefer completedDate. For others, use dateStatusChanged or dateUpdated.
               const displayDateRaw = m.status === Status.WORKED && m.completedDate 
                 ? m.completedDate 
                 : (m.dateStatusChanged || m.dateUpdated);
               const dateObj = new Date(displayDateRaw);
               const displayDate = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
               const isActivityToday = isToday(dateObj);

               return (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(m.status)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs ${isActivityToday ? 'text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded' : 'text-slate-500'}`}>
                      {displayDate}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{m.manuscriptId}</span>
                      </div>
                      <div className="text-slate-500 text-xs">{m.journalCode}</div>
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
                      className={`block w-full text-xs font-semibold px-2 py-1 rounded border appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 ${
                        m.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-100' : 
                        m.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                        'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {m.issueTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {m.issueTypes.map(issue => (
                            <span key={issue} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] border border-slate-200">
                              {issue.split('/')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {m.notes.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {m.notes.map((note) => (
                            <div key={note.id} className="bg-slate-50 p-2 rounded border border-slate-100 shadow-sm">
                              <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{note.content}</div>
                              <div className="text-[10px] text-slate-400 mt-1.5 text-right flex justify-end items-center gap-1">
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
                        m.issueTypes.length === 0 && <span className="text-[10px] text-slate-400 italic">No remarks</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end items-center gap-2">
                      
                      {/* Resolve Button for Pending Items */}
                      {[Status.PENDING_JM, Status.PENDING_TL, Status.PENDING_CED].includes(m.status) && (
                        <button 
                          onClick={() => {
                            if (window.confirm('Mark this query as resolved (Worked)?')) {
                              onUpdate(m.id, { status: Status.WORKED });
                            }
                          }}
                          className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors shadow-sm"
                          title="Resolve: Mark as Worked"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                      )}

                      <button 
                        onClick={() => onDelete(m.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-transparent hover:border-red-200 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onEdit(m)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md border border-transparent hover:border-slate-300"
                        title="Edit Details"
                      >
                        <Edit2 className="w-4 h-4" />
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