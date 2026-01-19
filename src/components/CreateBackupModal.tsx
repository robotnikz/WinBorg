
import React, { useState, useEffect, useRef } from 'react';
import { Repository } from '../types';
import Button from './Button';
import { Folder, Save, X, Clock, Terminal, Loader2, Server } from 'lucide-react';
import { borgService } from '../services/borgService';
import { toast } from '../utils/eventBus';

interface CreateBackupModalProps {
  initialRepo: Repository;
  repos?: Repository[]; // List of all available connected repos
  isOpen: boolean;
  onClose: () => void;
  onLog: (title: string, logs: string[]) => void;
  onSuccess: () => void;

    // Optional lifecycle hooks so parent can show global running state/ETA
    onBackupStarted?: (repo: Repository, commandId: string) => void;
    onBackupFinished?: (repo: Repository, result: 'success' | 'error', durationMs?: number) => void;
    onBackupCancelled?: (repo: Repository) => void;
}

const CreateBackupModal: React.FC<CreateBackupModalProps> = ({ initialRepo, repos = [], isOpen, onClose, onLog, onSuccess, onBackupStarted, onBackupFinished, onBackupCancelled }) => {
  const [selectedRepoId, setSelectedRepoId] = useState(initialRepo.id);
  const [sourcePath, setSourcePath] = useState('');
    const [excludePatternsText, setExcludePatternsText] = useState('');
  const [archiveName, setArchiveName] = useState(() => {
      const now = new Date();
      // Default: backup-2023-10-25-1430
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      return `backup-${dateStr}-${timeStr}`;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLog, setCurrentLog] = useState('');
    const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

  const isMountedRef = useRef(false);
  const cancelledRef = useRef(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
      isMountedRef.current = true;
      return () => {
          isMountedRef.current = false;
      };
  }, []);

  // Update selected repo if initialRepo changes when opening
  useEffect(() => {
      if (isOpen) {
          setSelectedRepoId(initialRepo.id);
          setExcludePatternsText('');
          setIsProcessing(false);
          setIsCancelling(false);
          setCurrentLog('');
          setActiveCommandId(null);
          cancelledRef.current = false;
          setTimeout(() => closeButtonRef.current?.focus(), 0);
      }
  }, [isOpen, initialRepo]);

  useEffect(() => {
      if (!isOpen || isProcessing || isCancelling) return;

      const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') onClose();
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, isCancelling, onClose]);

  if (!isOpen) return null;

  // Filter only connected repos for the dropdown, ensure current initial is included just in case
  const availableRepos = repos.length > 0 ? repos : [initialRepo];
  const activeRepo = availableRepos.find(r => r.id === selectedRepoId) || initialRepo;

  const handleSelectFolder = async () => {
      const paths = await borgService.selectDirectory();
      if (paths && paths.length > 0) {
          setSourcePath(paths[0]);
      }
  };

  const handleBackup = async () => {
      if (!sourcePath || !archiveName) return;

      const commandId = `oneoff-${activeRepo.id}-${Date.now()}`;
      const startTime = Date.now();

      cancelledRef.current = false;

      setIsProcessing(true);
      setCurrentLog('Initializing backup process...');
      setActiveCommandId(commandId);
      onBackupStarted?.(activeRepo, commandId);
      
      const logs: string[] = [];
      const logCollector = (l: string) => {
          logs.push(l);
          if (isMountedRef.current) setCurrentLog(l);
      };

      try {
          const excludePatterns = excludePatternsText
              .split(/\r?\n/)
              .map(p => p.trim())
              .filter(Boolean);

          const success = await borgService.createArchive(
              activeRepo.url,
              archiveName,
              [sourcePath],
              logCollector,
              { repoId: activeRepo.id, disableHostCheck: activeRepo.trustHost, remotePath: activeRepo.remotePath, commandId },
              ...(excludePatterns.length ? [{ excludePatterns }] : [])
          );

          // If the user cancelled, don't treat it as an error/success.
          if (cancelledRef.current) return;

          if (success) {
              toast.success(`Backup '${archiveName}' created successfully!`);
              onBackupFinished?.(activeRepo, 'success', Date.now() - startTime);
              onSuccess();
              onClose();
          } else {
              toast.error("Backup failed. See logs for details.");
              onLog(`Backup Failed: ${archiveName}`, logs);
              onBackupFinished?.(activeRepo, 'error', Date.now() - startTime);
          }
      } catch (e: any) {
          if (!cancelledRef.current) {
              toast.error(`Error: ${e.message}`);
              onBackupFinished?.(activeRepo, 'error', Date.now() - startTime);
          }
      } finally {
          if (isMountedRef.current) {
              setIsProcessing(false);
              setIsCancelling(false);
              setActiveCommandId(null);
          }
      }
  };

  const handleCloseWindow = () => {
      onClose();
  };

  const handleCancelBackup = async () => {
      if (!activeCommandId) {
          // Should be rare, but avoid dead UI.
          cancelledRef.current = true;
          setIsProcessing(false);
          onBackupCancelled?.(activeRepo);
          onClose();
          return;
      }

      cancelledRef.current = true;
      setIsCancelling(true);
      setCurrentLog('Cancelling backup...');
      try {
          await borgService.stopCommand(activeCommandId);
          toast.info('Backup cancelled.');
      } catch (e: any) {
          toast.error(`Cancel failed: ${e.message}`);
      } finally {
          if (isMountedRef.current) {
              setIsCancelling(false);
              setIsProcessing(false);
              setActiveCommandId(null);
          }
          onBackupCancelled?.(activeRepo);
          onClose();
      }
  };

  return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (!isProcessing && !isCancelling) onClose();
            }}
        >
             <div
                 className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                 role="dialog"
                 aria-modal="true"
                 aria-label="Create New Backup"
             >
           
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       <Save className="w-5 h-5 text-green-600" />
                       Create New Backup
                   </h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">
                       {availableRepos.length > 1 ? 'Select target repository below' : `Upload to ${activeRepo.name}`}
                   </p>
               </div>
                                                                                                                 <button ref={closeButtonRef} onClick={handleCloseWindow} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50" disabled={isCancelling} aria-label="Close">
                 <X size={20} />
               </button>
           </div>

           <div className="p-6 space-y-5">
               
               {/* Repository Selection (Only if multiple available) */}
               {availableRepos.length > 1 && (
                   <div>
                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Target Repository</label>
                       <div className="relative">
                           <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <select
                               className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm text-slate-900 dark:text-white appearance-none"
                               value={selectedRepoId}
                               onChange={(e) => setSelectedRepoId(e.target.value)}
                               disabled={isProcessing}
                           >
                               {availableRepos.map(r => (
                                   <option key={r.id} value={r.id}>{r.name} ({r.url})</option>
                               ))}
                           </select>
                           <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                           </div>
                       </div>
                   </div>
               )}

               {/* Archive Name Input */}
               <div>
                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Archive Name</label>
                   <div className="relative">
                       <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                           type="text" 
                           className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm font-mono text-slate-900 dark:text-white"
                           value={archiveName}
                           onChange={(e) => setArchiveName(e.target.value)}
                           disabled={isProcessing}
                       />
                   </div>
               </div>

               {/* Source Folder Input */}
               <div>
                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Source Folder</label>
                   <div className="flex gap-2">
                       <div className="relative flex-1">
                           <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input 
                               type="text" 
                               readOnly
                               placeholder="Select a folder to backup..."
                               className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-300 focus:outline-none cursor-not-allowed"
                               value={sourcePath}
                           />
                       </div>
                       <Button variant="secondary" onClick={handleSelectFolder} disabled={isProcessing} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                           Browse...
                       </Button>
                   </div>
               </div>

               <div>
                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Exclude Patterns (Optional)</label>
                   <textarea
                       className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-green-500/20 min-h-[96px]"
                       placeholder={[
                           "node_modules",
                           ".git",
                           "**/Cache",
                           "C:\\Temp"
                       ].join("\n")}
                       value={excludePatternsText}
                       onChange={(e) => setExcludePatternsText(e.target.value)}
                       disabled={isProcessing}
                   />
                   <p className="text-[10px] text-slate-400 mt-1">
                       One pattern per line. Passed to borg as <code>--exclude &lt;pattern&gt;</code>.
                   </p>
               </div>
               
               {isProcessing && (
                   <div className="bg-slate-900 rounded p-3 border border-slate-700">
                       <div className="flex items-center gap-2 text-green-400 text-xs font-bold mb-2">
                           <Loader2 className="w-3 h-3 animate-spin" /> {isCancelling ? 'Cancelling…' : 'Processing Backup...'}
                       </div>
                       <div className="font-mono text-xs text-slate-400 truncate flex items-center gap-2">
                           <Terminal className="w-3 h-3" /> {currentLog}
                       </div>
                   </div>
               )}

           </div>

           <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
               {isProcessing ? (
                   <>
                       <Button variant="secondary" onClick={handleCloseWindow} disabled={isCancelling}>Close</Button>
                       <Button variant="danger" onClick={handleCancelBackup} disabled={isCancelling}>Cancel Backup</Button>
                   </>
               ) : (
                   <Button variant="secondary" onClick={handleCloseWindow} disabled={isCancelling}>Cancel</Button>
               )}
               <Button 
                    onClick={handleBackup} 
                    disabled={!sourcePath || !archiveName || isProcessing}
                    className="bg-green-600 hover:bg-green-700 text-white"
               >
                   Start Backup
               </Button>
           </div>
       </div>
    </div>
  );
};

export default CreateBackupModal;
