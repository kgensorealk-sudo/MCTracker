import React, { useState, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { X, Mail, Send, CheckCircle, Clock, AlertCircle, Info, ListChecks } from 'lucide-react';

interface DailyReportModalProps {
  manuscripts: Manuscript[];
  onClose: () => void;
  onMarkReported: (ids: string[]) => void;
}

const DailyReportModal: React.FC<DailyReportModalProps> = ({ manuscripts, onClose, onMarkReported }) => {
  const [isClosing, setIsClosing] = useState(false);
  
  // Get today's date in local format for comparison
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Identify files touched today (Worked, Pending, or Notes added today)
  const todayFiles = useMemo(() => {
    return manuscripts.filter(m => {
      const updatedDate = (m.dateStatusChanged || m.dateUpdated || m.dateReceived).split('T')[0];
      const hasTodayNotes = m.notes.some(n => new Date(n.timestamp).toLocaleDateString('en-CA') === today);
      return updatedDate === today || hasTodayNotes;
    });
  }, [manuscripts, today]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(todayFiles.map(m => m.id)));

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const formatDateForEmail = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    // Format: M-D-YY as per sample (e.g., 1-11-26)
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const y = date.getFullYear().toString().slice(-2);
    return `${m}-${d}-${y}`;
  };

  const generateEmail = () => {
    const selectedFiles = todayFiles.filter(m => selectedIds.has(m.id));
    if (selectedFiles.length === 0) return;

    // Straive / Elsevier Recipients
    const to = 'dgteesabotypesetleads@straive.com';
    const cc = 'ESJrnlsG2Supv@straive.com, lordthee.enmacino@straive.com, Rea.Cinco@straive.com';
    
    // Subject: List of Manuscript IDs
    const subject = selectedFiles.map(m => m.manuscriptId).join(', ');

    // Body Template Construction
    let body = "Please see the files below with remarks\n\n";
    body += "Articles\tDate Received\tDate Submitted\tRemarks\n";
    
    selectedFiles.forEach(m => {
      const dateReceived = formatDateForEmail(m.dateReceived);
      const dateSubmitted = m.status === Status.WORKED 
        ? formatDateForEmail(m.completedDate || m.dateStatusChanged || m.dateUpdated)
        : "";
      
      // Remark Construction
      let remark = "";
      if (m.status === Status.WORKED) {
        remark = "Done";
      } else {
        // Map status to readable format used in sample
        const statusLabel = m.status === Status.PENDING_JM ? "with JM Query" : 
                           m.status === Status.PENDING_TL ? "with TL Query" : 
                           m.status === Status.PENDING_CED ? "Emailed CED" : "Untouched";
        remark = statusLabel;
      }

      // Append last note context if it exists and isn't just "Done"
      if (m.notes && m.notes.length > 0) {
        const lastNote = m.notes[0].content;
        const normalizedNote = lastNote.toLowerCase();
        if (normalizedNote !== 'done' && normalizedNote !== 'resolved') {
           remark = (remark === "Done" || !remark) ? lastNote : `${remark} | ${lastNote}`;
        }
      }

      body += `${m.manuscriptId}\t${dateReceived}\t${dateSubmitted}\t${remark}\n`;
    });

    body += "\nThanks!";

    const mailtoUrl = `mailto:${to}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // FIX: Use window.location.href instead of window.open to trigger the mail app
    // This prevents the empty "untitled" tab from appearing.
    window.location.href = mailtoUrl;
    
    // Mark as emailed in DB
    onMarkReported(Array.from(selectedIds));
    handleClose();
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Daily Report Draft</h2>
              <p className="text-sm text-slate-500">Straive S200 Typesetting Template</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-slate-50/30">
          {todayFiles.length === 0 ? (
            <div className="py-16 text-center">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-slate-600 font-bold text-lg">Nothing to report yet</p>
               <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">Once you mark files as Worked or Pending today, they will appear here for your end-of-day email.</p>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <ListChecks className="w-4 h-4" /> Today's Activity ({todayFiles.length})
                  </span>
                  <button 
                    onClick={() => setSelectedIds(selectedIds.size === todayFiles.length ? new Set() : new Set(todayFiles.map(m => m.id)))}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                  >
                    {selectedIds.size === todayFiles.length ? 'Deselect All' : 'Select All'}
                  </button>
               </div>

               <div className="grid gap-2">
                 {todayFiles.map(m => (
                   <div 
                     key={m.id} 
                     onClick={() => toggleSelect(m.id)}
                     className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${
                       selectedIds.has(m.id) 
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                        : 'border-white bg-white hover:border-slate-200 shadow-sm'
                     }`}
                   >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedIds.has(m.id) ? 'bg-indigo-600 border-indigo-600 rotate-0' : 'border-slate-200 bg-white rotate-90'
                      }`}>
                        {selectedIds.has(m.id) && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{m.manuscriptId}</p>
                            {m.dateEmailed && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold border border-emerald-100">Previously Emailed</span>}
                         </div>
                         <p className="text-[10px] text-slate-400 font-mono">{m.journalCode}</p>
                      </div>
                      <div className="text-right">
                         <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm ${
                            m.status === Status.WORKED ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                         }`}>
                            {m.status.replace(/_/g, ' ')}
                         </span>
                         <p className="text-[10px] text-slate-500 mt-1.5 italic max-w-[180px] truncate group-hover:max-w-none group-hover:whitespace-normal transition-all">
                            {m.notes[0]?.content || 'No specific remarks'}
                         </p>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <div className="flex flex-col">
             <span className="text-sm font-bold text-slate-700">{selectedIds.size} Files Selected</span>
             <span className="text-xs text-slate-400">Handing over to email client...</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              disabled={selectedIds.size === 0}
              onClick={generateEmail}
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
            >
              <Send className="w-4 h-4" />
              Open Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;