import React, { useState, useEffect } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { Key, X, Copy, Check, ShieldAlert, AlertTriangle } from 'lucide-react';
import { borgService } from '../services/borgService';

interface KeyExportModalProps {
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
}

const KeyExportModal: React.FC<KeyExportModalProps> = ({ repo, isOpen, onClose }) => {
  const [keyData, setKeyData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
        fetchKey();
    }
  }, [isOpen]);

  const fetchKey = async () => {
      setLoading(true);
      setError(null);
      let buffer = '';
      
      try {
          const success = await borgService.exportKey(
              repo.url, 
              (log) => buffer += log, 
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );

          if (success) {
              setKeyData(buffer);
          } else {
              setError("Failed to export key. Check connection or passphrase.");
          }
      } catch (e) {
          setError("Execution error.");
      } finally {
          setLoading(false);
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(keyData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
           
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600 dark:text-yellow-400">
                       <Key className="w-5 h-5" />
                   </div>
                   <div>
                       <h3 className="font-bold text-slate-800 dark:text-slate-100">Repository Key Recovery</h3>
                       <p className="text-xs text-slate-500 dark:text-slate-400">Export for {repo.name}</p>
                   </div>
               </div>
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X size={20} />
               </button>
           </div>

           <div className="p-6 flex-1 overflow-y-auto">
               <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex gap-3">
                   <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                   <div className="text-sm text-yellow-800 dark:text-yellow-200">
                       <strong>Important:</strong> If you lose this key AND your passphrase, your data is permanently lost.
                       Store this output in a secure location (e.g. printed on paper in a safe, or a password manager).
                   </div>
               </div>

               {loading ? (
                   <div className="py-12 text-center text-slate-500 dark:text-slate-400 animate-pulse">
                       Retrieving key from repository...
                   </div>
               ) : error ? (
                   <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm text-center">
                       {error}
                       <div className="mt-2">
                           <Button size="sm" onClick={fetchKey} variant="secondary">Retry</Button>
                       </div>
                   </div>
               ) : (
                   <div className="relative group">
                       <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all border border-slate-700 shadow-inner">
                           {keyData}
                       </pre>
                       <button 
                           onClick={handleCopy}
                           className="absolute top-3 right-3 p-2 bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-600 transition-colors shadow-sm flex items-center gap-2 text-xs font-medium"
                       >
                           {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                           {copied ? "Copied" : "Copy"}
                       </button>
                   </div>
               )}
           </div>

           <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end">
               <Button onClick={onClose}>Close</Button>
           </div>
       </div>
    </div>
  );
};

export default KeyExportModal;