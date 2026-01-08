
import React, { useState, useEffect } from 'react';
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
}

const CreateBackupModal: React.FC<CreateBackupModalProps> = ({ initialRepo, repos = [], isOpen, onClose, onLog, onSuccess }) => {
  const [selectedRepoId, setSelectedRepoId] = useState(initialRepo.id);
  const [sourcePath, setSourcePath] = useState('');
  const [archiveName, setArchiveName] = useState(() => {
      const now = new Date();
      // Default: backup-2023-10-25-1430
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      return `backup-${dateStr}-${timeStr}`;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLog, setCurrentLog] = useState('');

  // Update selected repo if initialRepo changes when opening
  useEffect(() => {
      if (isOpen) {
          setSelectedRepoId(initialRepo.id);
      }
  }, [isOpen, initialRepo]);

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

      setIsProcessing(true);
      setCurrentLog('Initializing backup process...');
      
      const logs: string[] = [];
      const logCollector = (l: string) => {
          logs.push(l);
          setCurrentLog(l);
      };

      try {
          const success = await borgService.createArchive(
              activeRepo.url,
              archiveName,
              [sourcePath],
              logCollector,
              { repoId: activeRepo.id, disableHostCheck: activeRepo.trustHost }
          );

          if (success) {
              toast.success(`Backup '${archiveName}' created successfully!`);
              onSuccess();
              onClose();
          } else {
              toast.error("Backup failed. See logs for details.");
              onLog(`Backup Failed: ${archiveName}`, logs);
          }
      } catch (e: any) {
          toast.error(`Error: ${e.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
           
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
               <button onClick={onClose} disabled={isProcessing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50">
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
               
               {isProcessing && (
                   <div className="bg-slate-900 rounded p-3 border border-slate-700">
                       <div className="flex items-center gap-2 text-green-400 text-xs font-bold mb-2">
                           <Loader2 className="w-3 h-3 animate-spin" /> Processing Backup...
                       </div>
                       <div className="font-mono text-xs text-slate-400 truncate flex items-center gap-2">
                           <Terminal className="w-3 h-3" /> {currentLog}
                       </div>
                   </div>
               )}

           </div>

           <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
               <Button variant="secondary" onClick={onClose} disabled={isProcessing}>Cancel</Button>
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
