import React, { useState, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { X, Upload, FileSpreadsheet, AlertTriangle, FileText, CheckCircle2, Info, ArrowRight } from 'lucide-react';

interface BulkImportModalProps {
  onImport: (manuscripts: Manuscript[]) => void;
  onClose: () => void;
  existingManuscripts: Manuscript[];
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onImport, onClose, existingManuscripts }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const parseDate = (dateStr?: string): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    
    // Try standard parsing first
    let d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();

    // Try DD-MMM-YY format (e.g., 18-Mar-26)
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const monthStr = parts[1].toLowerCase();
      const yearStr = parts[2];
      
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        january: 0, february: 1, march: 2, april: 3, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      
      if (months[monthStr] !== undefined || !isNaN(parseInt(monthStr))) {
        const month = months[monthStr] !== undefined ? months[monthStr] : parseInt(monthStr) - 1;
        let year = parseInt(yearStr);
        if (year < 100) {
          // Heuristic for 2-digit year: assume 20xx if < 50, else 19xx
          year += year < 50 ? 2000 : 1900;
        }
        
        d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }

    return null;
  };

  // Real-time calculation of what would happen if we imported right now
  const importPreview = useMemo(() => {
    if (!text.trim()) return { newItems: [], skippedCount: 0 };

    const lines = text.trim().split('\n');
    const newItems: Manuscript[] = [];
    let skippedCount = 0;
    
    const existingIds = new Set(existingManuscripts.map(m => m.manuscriptId.toLowerCase()));
    const currentBatchIds = new Set<string>();

    const firstLineLower = lines[0].toLowerCase();
    const startIndex = (firstLineLower.includes('job name') || firstLineLower.includes('due date')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Try tab first, then multiple spaces, then comma
      let parts = line.split('\t');
      if (parts.length < 2) parts = line.split(/\s{2,}/);
      if (parts.length < 2) parts = line.split(',');
      // Fallback for single space if it looks like it has multiple columns (at least 3)
      if (parts.length < 2 && line.split(' ').length >= 3) parts = line.split(' ');
      
      if (parts.length < 1) continue;

      const jobName = parts[0]?.trim()?.replace(/^["']|["']$/g, '');
      if (!jobName || jobName.toLowerCase() === 'job name' || jobName.toLowerCase() === 'manuscript id') continue;

      const lowerJobName = jobName.toLowerCase();
      if (existingIds.has(lowerJobName) || currentBatchIds.has(lowerJobName)) {
        skippedCount++;
        continue;
      }

      const dueDateStr = parts[1]?.trim()?.replace(/^["']|["']$/g, '');
      const dateSentStr = parts[2]?.trim()?.replace(/^["']|["']$/g, '');
      const dateReturnedStr = parts[3]?.trim()?.replace(/^["']|["']$/g, '');
      const remarks = parts[4]?.trim()?.replace(/^["']|["']$/g, '') || '';

      const journalCode = jobName.includes('_') ? jobName.split('_')[0] : 'UNKNOWN';

      let status = Status.UNTOUCHED;
      if (dateReturnedStr && dateReturnedStr.trim() !== '') {
        status = Status.WORKED;
      } else if (remarks.toLowerCase().includes('query')) {
        status = Status.PENDING_JM; 
      }

      let priority: 'Normal' | 'High' | 'Urgent' = 'Normal';
      const remarksUpper = remarks.toUpperCase();
      if (remarksUpper.includes('URGENT')) priority = 'Urgent';
      else if (remarksUpper.includes('PRIORITY') || remarksUpper.includes('HIGH')) priority = 'High';

      const dateReceived = parseDate(dateSentStr) || new Date().toISOString();
      const dueDate = parseDate(dueDateStr) || undefined;
      const dateReturned = parseDate(dateReturnedStr);
      const dateStatusChanged = dateReturned || new Date().toISOString();
      
      const manuscript: Manuscript = {
        id: crypto.randomUUID(),
        manuscriptId: jobName,
        journalCode: journalCode,
        status: status,
        priority: priority,
        dateReceived: dateReceived,
        dueDate: dueDate,
        dateUpdated: new Date().toISOString(),
        dateStatusChanged: dateStatusChanged,
        completedDate: status === Status.WORKED ? (dateReturned || new Date().toISOString()) : undefined,
        dateQueried: status === Status.PENDING_JM ? (dateReceived || new Date().toISOString()) : undefined,
        queryReason: status === Status.PENDING_JM ? "Imported Query" : undefined,
        notes: []
      };

      if (remarks && remarks.toUpperCase() !== 'PRIORITY') {
        manuscript.notes.push({
          id: crypto.randomUUID(),
          content: `Remark: ${remarks}`,
          timestamp: Date.now()
        });
      }

      newItems.push(manuscript);
      currentBatchIds.add(lowerJobName);
    }

    return { newItems, skippedCount };
  }, [text, existingManuscripts]);

  const processImport = () => {
    setError(null);
    if (importPreview.newItems.length === 0) {
      if (importPreview.skippedCount > 0) {
        setError(`All ${importPreview.skippedCount} items were duplicates and skipped.`);
      } else {
        setError("Please paste some valid data first.");
      }
      return;
    }

    setIsClosing(true);
    setTimeout(() => {
      onImport(importPreview.newItems);
      onClose();
    }, 200);
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bulk Import</h2>
              <p className="text-sm text-slate-500 font-medium italic">Paste rows directly from Excel or Google Sheets</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800">
            <p className="font-bold mb-1.5 flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4" /> Expected columns (Tab-separated):
            </p>
            <div className="font-mono bg-white/60 p-2.5 rounded-lg border border-indigo-100 flex items-center gap-2 justify-between">
              <span>Job Name</span> <ArrowRight className="w-3 h-3 opacity-30" />
              <span>Due Date</span> <ArrowRight className="w-3 h-3 opacity-30" />
              <span>Date Sent</span> <ArrowRight className="w-3 h-3 opacity-30" />
              <span>Date Returned</span> <ArrowRight className="w-3 h-3 opacity-30" />
              <span>Remarks</span>
            </div>
          </div>

          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste data here...\n\nExample:\nJRNL_123\t01-Jan\t30-Dec\t\tPending Query\n...`}
              className="w-full h-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all resize-none custom-scrollbar"
            />
          </div>

          {/* Import Summary / Verification Area */}
          {text.trim() && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fade-in-up">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Import</span>
                  <span className="text-lg font-black text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> {importPreview.newItems.length} items
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duplicates Skipped</span>
                  <span className={`text-lg font-black ${importPreview.skippedCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                    {importPreview.skippedCount}
                  </span>
                </div>
              </div>
              
              {importPreview.newItems.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                  <Info className="w-3.5 h-3.5" />
                  IDs validated
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-center gap-3 text-sm font-bold animate-pulse">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 text-slate-600 hover:bg-white hover:shadow-sm rounded-xl font-bold transition-all border border-transparent hover:border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={processImport}
            disabled={importPreview.newItems.length === 0}
            className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-black transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50 disabled:grayscale disabled:shadow-none active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;