import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle, X, Clock, History, ChevronRight } from 'lucide-react';
import { Manuscript } from '../types';

interface BillingCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (billedDate: string) => void;
  manuscript: Manuscript | Manuscript[] | null;
}

export const BillingCycleModal: React.FC<BillingCycleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  manuscript
}) => {
  const [selectedOption, setSelectedOption] = useState<'current' | 'original' | 'custom'>('original');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

  if (!manuscript) return null;

  const isMultiple = Array.isArray(manuscript);
  const singleManuscript = !isMultiple ? manuscript as Manuscript : null;

  const handleConfirm = () => {
    let finalDate = new Date().toISOString();

    if (selectedOption === 'original') {
      if (isMultiple) {
        // For multiple, we'll let the App.tsx logic handle the individual original dates
        // by passing a special flag or just handling it there.
        // Actually, let's just pass 'original' as a string if we want to be clever,
        // but the prop says string (ISO).
        // Let's use a convention: if it's 'original', we'll pass an empty string or null
        // and let handleBulkUpdate handle it.
        onConfirm('original');
        return;
      } else {
        finalDate = singleManuscript?.completedDate || singleManuscript?.dateStatusChanged || new Date().toISOString();
      }
    } else if (selectedOption === 'custom') {
      finalDate = new Date(customDate).toISOString();
    } else {
      finalDate = new Date().toISOString();
    }

    onConfirm(finalDate);
  };

  const getCycleLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (day >= 11 && day <= 25) {
      return `${d.toLocaleString('default', { month: 'short' })} 11-25`;
    } else {
      if (day >= 26) {
        const next = new Date(year, month + 1, 1);
        return `${d.toLocaleString('default', { month: 'short' })} 26 - ${next.toLocaleString('default', { month: 'short' })} 10`;
      } else {
        const prev = new Date(year, month - 1, 1);
        return `${prev.toLocaleString('default', { month: 'short' })} 26 - ${d.toLocaleString('default', { month: 'short' })} 10`;
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
          >
            <div className="p-8 border-b border-slate-100 bg-indigo-50/30 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Billing Cycle</h3>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Select target cutoff</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Choose which billing cycle should credit {isMultiple ? `${(manuscript as Manuscript[]).length} files` : 'this file'}.
              </p>

              <div className="space-y-3">
                {/* Original Cycle Option */}
                <button
                  onClick={() => setSelectedOption('original')}
                  className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${
                    selectedOption === 'original' 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${selectedOption === 'original' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <History className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Retain Original Cycle</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase">
                      {isMultiple ? 'Use each file\'s completion date' : `Based on: ${getCycleLabel(singleManuscript?.completedDate || singleManuscript?.dateStatusChanged || new Date().toISOString())}`}
                    </p>
                  </div>
                  {selectedOption === 'original' && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                </button>

                {/* Current Cycle Option */}
                <button
                  onClick={() => setSelectedOption('current')}
                  className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${
                    selectedOption === 'current' 
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm' 
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${selectedOption === 'current' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Include in Current Cycle</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase">
                      Cutoff: {getCycleLabel(new Date().toISOString())}
                    </p>
                  </div>
                  {selectedOption === 'current' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                </button>

                {/* Custom Cycle Option */}
                <div className={`rounded-2xl border-2 transition-all ${
                  selectedOption === 'custom' 
                  ? 'border-amber-600 bg-amber-50/50 shadow-sm' 
                  : 'border-slate-100 bg-slate-50/30'
                }`}>
                  <button
                    onClick={() => setSelectedOption('custom')}
                    className="w-full p-4 text-left flex items-center gap-4"
                  >
                    <div className={`p-2 rounded-xl ${selectedOption === 'custom' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Choose Specific Date</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase">Select a date for target cycle</p>
                    </div>
                    {selectedOption === 'custom' && <CheckCircle className="w-5 h-5 text-amber-600" />}
                  </button>
                  
                  {selectedOption === 'custom' && (
                    <div className="px-4 pb-4 pt-0">
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        className="w-full p-3 rounded-xl border border-amber-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="mt-2 text-[9px] font-black text-amber-700 uppercase tracking-widest text-center">
                         Target: {getCycleLabel(new Date(customDate).toISOString())}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                Confirm Billed <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
