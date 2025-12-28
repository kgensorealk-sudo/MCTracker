import React, { useState } from 'react';
import { Manuscript, Status } from '../types';
import { X, Upload, FileSpreadsheet, AlertTriangle, FileText } from 'lucide-react';

interface BulkImportModalProps {
  onImport: (manuscripts: Manuscript[]) => void;
  onClose: () => void;
  existingManuscripts: Manuscript[];
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onImport, onClose, existingManuscripts }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parseDate = (dateStr?: string): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const processImport = () => {
    setError(null);
    if (!text.trim()) {
      setError("Please paste some data first.");
      return;
    }

    try {
      const lines = text.trim().split('\n');
      const newManuscripts: Manuscript[] = [];
      let skippedCount = 0;
      
      // Create a Set of existing IDs for fast lookup (case-insensitive)
      const existingIds = new Set(existingManuscripts.map(m => m.manuscriptId.toLowerCase()));
      // Also track IDs being added in this batch to prevent duplicates within the paste itself
      const currentBatchIds = new Set<string>();

      // Skip header if detected
      const firstLineLower = lines[0].toLowerCase();
      const startIndex = (firstLineLower.includes('job name') || firstLineLower.includes('due date')) ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by tab (Excel/Sheets standard copy format)
        const parts = line.split('\t');
        
        // Skip if not enough data (at least Job Name required)
        if (parts.length < 1) continue;

        // Mapping based on: Job Name | Due Date | Date Sent | Date Returned | Remarks
        const jobName = parts[0]?.trim();
        if (!jobName) continue;

        // DUPLICATE CHECK
        const lowerJobName = jobName.toLowerCase();
        if (existingIds.has(lowerJobName) || currentBatchIds.has(lowerJobName)) {
          skippedCount++;
          continue;
        }

        const dueDateStr = parts[1]?.trim();
        const dateSentStr = parts[2]?.trim();
        const dateReturnedStr = parts[3]?.trim();
        const remarks = parts[4]?.trim() || '';

        // Extract Journal Code (e.g., BITEB_102489 -> BITEB)
        const journalCode = jobName.includes('_') ? jobName.split('_')[0] : 'UNKNOWN';

        // Determine Status
        let status = Status.UNTOUCHED; // Default is now UNTOUCHED
        if (dateReturnedStr) {
          status = Status.WORKED;
        } else if (remarks.toLowerCase().includes('query')) {
          status = Status.PENDING_JM; // Default "Query" import to JM Pending
        }

        // Determine Priority
        // Updated logic: 'PRIORITY' keyword no longer sets High priority per user request.
        let priority: 'Normal' | 'High' | 'Urgent' = 'Normal';
        const remarksUpper = remarks.toUpperCase();
        if (remarksUpper.includes('URGENT')) priority = 'Urgent';
        // else if (remarksUpper.includes('PRIORITY')) priority = 'High'; // Disabled

        // Dates
        const dateReceived = parseDate(dateSentStr) || new Date().toISOString();
        const dueDate = parseDate(dueDateStr) || undefined;
        // Status Change Date logic: 
        // If Returned, use Date Returned. 
        // If Queried/Pending, use today (as we are importing it now) or Date Sent if preferred.
        // We default to today for import time, unless Date Returned is explicit.
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
          issueTypes: [],
          notes: []
        };

        // Add Remarks as notes
        // Logic: Ignore "PRIORITY" string as a remark.
        if (remarks && remarks.toUpperCase() !== 'PRIORITY') {
          manuscript.notes.push({
            id: crypto.randomUUID(),
            content: `Remark: ${remarks}`,
            timestamp: Date.now()
          });
        }

        newManuscripts.push(manuscript);
        currentBatchIds.add(lowerJobName);
      }

      if (newManuscripts.length === 0 && skippedCount === 0) {
        setError("No valid rows found. Please ensure you are pasting directly from Excel/Sheets with 'Job Name' as the first column.");
        return;
      }

      if (newManuscripts.length === 0 && skippedCount > 0) {
        setError(`All ${skippedCount} items were duplicates and skipped.`);
        return;
      }

      // If we have valid items, perform import
      onImport(newManuscripts);
      
      // If some were skipped, alert the user but close on success
      if (skippedCount > 0) {
        alert(`Imported ${newManuscripts.length} items. Skipped ${skippedCount} duplicates.`);
      }
      
      onClose();

    } catch (err) {
      console.error(err);
      setError("Failed to parse data. Please check the format.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bulk Import</h2>
              <p className="text-sm text-slate-500">Paste rows from your spreadsheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Expected Column Order (Tab-separated):
            </p>
            <div className="font-mono bg-white/50 p-2 rounded border border-blue-100 mt-2">
              Job Name &nbsp;|&nbsp; Due Date &nbsp;|&nbsp; Date Sent &nbsp;|&nbsp; Date Returned &nbsp;|&nbsp; Remarks
            </div>
            <p className="mt-2 text-blue-600 text-xs">
              * "Job Name" maps to Manuscript ID & Journal.<br/>
              * <strong>Duplicates:</strong> Rows with existing Manuscript IDs will be skipped automatically.<br/>
              * "Date Returned" determines if status is 'Worked'.<br/>
              * "Remarks" containing 'URGENT' sets urgent priority.
            </p>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste your data here...\n\nExample:\nBITEB_102489\t1-Jan-26\t27-Dec-25\t\tURGENT\n...`}
            className="flex-1 w-full p-4 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
          />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg font-medium transition-all border border-transparent hover:border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={processImport}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Records
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;