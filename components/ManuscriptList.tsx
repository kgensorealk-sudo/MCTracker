import React, { useState } from 'react';
import { Manuscript, Status } from '../types';
import { ListChecks, FileCheck, Target, Flame, X } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { ManuscriptFilters } from './ManuscriptFilters';
import { ManuscriptTable } from './ManuscriptTable';
import { QueryModal } from './QueryModal';
import { EmailModal } from './EmailModal';
import { useManuscriptList } from '../hooks/useManuscriptList';

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

const ManuscriptList: React.FC<ManuscriptListProps> = ({ manuscripts, onEdit, onDelete, onUpdate, onBulkUpdate, onBulkReview, onRefresh, activeFilter }) => {
  const {
    filterStatus, setFilterStatus,
    search, setSearch,
    selectedIds, setSelectedIds,
    showDateFilters, setShowDateFilters,
    dateRange, setDateRange,
    sortConfig, handleSort,
    filteredAndSorted,
    dailyStats,
    counts,
    handleSelectAll,
    handleSelectOne
  } = useManuscriptList({ manuscripts, activeFilter });

  // Modals States
  const [queryModal, setQueryModal] = useState<{isOpen: boolean, manuscript: Manuscript | null}>({ isOpen: false, manuscript: null });
  
  // Custom Confirmation States
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [bulkConfirm, setBulkConfirm] = useState<{ isOpen: boolean, status: Status | null }>({ isOpen: false, status: null });
  const [quickWorkedConfirm, setQuickWorkedConfirm] = useState<{ isOpen: boolean, manuscript: Manuscript | null }>({ isOpen: false, manuscript: null });

  // Fix: Defined handleReviewBulk to trigger onBulkReview with selected IDs
  const handleReviewBulk = () => {
    if (onBulkReview && selectedIds.size > 0) {
      onBulkReview(Array.from(selectedIds));
    }
  };

  const handleQuickStatusUpdate = (m: Manuscript, newStatus: Status) => {
    const updates: Partial<Manuscript> = {
      status: newStatus,
    };
    onUpdate(m.id, updates);
  };

  const handleQuickAction = (m: Manuscript, action: 'WORKED' | 'QUERY_JM') => {
    if (action === 'QUERY_JM') {
      setQueryModal({ isOpen: true, manuscript: m });
      return;
    }
    if (action === 'WORKED') {
      setQuickWorkedConfirm({ isOpen: true, manuscript: m });
    }
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
    
    setEmailModal({
      isOpen: true,
      recipient,
      subject,
      body,
      manuscriptId: m.id
    });
  };

  const handleMarkSent = () => {
    if (emailModal.manuscriptId) {
      onUpdate(emailModal.manuscriptId, { dateEmailed: new Date().toISOString() });
      setEmailModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleSubmitQuery = (note: string) => {
    if (!queryModal.manuscript) return;
    const now = new Date().toISOString();
    const noteContent = note.trim() ? note : "JM Query Raised";
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
    onUpdate(queryModal.manuscript.id, updates);
    setQueryModal({ isOpen: false, manuscript: null });
  };

  const downloadCSV = () => {
    const headers = ['Manuscript ID', 'Journal', 'Date Sent', 'Due Date', 'Status', 'Status Date', 'Submitted Date', 'Priority', 'Remarks'];
    const rows = filteredAndSorted.map(m => {
      const headers_content = m.notes.map(n => `[${new Date(n.timestamp).toLocaleDateString()}] ${n.content}`).join('; ');
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
        `"${headers_content.replace(/"/g, '""')}"`
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

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-white shadow-xl shadow-slate-200/50 animate-fade-in-up">
         <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-600 rounded-xl">
               <Target className="w-5 h-5" />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Shift</p>
               <h4 className="text-sm font-bold">Worklog Oversight</h4>
            </div>
         </div>
         <div className="flex items-center gap-6 bg-white/5 px-6 py-2 rounded-xl border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-xs font-bold text-slate-300">Worked Today:</span>
               <span className="text-sm font-black text-white">{dailyStats.workedToday}</span>
            </div>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex items-center gap-2">
               <Flame className="w-3.5 h-3.5 text-amber-500" />
               <span className="text-xs font-bold text-slate-300">Pace:</span>
               <span className="text-sm font-black text-white">Active</span>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible relative animate-fade-in-up">
        {selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl px-6 py-4 shadow-2xl z-50 flex items-center gap-5 animate-fade-in-up border border-white/10 ring-1 ring-black/20">
             <span className="font-bold text-sm whitespace-nowrap px-3 bg-white/10 rounded-lg py-1.5">{selectedIds.size} selected</span>
             <div className="h-6 w-px bg-white/20"></div>
             <button onClick={handleReviewBulk} className="flex items-center gap-2 hover:text-emerald-300 transition-colors text-sm font-semibold">
               <ListChecks className="w-5 h-5" /> Review Items
             </button>
             <div className="h-6 w-px bg-white/20"></div>
             <button onClick={() => setBulkConfirm({ isOpen: true, status: Status.BILLED })} className="flex items-center gap-2 hover:text-indigo-300 transition-colors text-sm font-semibold">
               <FileCheck className="w-5 h-5" /> Mark Billed
             </button>
             <div className="h-6 w-px bg-white/20"></div>
             <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full">
               <X className="w-5 h-5" />
             </button>
          </div>
        )}

        <ManuscriptFilters
          search={search}
          setSearch={setSearch}
          onRefresh={onRefresh}
          showDateFilters={showDateFilters}
          setShowDateFilters={setShowDateFilters}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          counts={counts}
          onExport={downloadCSV}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />

        <ManuscriptTable
          filteredAndSorted={filteredAndSorted}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          sortConfig={sortConfig}
          onSort={handleSort}
          onUpdate={onUpdate}
          filterStatus={filterStatus}
          search={search}
          onQuickAction={handleQuickAction}
          onSendEmail={handleSendEmail}
          onEdit={onEdit}
          onDelete={(id) => setDeleteConfirm({ isOpen: true, id })}
        />
      </div>

      <QueryModal 
        isOpen={queryModal.isOpen} 
        manuscript={queryModal.manuscript} 
        onClose={() => setQueryModal({ isOpen: false, manuscript: null })} 
        onSubmit={handleSubmitQuery} 
      />

      <EmailModal
        isOpen={emailModal.isOpen}
        recipient={emailModal.recipient}
        subject={emailModal.subject}
        body={emailModal.body}
        onClose={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
        onMarkSent={handleMarkSent}
      />

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Record?"
        message="This action cannot be undone. All work history for this manuscript will be permanently removed."
        variant="danger"
        confirmLabel="Delete Permanently"
        onConfirm={() => {
          if (deleteConfirm.id) onDelete(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: null });
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />

      <ConfirmationModal
        isOpen={bulkConfirm.isOpen}
        title="Bulk Update?"
        message={`Are you sure you want to mark ${selectedIds.size} items as ${bulkConfirm.status?.replace(/_/g, ' ')}?`}
        variant="primary"
        confirmLabel="Update Items"
        onConfirm={() => {
          if (bulkConfirm.status) onBulkUpdate(Array.from(selectedIds), { status: bulkConfirm.status });
          setSelectedIds(new Set());
          setBulkConfirm({ isOpen: false, status: null });
        }}
        onCancel={() => setBulkConfirm({ isOpen: false, status: null })}
      />

      <ConfirmationModal
        isOpen={quickWorkedConfirm.isOpen}
        title="Resolve Item?"
        message={`Mark ${quickWorkedConfirm.manuscript?.manuscriptId} as WORKED/DONE? This will update your daily quota progress.`}
        variant="success"
        confirmLabel="Yes, Resolve"
        onConfirm={() => {
          if (quickWorkedConfirm.manuscript) handleQuickStatusUpdate(quickWorkedConfirm.manuscript, Status.WORKED);
          setQuickWorkedConfirm({ isOpen: false, manuscript: null });
        }}
        onCancel={() => setQuickWorkedConfirm({ isOpen: false, manuscript: null })}
      />
    </div>
  );
};

export default ManuscriptList;
