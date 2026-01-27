
import React, { useState, useMemo } from 'react';
import { Manuscript, Status } from '../types';
import { X, CheckCircle, Calendar, DollarSign, AlertCircle } from 'lucide-react';

interface BillingReconciliationModalProps {
  manuscripts: Manuscript[];
  onConfirm: (ids: string[], billedDate: string) => void;
  onClose: () => void;
}

const BillingReconciliationModal: React.FC<BillingReconciliationModalProps> = ({ manuscripts, onConfirm, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [billedDate, setBilledDate] = useState(new Date().toISOString().split('T')[0]);
  const [isClosing, setIsClosing] = useState(false);

  const workedFiles = useMemo(() => 
    manuscripts.filter(m => m.status === Status.WORKED),
    [manuscripts]
  );

  const handleToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === workedFiles.length) setSelectedIds([]);
    else setSelectedIds(workedFiles.map(m => m.id));
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  const handleConfirmAction = () => {
    if (selectedIds.length === 0) return;
    onConfirm(selectedIds, billedDate);
  };

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur sticky top-0 z-10">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Billing Reconcile</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Move worked files to Billed status</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          <div className="flex items-center justify-between bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-xl text-white">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Billing Cycle Date</label>
                  <input 
                    type="date" 
                    className="bg-transparent border-none p-0 text-indigo-900 font-black outline-none"
                    value={billedDate}
                    onChange={e => setBilledDate(e.target.value)}
                  />
                </div>
             </div>
             <button 
              onClick={handleSelectAll}
              className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black shadow-sm border border-indigo-100"
             >
               {selectedIds.length === workedFiles.length ? 'Deselect All' : 'Select All Worked'}
             </button>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Select Files to Reconcile ({workedFiles.length})</h4>
            {workedFiles.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-2xl">
                No "WORKED" files ready for billing.
              </div>
            ) : (
              workedFiles.map(m => (
                <div 
                  key={m.id} 
                  onClick={() => handleToggle(m.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${selectedIds.includes(m.id) ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.includes(m.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                      {selectedIds.includes(m.id) && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 leading-none mb-1">{m.manuscriptId}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{m.journalCode}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Completed</p>
                    <p className="text-xs font-bold text-slate-600">{m.completedDate ? new Date(m.completedDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-center gap-3 text-slate-500">
             <AlertCircle className="w-5 h-5 text-indigo-400" />
             <p className="text-xs font-medium">Selected files will be moved to <span className="text-indigo-600 font-black">BILLED</span> status permanently.</p>
          </div>
          <button 
            disabled={selectedIds.length === 0}
            onClick={handleConfirmAction}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Confirm Billing ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingReconciliationModal;
