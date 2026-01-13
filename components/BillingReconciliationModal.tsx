
import React, { useState, useMemo } from 'react';
import { Manuscript } from '../types';
import { X, ClipboardList, Info, AlertTriangle, CheckCircle, ArrowRight, Copy, Search, FileText } from 'lucide-react';

interface BillingReconciliationModalProps {
  manuscripts: Manuscript[];
  onClose: () => void;
  sortedCycles: { info: any; files: Manuscript[] }[];
  initialCycleId?: string;
}

const BillingReconciliationModal: React.FC<BillingReconciliationModalProps> = ({ 
  manuscripts, 
  onClose, 
  sortedCycles,
  initialCycleId 
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || (sortedCycles.length > 0 ? sortedCycles[0].info.id : ''));
  const [billingInput, setBillingInput] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const billingAnalysis = useMemo(() => {
    if (!selectedCycleId) return { unbilled: [], foundCount: 0, totalInCycle: 0 };
    
    const cycleData = sortedCycles.find(c => c.info.id === selectedCycleId);
    if (!cycleData) return { unbilled: [], foundCount: 0, totalInCycle: 0 };

    const billedIds = new Set(
      billingInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(id => id.toLowerCase())
    );

    const cycleFiles = cycleData.files;
    const unbilled = cycleFiles.filter(m => !billedIds.has(m.manuscriptId.toLowerCase()));
    
    return {
       unbilled,
       foundCount: cycleFiles.length - unbilled.length,
       totalInCycle: cycleFiles.length
    };
  }, [billingInput, selectedCycleId, sortedCycles]);

  const handleCopyUnbilled = () => {
    const text = billingAnalysis.unbilled.map(m => m.manuscriptId).join('\n');
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Billing Reconciliation</h2>
              <p className="text-sm text-slate-500 font-medium">Identify discrepancies between your records and billed files.</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            
            {/* Input Side */}
            <div className="lg:col-span-5 space-y-6">
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                       <Search className="w-3.5 h-3.5" /> 1. Select Cycle
                    </label>
                    <select 
                      className="w-full text-sm border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 py-3 px-4 font-semibold text-slate-700"
                      value={selectedCycleId}
                      onChange={(e) => setSelectedCycleId(e.target.value)}
                    >
                      {sortedCycles.map(c => (
                        <option key={c.info.id} value={c.info.id}>
                          {c.info.label} ({c.files.length} files)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                       <FileText className="w-3.5 h-3.5" /> 2. Paste Billed IDs
                    </label>
                    <textarea 
                      className="w-full h-64 text-sm font-mono p-4 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none custom-scrollbar leading-relaxed"
                      placeholder="Tfs_124519&#10;Sct_133166&#10;Est_120421&#10;..."
                      value={billingInput}
                      onChange={(e) => setBillingInput(e.target.value)}
                    />
                    <div className="mt-3 flex items-start gap-2 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                      <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-indigo-700 leading-normal font-medium">
                        Paste the raw list of IDs directly from your billing sheet. One ID per line.
                      </p>
                    </div>
                  </div>
               </div>
            </div>

            {/* Results Side */}
            <div className="lg:col-span-7 flex flex-col min-h-0">
               {!billingInput ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 opacity-60">
                     <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
                     <p className="text-slate-500 font-medium">Waiting for input...</p>
                     <p className="text-xs text-slate-400 mt-1 max-w-xs">Paste your billed IDs on the left to start the real-time comparison.</p>
                  </div>
               ) : (
                  <div className="flex flex-col h-full space-y-6 animate-page-enter">
                     {/* Stats Bar */}
                     <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">In Records</p>
                           <p className="text-xl font-bold text-slate-800">{billingAnalysis.totalInCycle}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                           <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Billed</p>
                           <p className="text-xl font-bold text-emerald-600">{billingAnalysis.foundCount}</p>
                        </div>
                        <div className={`p-4 rounded-xl border shadow-sm text-center transition-colors ${billingAnalysis.unbilled.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                           <p className={`text-[10px] font-bold uppercase mb-1 ${billingAnalysis.unbilled.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Unbilled</p>
                           <p className={`text-xl font-bold ${billingAnalysis.unbilled.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{billingAnalysis.unbilled.length}</p>
                        </div>
                     </div>

                     {/* Result Details */}
                     <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                           <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              {billingAnalysis.unbilled.length > 0 ? (
                                 <AlertTriangle className="w-4 h-4 text-rose-500" />
                              ) : (
                                 <CheckCircle className="w-4 h-4 text-emerald-500" />
                              )}
                              {billingAnalysis.unbilled.length > 0 ? 'Unbilled Items Detected' : 'All Accounts Match'}
                           </h3>
                           {billingAnalysis.unbilled.length > 0 && (
                              <button 
                                onClick={handleCopyUnbilled}
                                className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                  copyFeedback ? 'bg-emerald-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                }`}
                              >
                                {copyFeedback ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copyFeedback ? 'Copied' : 'Copy List'}
                              </button>
                           )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                           {billingAnalysis.unbilled.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 {billingAnalysis.unbilled.map(m => (
                                    <div key={m.id} className="p-3 bg-rose-50/30 border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors group">
                                       <div className="flex justify-between items-start">
                                          <div>
                                             <p className="font-bold text-slate-800 text-sm">{m.manuscriptId}</p>
                                             <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{m.journalCode}</p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-[10px] text-rose-600 font-bold">MISSING</p>
                                             <p className="text-[9px] text-slate-400 mt-1">{new Date(m.completedDate || '').toLocaleDateString()}</p>
                                          </div>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           ) : (
                              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                                 </div>
                                 <h4 className="font-bold text-slate-800 text-lg">Perfect Sync</h4>
                                 <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2">
                                    Every WORKED record in your system for this cycle is present in the billing list provided.
                                 </p>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-end bg-white">
           <button 
             onClick={handleClose}
             className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
           >
             Done Reconciling <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default BillingReconciliationModal;
