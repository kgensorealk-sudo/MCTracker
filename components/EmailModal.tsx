import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Mail, Send } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkSent: () => void;
  recipient: string;
  subject: string;
  body: string;
}

export const EmailModal: React.FC<EmailModalProps> = ({ 
  isOpen, 
  onClose, 
  onMarkSent, 
  recipient, 
  subject, 
  body 
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSend = () => {
    onMarkSent();
    onClose();
  };

  useEffect(() => {
    // Move focus to modal primary action when opened
    initialFocusRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Draft Email</h3>
              <p className="text-xs text-slate-500">Copy details to your email client</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* To */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">To</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 truncate">
                {recipient}
              </div>
              <button 
                onClick={() => handleCopy(recipient, 'recipient')}
                className={`px-3 rounded-xl border transition-colors flex items-center gap-2 ${copiedField === 'recipient' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
              >
                {copiedField === 'recipient' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Subject</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 truncate">
                {subject}
              </div>
              <button 
                onClick={() => handleCopy(subject, 'subject')}
                className={`px-3 rounded-xl border transition-colors flex items-center gap-2 ${copiedField === 'subject' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
              >
                {copiedField === 'subject' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Body</label>
            <div className="relative">
              <textarea 
                readOnly
                value={body}
                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button 
                onClick={() => handleCopy(body, 'body')}
                className={`absolute top-2 right-2 p-2 rounded-lg border transition-colors ${copiedField === 'body' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200'}`}
              >
                {copiedField === 'body' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            ref={initialFocusRef}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            Mark as Sent
          </button>
        </div>

      </div>
    </div>
  );
};
