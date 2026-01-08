
import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  duration?: number;
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (e: CustomEvent<Toast>) => {
      const newToast = e.detail;
      setToasts(prev => [...prev, newToast]);

      if (newToast.duration !== 0) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration || 4000);
      }
    };

    window.addEventListener('show-toast' as any, handleToast);
    return () => window.removeEventListener('show-toast' as any, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id}
          className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border flex items-start gap-3 animate-in slide-in-from-right-10 fade-in duration-300 ${
            toast.type === 'success' ? 'bg-white dark:bg-slate-800 border-green-500/20 text-slate-800 dark:text-slate-200' :
            toast.type === 'error' ? 'bg-white dark:bg-slate-800 border-red-500/20 text-slate-800 dark:text-slate-200' :
            'bg-white dark:bg-slate-800 border-blue-500/20 text-slate-800 dark:text-slate-200'
          }`}
        >
          <div className={`mt-0.5 ${
            toast.type === 'success' ? 'text-green-500' :
            toast.type === 'error' ? 'text-red-500' :
            'text-blue-500'
          }`}>
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            {toast.type === 'loading' && <Loader2 size={18} className="animate-spin" />}
          </div>
          
          <div className="flex-1 text-sm font-medium leading-relaxed">
            {toast.message}
          </div>

          <button 
            onClick={() => removeToast(toast.id)} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
