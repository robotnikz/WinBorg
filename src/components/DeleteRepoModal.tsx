
import React, { useState } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { AlertTriangle, Trash2, Eraser, X, Loader2, Terminal } from 'lucide-react';
import { borgService } from '../services/borgService';
import { toast } from '../utils/eventBus';

interface DeleteRepoModalProps {
  repo: Repository;
  isOpen: boolean;
  onClose: () => void;
  onConfirmForget: () => void; // Called when user just wants to remove from app
  onLog: (title: string, logs: string[]) => void;
}

const DeleteRepoModal: React.FC<DeleteRepoModalProps> = ({ repo, isOpen, onClose, onConfirmForget, onLog }) => {
  const [deleteMode, setDeleteMode] = useState<'forget' | 'empty' | 'destroy'>('forget');
  const [confirmName, setConfirmName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLog, setCurrentLog] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fullLogs, setFullLogs] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAction = async () => {
      if (deleteMode === 'forget') {
          onConfirmForget();
          onClose();
          return;
      }

      if (confirmName !== repo.name) return;

      setIsProcessing(true);
      setError(null);
      setCurrentLog('Initializing deletion process...');
      const logs: string[] = [];
      setFullLogs([]);

      const logCollector = (l: string) => {
          logs.push(l);
          setFullLogs(prev => [...prev, l]);
          setCurrentLog(l);
      };

      try {
          let success = false;
          if (deleteMode === 'empty') {
               success = await borgService.emptyRepo(
                   repo.url,
                   logCollector,
                   { repoId: repo.id, disableHostCheck: repo.trustHost }
               );
               if (success) {
                   toast.show(`Emptied all archives from '${repo.name}'`, 'success');
                   onClose();
               }
          } else if (deleteMode === 'destroy') {
               success = await borgService.destroyRepo(
                   repo.url,
                   logCollector,
                   { repoId: repo.id, disableHostCheck: repo.trustHost }
               );
               if (success) {
                   // If successfully destroyed, we also remove it from the app
                   onConfirmForget();
                   toast.show(`Permanently destroyed repository '${repo.name}'`, 'success');
                   onClose();
               }
          }

          if (!success) {
              setError("Operation failed. See details below.");
          }
      } catch (e: any) {
          setError(`Error: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
           
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                   <AlertTriangle className="w-5 h-5" />
                   <h3 className="font-bold">Delete Repository</h3>
               </div>
               <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X size={20} />
               </button>
           </div>

           <div className="p-6">
               {isProcessing ? (
                   <div className="flex flex-col items-center justify-center py-8 space-y-6">
                       <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
                       <div className="text-center">
                           <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                               {deleteMode === 'empty' ? 'Deleting Archives...' : 'Destroying Repository...'}
                           </h4>
                           <p className="text-sm text-slate-500">Do not close the application.</p>
                       </div>
                       <div className="w-full bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 flex items-center gap-2">
                           <Terminal className="w-3 h-3" />
                           <span className="truncate">{currentLog}</span>
                       </div>
                   </div>
               ) : error ? (
                   <div className="flex flex-col space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">Operation Failed</h4>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-3 h-48 overflow-y-auto border border-slate-700">
                            <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                                {fullLogs.join('')}
                            </pre>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => { setError(null); onClose(); }}>Close</Button>
                            <Button onClick={() => setError(null)}>Back to Options</Button>
                        </div>
                   </div>
               ) : (
                   <>
                       <div className="grid grid-cols-1 gap-3 mb-6">
                           {/* OPTION 1: FORGET */}
                           <button 
                               onClick={() => setDeleteMode('forget')}
                               className={`p-4 rounded-lg border-2 text-left transition-all ${deleteMode === 'forget' 
                                   ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                   : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                           >
                               <div className="flex items-center gap-3 mb-1">
                                   <div className={`p-2 rounded-full ${deleteMode === 'forget' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                       <X size={18} />
                                   </div>
                                   <div className="font-semibold text-slate-800 dark:text-slate-200">Remove from App</div>
                               </div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 pl-[52px]">
                                   Only removes this configuration from WinBorg. The data on the server remains untouched.
                               </p>
                           </button>

                           {/* OPTION 2: EMPTY */}
                           <button 
                               onClick={() => setDeleteMode('empty')}
                               className={`p-4 rounded-lg border-2 text-left transition-all ${deleteMode === 'empty' 
                                   ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                                   : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                           >
                               <div className="flex items-center gap-3 mb-1">
                                   <div className={`p-2 rounded-full ${deleteMode === 'empty' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                                       <Eraser size={18} />
                                   </div>
                                   <div className="font-semibold text-slate-800 dark:text-slate-200">Empty Repository</div>
                               </div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 pl-[52px]">
                                   Deletes ALL archives (backups) inside the repository, but keeps the folder structure and configuration intact.
                               </p>
                           </button>

                           {/* OPTION 3: DESTROY */}
                           <button 
                               onClick={() => setDeleteMode('destroy')}
                               className={`p-4 rounded-lg border-2 text-left transition-all ${deleteMode === 'destroy' 
                                   ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                                   : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'}`}
                           >
                               <div className="flex items-center gap-3 mb-1">
                                   <div className={`p-2 rounded-full ${deleteMode === 'destroy' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                       <Trash2 size={18} />
                                   </div>
                                   <div className="font-semibold text-slate-800 dark:text-slate-200">Destroy Repository</div>
                               </div>
                               <p className="text-xs text-slate-500 dark:text-slate-400 pl-[52px]">
                                   DANGER: Permanently deletes the repository folder and all data. Cannot be undone.
                               </p>
                           </button>
                       </div>

                       {deleteMode !== 'forget' && (
                           <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg">
                               <label className="block text-xs font-bold text-red-700 dark:text-red-400 mb-2 uppercase">
                                   Confirm Action
                               </label>
                               <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                   To confirm, type the repository name <strong>{repo.name}</strong> below:
                               </p>
                               <input 
                                   type="text" 
                                   className="w-full border border-red-300 dark:border-red-800 rounded p-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                   placeholder={repo.name}
                                   value={confirmName}
                                   onChange={e => setConfirmName(e.target.value)}
                               />
                           </div>
                       )}

                       <div className="flex justify-end gap-3">
                           <Button variant="secondary" onClick={onClose} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Cancel</Button>
                           <Button 
                                variant={deleteMode === 'forget' ? 'secondary' : 'danger'}
                                disabled={deleteMode !== 'forget' && confirmName !== repo.name}
                                onClick={handleAction}
                            >
                                {deleteMode === 'forget' ? 'Remove from List' : deleteMode === 'empty' ? 'Empty Repo' : 'Destroy Repo'}
                            </Button>
                       </div>
                   </>
               )}
           </div>
       </div>
    </div>
  );
};

export default DeleteRepoModal;
