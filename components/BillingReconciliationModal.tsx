import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import { Manuscript, Status } from '../types';
import { X, ClipboardList, AlertTriangle, CheckCircle, ArrowRight, Copy, Search, FileText, ExternalLink, HelpCircle, FileCheck, Globe, Calculator, Coins, TrendingUp, DollarSign, RefreshCcw, HandMetal, ArrowUpRight, BarChart3 } from 'lucide-react';

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
  const [listSearch, setListSearch] = useState('');
  const [confirmClaim, setConfirmClaim] = useState<{ id: string; label: string; date: string } | null>(null);
  
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

  const filteredList = useMemo(() => {
    const search = listSearch.toLowerCase();
    if (activeTab === 'matched') {
      return billingAnalysis.matched.filter(m => 
        m.manuscriptId.toLowerCase().includes(search) || 
        m.journalCode.toLowerCase().includes(search)
      );
    }
    if (activeTab === 'missing') {
      return billingAnalysis.unbilled.filter(m => 
        m.manuscriptId.toLowerCase().includes(search) || 
        m.journalCode.toLowerCase().includes(search)
      );
    }
    return billingAnalysis.extra.filter(item => 
      item.id.toLowerCase().includes(search) || 
      (item.manuscript?.journalCode.toLowerCase().includes(search))
    );
  }, [activeTab, billingAnalysis, listSearch]);

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

  const handleCopyMatched = () => {
    const text = billingAnalysis.matched.map(m => m.manuscriptId).join('\n');
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleClaimExtra = (mId: string) => {
    if (!selectedCycleData) return;
    const targetDate = selectedCycleData.info.startDate.toISOString();
    setConfirmClaim({ id: mId, label: selectedCycleData.info.label, date: targetDate });
  };

  const executeClaim = () => {
    if (!confirmClaim) return;
    onBulkUpdate?.([confirmClaim.id], { status: Status.BILLED, billedDate: confirmClaim.date });
    setConfirmClaim(null);
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
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 shadow-inner">
                     <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <RefreshCcw className="w-10 h-10 text-indigo-400" />
                     </div>
                     <h3 className="text-xl font-bold text-slate-800 mb-2">Ready for Reconciliation</h3>
                     <p className="text-sm text-slate-500 max-w-sm leading-relaxed">Paste your billed IDs from the publisher report into the input field on the left to begin the reconciliation process.</p>
                  </div>
               ) : (
                  <div className="flex flex-col h-full space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="md:col-span-8 bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-8 rounded-[2rem] shadow-2xl flex items-center gap-8 text-white relative overflow-hidden group border border-indigo-500/20"
                        >
                           <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 group-hover:scale-110 transition-transform duration-700">
                              <Coins className="w-48 h-48" />
                           </div>
                           <div className="p-5 bg-white/10 rounded-3xl shrink-0 backdrop-blur-xl border border-white/20 shadow-inner">
                              <TrendingUp className="w-10 h-10 text-indigo-200" />
                           </div>
                           <div className="flex-1 relative z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] opacity-80">Salary Projection</span>
                                <div className="h-px flex-1 bg-white/10" />
                              </div>
                              <div className="flex items-baseline gap-3">
                                 <h3 className="text-5xl font-black tracking-tighter drop-shadow-sm">₱{salaryProjection.totalPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                              </div>
                              <div className="mt-5 flex items-center gap-4">
                                 <div className="px-3 py-1.5 bg-black/30 rounded-xl backdrop-blur-md border border-white/10 flex items-center gap-2 text-emerald-400 shadow-sm">
                                    <FileCheck className="w-3.5 h-3.5" /> 
                                    <span className="text-xs font-black uppercase tracking-wider">{salaryProjection.billedCount} Confirmed</span>
                                 </div>
                                 <div className="px-3 py-1.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/5 text-indigo-100 shadow-sm">
                                    <span className="text-xs font-bold">${salaryProjection.totalUsd.toFixed(2)} USD</span>
                                 </div>
                              </div>
                           </div>
                        </motion.div>

                        <div className="md:col-span-4 flex flex-col gap-4">
                           <motion.div 
                             initial={{ x: 20, opacity: 0 }}
                             animate={{ x: 0, opacity: 1 }}
                             transition={{ delay: 0.1 }}
                             className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden"
                           >
                              <div className="absolute top-0 right-0 p-3 opacity-5">
                                <BarChart3 className="w-12 h-12 text-indigo-600" />
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reconciliation Rate</p>
                              <div className="flex items-end gap-2">
                                <p className="text-3xl font-black text-indigo-600">{Math.round((billingAnalysis.foundCount / billingAnalysis.totalInCycle) * 100)}%</p>
                                <p className="text-[10px] font-bold text-slate-400 mb-1.5">of cycle</p>
                              </div>
                              <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(billingAnalysis.foundCount / billingAnalysis.totalInCycle) * 100}%` }}
                                  className="h-full bg-indigo-500 rounded-full"
                                />
                              </div>
                           </motion.div>
                           <motion.div 
                             initial={{ x: 20, opacity: 0 }}
                             animate={{ x: 0, opacity: 1 }}
                             transition={{ delay: 0.2 }}
                             className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex-1 flex flex-col justify-center bg-rose-50/20 relative overflow-hidden"
                           >
                              <div className="absolute top-0 right-0 p-3 opacity-5">
                                <AlertTriangle className="w-12 h-12 text-rose-600" />
                              </div>
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Mismatched Status</p>
                              <p className="text-3xl font-black text-rose-600">{billingAnalysis.statusMismatches}</p>
                              <p className="text-[10px] font-bold text-rose-400/60 mt-1 uppercase">Needs 'Billed' update</p>
                           </motion.div>
                        </div>
                     </div>

                     <div className="flex-1 min-h-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="border-b border-slate-100 flex flex-col md:flex-row p-2 bg-slate-50/50 gap-2">
                           <div className="flex p-1 bg-slate-200/50 rounded-xl flex-1">
                              <button onClick={() => { setActiveTab('matched'); setListSearch(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'matched' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Matched ({billingAnalysis.matched.length})</button>
                              <button onClick={() => { setActiveTab('missing'); setListSearch(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'missing' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>Missing ({billingAnalysis.unbilled.length})</button>
                              <button onClick={() => { setActiveTab('extra'); setListSearch(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'extra' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>Extra ({billingAnalysis.extra.length})</button>
                           </div>
                           <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input 
                                type="text"
                                placeholder="Filter list..."
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 w-full md:w-48 transition-all"
                                value={listSearch}
                                onChange={e => setListSearch(e.target.value)}
                              />
                           </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                           <AnimatePresence mode="wait">
                             <motion.div
                               key={activeTab}
                               initial={{ opacity: 0, x: 10 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -10 }}
                               transition={{ duration: 0.2 }}
                             >
                               {activeTab === 'matched' ? (
                                  billingAnalysis.matched.length > 0 ? (
                                    <div className="space-y-6">
                                       <div className="flex justify-between items-center px-1">
                                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                             <div className="p-1.5 bg-emerald-100 rounded-lg">
                                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                             </div>
                                             <span>Successfully matched <strong>{billingAnalysis.foundCount}</strong> items.</span>
                                          </div>
                                          <button onClick={handleCopyMatched} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${copyFeedback ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{copyFeedback ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}Copy Matched</button>
                                       </div>
                                       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                          {filteredList.map(m => {
                                             const manuscript = m as Manuscript;
                                             return (
                                             <motion.div 
                                                layout
                                                key={manuscript.id} 
                                                className={`p-4 border rounded-2xl transition-all group hover:shadow-md ${manuscript.status === Status.BILLED ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white border-rose-200 shadow-sm ring-1 ring-rose-50'}`}
                                             >
                                                <div className="flex justify-between items-start">
                                                   <div>
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-black text-slate-800 text-sm tracking-tight">{manuscript.manuscriptId}</p>
                                                        <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                      </div>
                                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{manuscript.journalCode}</p>
                                                   </div>
                                                   <div className="text-right flex flex-col items-end">
                                                      <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${manuscript.status === Status.BILLED ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'}`}>
                                                        {manuscript.status === Status.BILLED ? 'BILLED' : 'WORKED'}
                                                      </div>
                                                      <p className={`text-xs mt-2 font-black font-mono ${manuscript.status === Status.BILLED ? 'text-emerald-600' : 'text-rose-600'}`}>+₱{currentRates.php.toFixed(2)}</p>
                                                   </div>
                                                </div>
                                             </motion.div>
                                          )})}
                                       </div>
                                    </div>
                                  ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-50">
                                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                          <Search className="w-10 h-10 text-slate-200" />
                                       </div>
                                       <p className="text-sm text-slate-500 font-bold">No matches found</p>
                                       <p className="text-xs text-slate-400 mt-1">Try selecting a different cycle or check your input.</p>
                                    </div>
                                  )
                               ) : activeTab === 'missing' ? (
                                  billingAnalysis.unbilled.length > 0 ? (
                                     <div className="space-y-6">
                                        <div className="flex justify-between items-center px-1">
                                           <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                              <div className="p-1.5 bg-rose-100 rounded-lg">
                                                 <AlertTriangle className="w-4 h-4 text-rose-600" />
                                              </div>
                                              <span>Unclaimed: <strong className="text-rose-600">₱{(billingAnalysis.unbilled.length * currentRates.php).toFixed(2)}</strong></span>
                                           </div>
                                           <button onClick={handleCopyUnbilled} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${copyFeedback ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>{copyFeedback ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}Copy Missing</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                           {filteredList.map(m => {
                                              const manuscript = m as Manuscript;
                                              return (
                                              <motion.div layout key={manuscript.id} className="p-4 bg-white border border-rose-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                                 <div className="flex justify-between items-start">
                                                    <div>
                                                       <p className="font-black text-slate-800 text-sm tracking-tight mb-1">{manuscript.manuscriptId}</p>
                                                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{manuscript.journalCode}</p>
                                                    </div>
                                                    <div className="text-right">
                                                       <p className="text-[9px] text-rose-600 font-black uppercase bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">{manuscript.status.replace(/_/g, ' ')}</p>
                                                       <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">{new Date(manuscript.completedDate || manuscript.dateStatusChanged || '').toLocaleDateString()}</p>
                                                    </div>
                                                 </div>
                                              </motion.div>
                                           )})}
                                        </div>
                                     </div>
                                  ) : (
                                     <div className="h-full flex flex-col items-center justify-center text-center py-20">
                                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                                           <CheckCircle className="w-10 h-10 text-emerald-500" />
                                        </div>
                                        <h4 className="font-black text-slate-800 text-lg">Perfect Sync</h4>
                                        <p className="text-sm text-slate-500 max-w-xs mt-2 font-medium">Your work matches the billing report perfectly. No missing items found.</p>
                                     </div>
                                  )
                               ) : (
                                  billingAnalysis.extra.length > 0 ? (
                                     <div className="space-y-6">
                                        <div className="flex items-center gap-3 text-xs text-slate-500 px-1 font-medium">
                                           <div className="p-1.5 bg-amber-100 rounded-lg">
                                              <HelpCircle className="w-4 h-4 text-amber-600" />
                                           </div>
                                           <span>IDs found in the report but <strong>not</strong> in this cycle's database.</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                           {filteredList.map((item: any, idx) => (
                                              <motion.div layout key={idx} className={`p-4 rounded-2xl border transition-all hover:shadow-md ${item.type === 'other_cycle' ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                                                 <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                       <p className="font-black text-slate-800 text-sm tracking-tight mb-2">{item.id}</p>
                                                       {item.type === 'other_cycle' ? (
                                                          <div className="flex flex-col gap-2">
                                                             <span className="text-[9px] px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-black uppercase tracking-widest flex items-center gap-1.5 w-fit border border-amber-200">
                                                                <ExternalLink className="w-3 h-3" /> Found in {item.cycleLabel}
                                                             </span>
                                                             {item.manuscript && (
                                                                <button 
                                                                   onClick={() => handleClaimExtra(item.manuscript!.id)}
                                                                   className="text-[10px] font-black uppercase text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl flex items-center gap-2 transition-all w-fit shadow-lg shadow-amber-200 active:scale-95"
                                                                >
                                                                   <HandMetal className="w-3.5 h-3.5" /> Claim Credit
                                                                </button>
                                                             )}
                                                          </div>
                                                       ) : (
                                                          <span className="text-[9px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-black uppercase tracking-widest border border-slate-200">Not in database</span>
                                                       )}
                                                    </div>
                                                    <div className="text-right">
                                                       <p className={`text-[9px] font-black uppercase tracking-widest ${item.type === 'other_cycle' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                          {item.type === 'other_cycle' ? 'PREV CYCLE' : 'NOT FOUND'}
                                                       </p>
                                                    </div>
                                                 </div>
                                              </motion.div>
                                           ))}
                                        </div>
                                     </div>
                                  ) : (
                                     <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-50">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                           <CheckCircle className="w-10 h-10 text-slate-400" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-bold">No extra IDs found</p>
                                        <p className="text-xs text-slate-400 mt-1">The report doesn't contain any IDs outside this cycle.</p>
                                     </div>
                                  )
                               )}
                             </motion.div>
                           </AnimatePresence>
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
        <ConfirmDialog 
          isOpen={!!confirmClaim}
          title="Claim Manuscript"
          message={`Claim ${confirmClaim?.id} for the ${confirmClaim?.label} cycle? This will move its financial credit to this cycle while keeping its work history.`}
          onConfirm={executeClaim}
          onCancel={() => setConfirmClaim(null)}
          variant="info"
          confirmLabel="Claim Now"
        />
      </div>
    </div>
  );
};

export default BillingReconciliationModal;