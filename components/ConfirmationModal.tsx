import React, { useState } from 'react';
import { X, AlertTriangle, HelpCircle, CheckCircle, Info } from 'lucide-react';

export type ConfirmationVariant = 'danger' | 'primary' | 'warning' | 'success';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel
}) => {
  const [isClosing, setIsClosing] = useState(false);

  if (!isOpen && !isClosing) return null;

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
      setIsClosing(false);
    }, 200);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      onConfirm();
      setIsClosing(false);
    }, 200);
  };

  const colors = {
    danger: { bg: 'bg-red-50', icon: 'text-red-600', iconBg: 'bg-red-100', btn: 'bg-red-600 hover:bg-red-700 shadow-red-200' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', iconBg: 'bg-amber-100', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' },
    primary: { bg: 'bg-indigo-50', icon: 'text-indigo-600', iconBg: 'bg-indigo-100', btn: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' },
    success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', iconBg: 'bg-emerald-100', btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' }
  };

  const theme = colors[variant];
  const Icon = variant === 'danger' || variant === 'warning' ? AlertTriangle : (variant === 'success' ? CheckCircle : HelpCircle);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md ${isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 ${isClosing ? 'modal-content-exit' : 'modal-content-enter'}`}>
        <div className={`p-6 flex flex-col items-center text-center ${theme.bg}`}>
          <div className={`p-3 rounded-full ${theme.iconBg} mb-4`}>
            <Icon className={`w-8 h-8 ${theme.icon}`} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-white flex flex-col sm:flex-row-reverse gap-2">
          <button
            onClick={handleConfirm}
            className={`w-full sm:w-auto px-6 py-2.5 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 ${theme.btn}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={handleCancel}
            className="w-full sm:w-auto px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;