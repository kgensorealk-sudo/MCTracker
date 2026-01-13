import React, { useState, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { X, ClipboardList, AlertTriangle, CheckCircle, ArrowRight, Copy, Search, FileText, ExternalLink, HelpCircle, FileCheck, Globe, Calculator, Coins, TrendingUp, DollarSign, RefreshCcw, HandMetal } from 'lucide-react';

interface RateProfile {
  usd: number;
  php: number;
}

interface BillingReconciliationModalProps {
  manuscripts: Manuscript[];
  onClose: () => void;
  sortedCycles: { info: any; files: Manuscript[] }[];
  initialCycleId?: string;
  onBulkUpdate?: (ids: string[], updates: Partial<Manuscript>) => void;
  cycleRates: Record<string, RateProfile>;
  onUpdateRate: (id: string, rates: RateProfile) => void;
}

const DEFAULT_RATES: RateProfile = { usd: 1.19, php: 70.41 };

const BillingReconciliationModal: React.FC<BillingReconciliationModalProps> = ({ 
  manuscripts,
  onClose, 
  sortedCycles,
  initialCycleId,
  onBulkUpdate,
  cycleRates,
  onUpdateRate
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || (sortedCycles.length > 0 ? sortedCycles[0].info.id : ''));
  const [billingInput, setBillingInput] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'missing' | 'extra'>('matched');
  
  const currentRates = useMemo(() => 
    cycleRates[selectedCycleId] || DEFAULT_RATES, 
  [cycleRates, selectedCycleId]);

  const selectedCycleData = useMemo(() => 
    sortedCycles.find(c => c.info.id === selectedCycleId), 
  [sortedCycles, selectedCycleId]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const billingAnalysis = useMemo(() => {
    const emptyResult = { unbilled: [], extra: [], matched: [], foundCount: 0, totalInCycle: 0, statusMismatches: 0 };
    if (!selectedCycleId || sortedCycles.length === 0) return emptyResult;
    
    if (!selectedCycleData || !selectedCycleData.files) return emptyResult;

    const rawInputLines = billingInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    
    const billedIdsSet = new Set(rawInputLines.map(id => id.toLowerCase()));

    const cycleFiles = selectedCycleData.files;
    const matched = cycleFiles.filter(m => billedIdsSet.has(m.manuscriptId.toLowerCase()));
    const statusMismatches = matched.filter(m => m.status === Status.WORKED).length;
    const unbilled = cycleFiles.filter(m => !billedIdsSet.has(m.manuscriptId.toLowerCase()));
    
    const cycleFileIdsSet = new Set(cycleFiles.map(m => m.manuscriptId.toLowerCase()));
    const extraIds = rawInputLines.filter(id => !cycleFileIdsSet.has(id.toLowerCase()));

    const extraCategorized = extraIds.map(id => {
      const lowerId = id.toLowerCase();
      const match = manuscripts.find(m => m.manuscriptId.toLowerCase() === lowerId);
      
      if (match) {
        const actualCycle = sortedCycles.find(c => c.files.some(f => f.id === match.id));
        return {
          id,
          manuscript: match,
          type: 'other_cycle' as const,
          cycleLabel: actualCycle?.info.label || 'Unknown Cycle'
        };
      }
      return { id, type: 'unknown' as const };
    });
    
    return { unbilled, extra: extraCategorized, matched, foundCount: matched.length, totalInCycle: cycleFiles.length, statusMismatches };
  }, [billingInput, selectedCycleId, sortedCycles, manuscripts, selectedCycleData]);

  const salaryProjection = useMemo(() => {
    const billedCount = billingAnalysis.matched.length;
    const totalPhp = billedCount * currentRates.php;
    const totalUsd = billedCount * currentRates.usd;
    const impliedFxRate = currentRates.usd > 0 ? currentRates.php / currentRates.usd : 0;
    return { totalPhp, totalUsd, billedCount, impliedFxRate };
  }, [billingAnalysis.matched, currentRates]);

  const handleCopyUnbilled = () => {
    const text = billingAnalysis.unbilled.map(m => m.manuscriptId).join('\n');
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleFinishReconciliation = () => {
    const idsToMarkBilled = billingAnalysis.matched
      .filter(m => m.status === Status.WORKED)
      .map(m => m.id);

    if (idsToMarkBilled.length > 0) {
      const targetBilledDate = selectedCycleData?.info.startDate.toISOString() || new Date().toISOString();
      onBulkUpdate?.(idsToMarkBilled, { 
        status: Status.BILLED, 
        billedDate: targetBilledDate 
      });
    }

    handleClose();
  };

  const handleClaimExtra = (mId: string) => {
    if (!selectedCycleData) return;
    const targetDate = selectedCycleData.info.startDate.toISOString();
    if (window.confirm(`Claim ${mId} for the ${selectedCycleData.info.label} cycle? This will move its financial credit to this cycle while keeping its work history.`)) {
        const item = manuscripts.find(m => m.id === mId);
        if (item) {
            onBulkUpdate?.([mId], { status: Status.BILLED, billedDate: targetDate });
        }
    }
  };

  const updateRate = (key: keyof RateProfile, val: number) => {
    onUpdateRate(selectedCycleId, { ...currentRates, [key]: val });
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Billing Reconciliation</h2>
              <p className="text-sm text-slate-500 font-medium">Sync confirmed files and calculate expected salary.</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            <div className="lg:col-span-4 space-y-6">
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                       <Search className="w-3.5 h-3.5" /> Select Cycle
                    </label>
                    <select 
                      className="w-full text-sm border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-indigo-500 py-3 px-4 font-semibold text-slate-700 transition-all"
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
                       <FileText className="w-3.5 h-3.5" /> Billed ID List
                    </label>
                    <textarea 
                      className="w-full h-40 text-sm font-mono p-4 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none custom-scrollbar leading-relaxed"
                      placeholder="Paste IDs from publisher report here..."
                      value={billingInput}
                      onChange={(e) => setBillingInput(e.target.value)}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       <Calculator className="w-3.5 h-3.5" /> Rate Configuration (This Cycle)
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                             <DollarSign className="w-2.5 h-2.5" /> Rate/Item (USD)
                          </label>
                          <input 
                             type="number" 
                             step="0.0001"
                             className="w-full text-sm border-slate-200 rounded-lg bg-slate-50 py-2 px-3 font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                             value={currentRates.usd}
                             onChange={(e) => updateRate('usd', parseFloat(e.target.value) || 0)}
                          />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                             <Coins className="w-2.5 h-2.5" /> Rate/Item (PHP)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">₱</span>
                            <input 
                               type="number" 
                               step="0.01"
                               className="w-full text-sm border-slate-200 rounded-lg bg-slate-50 py-2 pl-6 pr-3 font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                               value={currentRates.php}
                               onChange={(e) => updateRate('php', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Implied FX Rate:</span>
                       </div>
                       <span className="text-sm font-bold text-indigo-700 font-mono">{salaryProjection.impliedFxRate.toFixed(4)}</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-8 flex flex-col min-h-0">
               {!billingInput ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 opacity-60">
                     <RefreshCcw className="w-12 h-12 text-slate-300 mb-4" />
                     <p className="text-slate-500 font-medium">Waiting for Input</p>
                     <p className="text-xs text-slate-400 mt-1 max-w-xs">Paste your billed IDs to identify status mismatches and calculate your expected salary.</p>
                  </div>
               ) : (
                  <div className="flex flex-col h-full space-y-6 animate-page-enter">
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-6 rounded-2xl shadow-xl flex items-center gap-6 text-white relative overflow-hidden group border border-indigo-500/20">
                           <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform">
                              <Coins className="w-32 h-32" />
                           </div>
                           <div className="p-4 bg-white/10 rounded-2xl shrink-0 backdrop-blur-md border border-white/20">
                              <TrendingUp className="w-8 h-8 text-indigo-200" />
                           </div>
                           <div className="flex-1">
                              <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1 opacity-80">Confirmed Salary Projection</p>
                              <div className="flex items-baseline gap-3">
                                 <h3 className="text-4xl font-black tracking-tighter">₱{salaryProjection.totalPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-[11px] font-bold">
                                 <span className="px-2 py-1 bg-black/30 rounded-lg backdrop-blur-sm border border-white/10 flex items-center gap-1.5 text-emerald-400">
                                    <FileCheck className="w-3 h-3" /> {salaryProjection.billedCount} Confirmed Billed
                                 </span>
                                 <span className="px-2 py-1 bg-white/10 rounded-lg backdrop-blur-sm border border-white/5 text-indigo-100">
                                    Gross: ${salaryProjection.totalUsd.toFixed(2)} USD
                                 </span>
                              </div>
                           </div>
                        </div>

                        <div className="md:col-span-4 flex flex-col gap-3">
                           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Matched</p>
                              <p className="text-xl font-bold text-indigo-600">{billingAnalysis.foundCount}</p>
                           </div>
                           <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex-1 flex flex-col justify-center bg-rose-50/20">
                              <p className="text-[10px] font-bold text-rose-400 uppercase mb-0.5">Needs Billing Status</p>
                              <p className="text-xl font-bold text-rose-600">{billingAnalysis.statusMismatches}</p>
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="border-b border-slate-100 flex p-1.5 bg-slate-50/50">
                           <button onClick={() => setActiveTab('matched')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'matched' ? 'bg-white shadow text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-white/50'}`}>Matched ({billingAnalysis.matched.length})</button>
                           <button onClick={() => setActiveTab('missing')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'missing' ? 'bg-white shadow text-rose-600 border border-rose-100' : 'text-slate-500 hover:bg-white/50'}`}>Missing ({billingAnalysis.unbilled.length})</button>
                           <button onClick={() => setActiveTab('extra')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'extra' ? 'bg-white shadow text-amber-600 border border-amber-100' : 'text-slate-500 hover:bg-white/50'}`}>Extra ({billingAnalysis.extra.length})</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/20">
                           {activeTab === 'matched' ? (
                              billingAnalysis.matched.length > 0 ? (
                                <div className="space-y-4">
                                   <div className="flex justify-between items-center px-1">
                                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                         <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         <span>Successfully matched {billingAnalysis.foundCount} items.</span>
                                         {billingAnalysis.statusMismatches > 0 && (
                                            <span className="text-rose-600 font-bold ml-1 flex items-center gap-1">
                                               <AlertTriangle className="w-3.5 h-3.5" /> {billingAnalysis.statusMismatches} need updating to 'Billed' status
                                            </span>
                                         )}
                                      </div>
                                   </div>
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {billingAnalysis.matched.map(m => (
                                         <div key={m.id} className={`p-3 border rounded-xl transition-all ${m.status === Status.BILLED ? 'bg-indigo-50/30 border-indigo-100 opacity-60' : 'bg-rose-50 border-rose-200 shadow-sm'}`}>
                                            <div className="flex justify-between items-start">
                                               <div>
                                                  <p className="font-bold text-slate-800 text-sm">{m.manuscriptId}</p>
                                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">{m.journalCode}</p>
                                               </div>
                                               <div className="text-right flex flex-col items-end">
                                                  <p className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${m.status === Status.BILLED ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700 animate-pulse'}`}>{m.status === Status.BILLED ? 'BILLED' : 'WORKED'}</p>
                                                  <p className={`text-[11px] mt-1.5 font-bold font-mono ${m.status === Status.BILLED ? 'text-emerald-600' : 'text-rose-600'}`}>+₱{currentRates.php.toFixed(2)}</p>
                                               </div>
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-50"><Search className="w-12 h-12 text-slate-300 mb-4" /><p className="text-sm text-slate-500 font-medium">No matches found in this cycle.</p></div>
                              )
                           ) : activeTab === 'missing' ? (
                              billingAnalysis.unbilled.length > 0 ? (
                                 <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                       <div className="flex items-center gap-2 text-xs text-slate-500 font-medium"><AlertTriangle className="w-4 h-4 text-rose-500" /><span>In our records but <strong>not</strong> in the list. Unclaimed: <strong>₱{(billingAnalysis.unbilled.length * currentRates.php).toFixed(2)}</strong></span></div>
                                       <button onClick={handleCopyUnbilled} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${copyFeedback ? 'bg-emerald-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>{copyFeedback ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}Copy Missing List</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       {billingAnalysis.unbilled.map(m => (
                                          <div key={m.id} className="p-3 bg-rose-50/20 border border-rose-100 rounded-xl transition-all">
                                             <div className="flex justify-between items-start">
                                                <div>
                                                   <p className="font-bold text-slate-800 text-sm">{m.manuscriptId}</p>
                                                   <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-tighter">{m.journalCode}</p>
                                                </div>
                                                <div className="text-right">
                                                   <p className="text-[10px] text-rose-600 font-bold uppercase bg-rose-50 px-1.5 py-0.5 rounded">{m.status.replace(/_/g, ' ')}</p>
                                                   <p className="text-[9px] text-slate-400 mt-2 font-medium">{new Date(m.completedDate || m.dateStatusChanged || '').toLocaleDateString()}</p>
                                                </div>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-center py-12"><CheckCircle className="w-12 h-12 text-emerald-500 mb-4" /><h4 className="font-bold text-slate-800">Perfect Sync</h4><p className="text-sm text-slate-500 max-w-xs mt-2 font-medium">Your work matches the billing report perfectly.</p></div>
                              )
                           ) : (
                              billingAnalysis.extra.length > 0 ? (
                                 <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 px-1 font-medium"><HelpCircle className="w-4 h-4 text-amber-500" /><span>IDs found in the list but <strong>not</strong> in the current cycle's database.</span></div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       {billingAnalysis.extra.map((item, idx) => (
                                          <div key={idx} className={`p-3 rounded-xl border transition-all ${item.type === 'other_cycle' ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                                             <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                   <p className="font-bold text-slate-800 text-sm">{item.id}</p>
                                                   {item.type === 'other_cycle' ? (
                                                      <div className="mt-1 flex flex-col gap-2">
                                                         <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase tracking-tight flex items-center gap-1 w-fit">
                                                            <ExternalLink className="w-2.5 h-2.5" /> Found in {item.cycleLabel}
                                                         </span>
                                                         {item.manuscript && (
                                                            <button 
                                                               onClick={() => handleClaimExtra(item.manuscript!.id)}
                                                               className="text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg flex items-center gap-1.5 transition-all w-fit shadow-sm active:scale-95"
                                                            >
                                                               <HandMetal className="w-3 h-3" /> Claim for This Cycle
                                                            </button>
                                                         )}
                                                      </div>
                                                   ) : (
                                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold mt-1 uppercase">Not in database</span>
                                                   )}
                                                </div>
                                                <div className="text-right">
                                                   <p className={`text-[10px] font-bold ${item.type === 'other_cycle' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                      {item.type === 'other_cycle' ? 'PREV CYCLE' : 'NOT FOUND'}
                                                   </p>
                                                </div>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-center py-12 opacity-50"><div className="p-4 bg-slate-100 rounded-full mb-4"><CheckCircle className="w-8 h-8 text-slate-400" /></div><p className="text-sm text-slate-500 font-medium">No extra IDs found in the report.</p></div>
                              )
                           )}
                        </div>
                     </div>
                  </div>
               )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end bg-white">
           <button 
              onClick={handleFinishReconciliation} 
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
           >
              Update Billed Status <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default BillingReconciliationModal;