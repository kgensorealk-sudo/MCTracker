import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      button: 'bg-red-600 hover:bg-red-700 text-white',
      bg: 'bg-red-50'
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
      bg: 'bg-amber-50'
    },
    info: {
      icon: <AlertTriangle className="w-6 h-6 text-brand-600" />,
      button: 'bg-brand-600 hover:bg-brand-700 text-white',
      bg: 'bg-brand-50'
    }
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-2xl shrink-0 ${styles.bg}`}>
                {styles.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                  <button 
                    onClick={onCancel}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 flex flex-col sm:flex-row-reverse gap-3">
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${styles.button}`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
