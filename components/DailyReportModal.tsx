
import React, { useState, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { X, Mail, Send, CheckCircle, Clock, ListChecks, Copy, Eye, Check, Table, ClipboardCheck, ArrowRight, ArrowLeft, User, Users, Tag } from 'lucide-react';

interface DailyReportModalProps {
  manuscripts: Manuscript[];
  onClose: () => void;
  onMarkReported: (ids: string[]) => void;
}

const DailyReportModal: React.FC<DailyReportModalProps> = ({ manuscripts, onClose, onMarkReported }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // Report constants
  const REPORT_TO = 'dgteesabotypesetleads@straive.com';
  const REPORT_CC = 'ESJrnlsG2Supv@straive.com, lordthee.enmacino@straive.com, Rea.Cinco@straive.com';

  // Filter files with activity today
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

  const formatDateShort = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear().toString().slice(-2)}`;
  };

  const selectedFiles = useMemo(() => 
    todayFiles.filter(m => selectedIds.has(m.id)), 
    [todayFiles, selectedIds]
  );

  const subjectLine = useMemo(() => 
    selectedFiles.map(m => m.manuscriptId).join(', '),
    [selectedFiles]
  );

  const getRemark = (m: Manuscript) => {
    let remark = "";
    if (m.status === Status.WORKED) {
      remark = "Done";
    } else {
      remark = m.status === Status.PENDING_JM ? "with JM Query" : 
               m.status === Status.PENDING_TL ? "with TL Query" : 
               m.status === Status.PENDING_CED ? "Emailed CED" : "Pending";
    }

    if (m.notes && m.notes.length > 0) {
      const lastNote = m.notes[0].content;
      const normalized = lastNote.toLowerCase();
      if (normalized !== 'done' && normalized !== 'resolved') {
        remark = (remark === "Done" || !remark) ? lastNote : `${remark} | ${lastNote}`;
      }
    }
    return remark;
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleCopyForEmail = async () => {
    if (selectedFiles.length === 0) return;

    // 1. Generate Plain Text Version
    let plainText = "Please see the files below with remarks\n\n";
    plainText += "Articles\tDate Received\tDate Submitted\tRemarks\n";
    selectedFiles.forEach(m => {
      const dateRec = formatDateShort(m.dateReceived);
      const dateSub = m.status === Status.WORKED ? formatDateShort(m.completedDate || m.dateStatusChanged) : "Pending";
      plainText += `${m.manuscriptId}\t${dateRec}\t${dateSub}\t${getRemark(m)}\n`;
    });
    plainText += "\nThanks!";

    // 2. Generate HTML Table Version (For perfect pasting in Gmail/Outlook) - CENTERED DATA
    const htmlTable = `
      <p>Please see the files below with remarks</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif; width: 100%; max-width: 800px; text-align: center;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th align="center">Articles</th>
            <th align="center">Date Received</th>
            <th align="center">Date Submitted</th>
            <th align="center">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${selectedFiles.map(m => `
            <tr>
              <td align="center">${m.manuscriptId}</td>
              <td align="center">${formatDateShort(m.dateReceived)}</td>
              <td align="center">${m.status === Status.WORKED ? formatDateShort(m.completedDate || m.dateStatusChanged) : "<i>Pending</i>"}</td>
              <td align="center">${getRemark(m)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p>Thanks!</p>
    `;

    try {
      const blobHtml = new Blob([htmlTable], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
      await navigator.clipboard.write(data);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      // Fallback for browsers not supporting ClipboardItem fully
      navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFinish = () => {
    onMarkReported(Array.from(selectedIds));
    handleClose();
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 z-50 ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shadow-lg transition-colors ${step === 'preview' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
              {step === 'preview' ? <Table className="w-6 h-6 text-white" /> : <Mail className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {step === 'select' ? 'Select Files for Report' : 'End of Day Draft'}
              </h2>
              <p className="text-sm text-slate-500">
                {step === 'select' ? 'Daily activity summary' : 'Ready to be pasted into your email client'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
          {todayFiles.length === 0 ? (
            <div className="py-16 text-center">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-slate-600 font-bold text-lg">Nothing to report yet</p>
               <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">Complete files or raise queries to generate your EOD report.</p>
            </div>
          ) : step === 'select' ? (
            <div className="space-y-4">
               <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <ListChecks className="w-4 h-4" /> Today's Touched Files ({todayFiles.length})
                  </span>
                  <button 
                    onClick={() => setSelectedIds(selectedIds.size === todayFiles.length ? new Set() : new Set(todayFiles.map(m => m.id)))}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    {selectedIds.size === todayFiles.length ? 'Deselect All' : 'Select All'}
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {todayFiles.map(m => (
                   <div 
                     key={m.id} 
                     onClick={() => toggleSelect(m.id)}
                     className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                       selectedIds.has(m.id) ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-white bg-white hover:border-slate-200 shadow-sm'
                     }`}
                   >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedIds.has(m.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'
                      }`}>
                        {selectedIds.has(m.id) && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800">{m.manuscriptId}</p>
                            {m.dateEmailed && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Reported</span>}
                         </div>
                         <p className="text-[10px] text-slate-400 font-mono uppercase">{m.journalCode}</p>
                      </div>
                      <div className="text-right">
                         <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${m.status === Status.WORKED ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {m.status.replace(/_/g, ' ')}
                         </span>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-page-enter">
              {/* Email Headers Section */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
                <div className="flex items-center p-3 gap-3">
                   <User className="w-4 h-4 text-slate-400 shrink-0" />
                   <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">To</span>
                      <p className="text-sm text-slate-800 truncate font-medium">{REPORT_TO}</p>
                   </div>
                   <button 
                    onClick={() => copyToClipboard(REPORT_TO, 'to')}
                    className={`p-2 rounded-lg transition-all ${copyStatus['to'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                   >
                     {copyStatus['to'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   </button>
                </div>
                <div className="flex items-center p-3 gap-3">
                   <Users className="w-4 h-4 text-slate-400 shrink-0" />
                   <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">CC</span>
                      <p className="text-sm text-slate-800 truncate font-medium">{REPORT_CC}</p>
                   </div>
                   <button 
                    onClick={() => copyToClipboard(REPORT_CC, 'cc')}
                    className={`p-2 rounded-lg transition-all ${copyStatus['cc'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                   >
                     {copyStatus['cc'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   </button>
                </div>
                <div className="flex items-center p-3 gap-3">
                   <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                   <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Subject</span>
                      <p className="text-sm text-slate-800 truncate font-medium">{subjectLine}</p>
                   </div>
                   <button 
                    onClick={() => copyToClipboard(subjectLine, 'subject')}
                    className={`p-2 rounded-lg transition-all ${copyStatus['subject'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                   >
                     {copyStatus['subject'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                   </button>
                </div>
              </div>

              {/* Centered Table Draft */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 self-start pl-2 flex items-center gap-2">
                   <Table className="w-4 h-4" /> Body Preview (Centered)
                </span>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-[95%]">
                   <table className="w-full text-xs text-center border-collapse table-auto">
                      <thead className="bg-slate-50 border-b border-slate-200">
                         <tr>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-center">Articles</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-center">Date Received</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-center">Date Submitted</th>
                            <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wider text-center">Remarks</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {selectedFiles.map(m => (
                           <tr key={m.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-semibold text-slate-800 text-center">{m.manuscriptId}</td>
                              <td className="px-4 py-3 text-slate-600 text-center">{formatDateShort(m.dateReceived)}</td>
                              <td className="px-4 py-3 text-slate-600 italic text-center">
                                 {m.status === Status.WORKED ? formatDateShort(m.completedDate || m.dateStatusChanged) : 'Pending'}
                              </td>
                              <td className="px-4 py-3 text-slate-600 text-center">{getRemark(m)}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 max-w-2xl mx-auto">
                 <div className="p-2 bg-emerald-100 rounded-lg shrink-0 h-fit">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-emerald-900">Format Summary</h4>
                    <p className="text-xs text-emerald-700 leading-relaxed text-center">
                       Headers (To/CC/Subject) can be copied individually using the icons above. The main table is captured when you click the large "Copy for Email" button below.
                    </p>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <div>
            {step === 'select' ? (
              <span className="text-sm font-bold text-slate-700">{selectedIds.size} items selected</span>
            ) : (
              <button onClick={() => setStep('select')} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                 <ArrowLeft className="w-4 h-4" /> Adjust Selection
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            {step === 'select' ? (
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setStep('preview')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center gap-2 active:scale-95"
              >
                Review Draft <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleCopyForEmail}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all border flex items-center gap-2 active:scale-95 ${
                    copied 
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200' 
                      : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Body Copied!' : 'Copy Body Table'}
                </button>
                <button
                  onClick={handleFinish}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 active:scale-95"
                >
                  Mark Reported & Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;
