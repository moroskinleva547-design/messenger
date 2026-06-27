import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

export function Toast() {
  const { toast } = useUiStore();
  const clearToast = () => useUiStore.getState().showToast('');

  if (!toast) return null;
  const Icon = icons[toast.type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: 50, x: '-50%' }}
        className={`fixed bottom-6 left-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${colors[toast.type]}`}
      >
        <Icon size={18} />
        <span className="text-sm font-medium">{toast.message}</span>
        <button onClick={clearToast} className="ml-2 opacity-60 hover:opacity-100">
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
