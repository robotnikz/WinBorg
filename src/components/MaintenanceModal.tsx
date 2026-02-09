import React, { useEffect, useRef, useState, useId } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { Trash2, HardDrive, AlertCircle, X, CheckCircle2, Loader2, Terminal } from 'lucide-react';
import { borgService } from '../services/borgService';
import { useModalFocusTrap } from '../utils/useModalFocus';

interface MaintenanceModalProps {
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
  onLog: (title: string, logs: string[]) => void;
  onRefreshRepo: (repo: Repository) => void;
}

type MaintenanceTab = 'prune' | 'compact';

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ repo, isOpen, onClose, onLog, onRefreshRepo }) => {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('prune');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLog, setCurrentLog] = useState<string>('');
    const titleId = useId();
    const repoNameId = useId();
  
  // Prune Settings
  const [keepDaily, setKeepDaily] = useState(7);
  const [keepWeekly, setKeepWeekly] = useState(4);
  const [keepMonthly, setKeepMonthly] = useState(6);

    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    useModalFocusTrap(isOpen, dialogRef, { initialFocusRef: closeButtonRef });

    useEffect(() => {
        if (!isOpen || isProcessing) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isProcessing, onClose]);

      if (!isOpen) return null;

  const handlePrune = async () => {
      setIsProcessing(true);
      setCurrentLog('Initializing Prune...');
      const logs: string[] = [];
      const logCollector = (l: string) => {
          logs.push(l);
          setCurrentLog(l);
      };

      try {
          const success = await borgService.prune(
              repo.url,
              { daily: keepDaily, weekly: keepWeekly, monthly: keepMonthly },
              logCollector,
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );
          
          onClose(); // Close this modal
          onLog(`Prune: ${repo.name}`, logs); // Open Terminal with logs
          
          if(success) onRefreshRepo(repo);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleCompact = async () => {
      setIsProcessing(true);
      setCurrentLog('Starting Compact process...');
      const logs: string[] = [];
      const logCollector = (l: string) => {
          logs.push(l);
          setCurrentLog(l);
      };

      try {
          const success = await borgService.compact(
              repo.url,
              logCollector,
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );
          
          onClose();
          onLog(`Compact: ${repo.name}`, logs);
          
          if(success) onRefreshRepo(repo);
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4"
            onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (!isProcessing) onClose();
            }}
        >
             <div
                 ref={dialogRef}
                 tabIndex={-1}
                 className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                 role="dialog"
                 aria-modal="true"
                 aria-labelledby={titleId}
                 aria-describedby={repoNameId}
             >
           
           {/* Header */}
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div>
                   <h3 id={titleId} className="font-bold text-slate-800 dark:text-slate-100">Repository Maintenance</h3>
                   <p id={repoNameId} className="text-xs text-slate-500 dark:text-slate-400">{repo.name}</p>
               </div>
                                                         <button ref={closeButtonRef} onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50" aria-label="Close" title="Close">
                 <X size={20} />
               </button>
           </div>

           {/* Tabs */}
           <div className="flex border-b border-gray-200 dark:border-slate-700">
               <button 
                  onClick={() => setActiveTab('prune')}
                  disabled={isProcessing}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'prune' 
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400' 
                      : 'text-slate-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
               >
                   Prune (Cleanup)
               </button>
               <button 
                  onClick={() => setActiveTab('compact')}
                  disabled={isProcessing}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'compact' 
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-400' 
                      : 'text-slate-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
               >
                   Compact (Free Space)
               </button>
           </div>

           <div className="p-6">
               
               {/* PROCESSING OVERLAY CONTENT */}
               {isProcessing ? (
                   <div className="flex flex-col items-center justify-center py-4 space-y-4">
                       <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                            <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin relative z-10" />
                       </div>
                       <div className="text-center space-y-1">
                           <h4 className="font-semibold text-slate-800 dark:text-slate-200 animate-pulse">
                               {activeTab === 'prune' ? 'Pruning Repository...' : 'Compacting Repository...'}
                           </h4>
                           <p className="text-xs text-slate-500 dark:text-slate-400">Please wait, this may take a while.</p>
                       </div>
                       
                       {/* Live Log Box */}
                       <div className="w-full mt-4 bg-slate-900 rounded-lg p-3 border border-slate-700">
                           <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold mb-1">
                               <Terminal className="w-3 h-3" /> Live Output
                           </div>
                           <div className="font-mono text-xs text-green-400 truncate">
                               {currentLog || 'Waiting for output...'}
                           </div>
                       </div>
                   </div>
               ) : (
                   <>
                       {activeTab === 'prune' && (
                           <div className="space-y-6">
                               <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3 flex gap-3 text-amber-800 dark:text-amber-200 text-xs">
                                   <AlertCircle className="w-5 h-5 shrink-0" />
                                   <p>
                                       Pruning permanently deletes old archives to save space. 
                                       Archives matching the rules below will be <b>kept</b>, others deleted.
                                   </p>
                               </div>

                               <div className="grid grid-cols-3 gap-4">
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Daily</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           value={keepDaily}
                                           onChange={e => setKeepDaily(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Weekly</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           value={keepWeekly}
                                           onChange={e => setKeepWeekly(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Monthly</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                           value={keepMonthly}
                                           onChange={e => setKeepMonthly(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                               </div>

                               <div className="pt-2">
                                   <Button onClick={handlePrune} className="w-full" variant="danger">
                                       Prune Repository Now
                                   </Button>
                               </div>
                           </div>
                       )}

                       {activeTab === 'compact' && (
                           <div className="space-y-6">
                                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-600 dark:text-indigo-400">
                                        <HardDrive className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Free Up Disk Space</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                                        Run this command to physically free up space in the repository that was marked as deleted by "Prune" or "Delete".
                                    </p>
                                </div>

                                <Button onClick={handleCompact} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                    Run Compact Command
                                </Button>
                           </div>
                       )}
                   </>
               )}
           </div>
       </div>
    </div>
  );
};

export default MaintenanceModal;