import React, { useState, useEffect } from 'react';
import { AlertCircle, X, MessageSquare, Send } from 'lucide-react';
import { Manuscript } from '../types';

interface QueryModalProps {
  isOpen: boolean;
  manuscript: Manuscript | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export const QueryModal: React.FC<QueryModalProps> = ({ isOpen, manuscript, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNote('');
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleSubmit = () => {
    setIsClosing(true);
    setTimeout(() => {
      onSubmit(note);
      setIsClosing(false);
    }, 200);
  };

  if (!isOpen || !manuscript) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
         <div className="bg-rose-50 p-4 border-b border-rose-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-rose-100 rounded-full">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
               </div>
               <div>
                  <h3 className="font-bold text-rose-900">Query to JM</h3>
                  <p className="text-xs text-rose-700">{manuscript.manuscriptId}</p>
               </div>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-rose-200 rounded-full text-rose-400 hover:text-rose-700 transition-colors">
               <X className="w-5 h-5" />
            </button>
         </div>
         <div className="p-6 text-center">
            <label className="block text-sm font-bold text-slate-700 mb-2">Query Details</label>
            <div className="relative">
              <MessageSquare className="absolute top-3 left-3 w-4 h-4 text-slate-400" />
              <textarea
                 className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-100 transition-all text-sm min-h-[100px] resize-none text-center"
                 placeholder="State the issue clearly..."
                 value={note}
                 onChange={(e) => setNote(e.target.value)}
                 autoFocus
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">This moves status to PENDING_JM</p>
         </div>
         <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
            <button onClick={handleClose} className="px-4 py-2 text-slate-600 hover:bg-white rounded-xl text-sm font-medium">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md shadow-rose-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"><Send className="w-4 h-4" /> Raise Query</button>
         </div>
      </div>
    </div>
  );
};
