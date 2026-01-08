

import React, { useState, useEffect } from 'react';
import { Repository, BackupJob } from '../types';
import RepoCard from '../components/RepoCard';
import MaintenanceModal from '../components/MaintenanceModal';
import KeyExportModal from '../components/KeyExportModal';
import DeleteRepoModal from '../components/DeleteRepoModal';
import CreateBackupModal from '../components/CreateBackupModal';
import JobsModal from '../components/JobsModal';
import Button from '../components/Button';
import { Plus, Search, X, Info, Link, FolderPlus, Loader2, Terminal, Cloud, Check, AlertTriangle } from 'lucide-react';
import { borgService } from '../services/borgService';

interface RepositoriesViewProps {
  repos: Repository[];
  jobs: BackupJob[];
  onAddRepo: (repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onEditRepo: (id: string, repoData: { name: string; url: string; encryption: 'repokey' | 'keyfile' | 'none', passphrase?: string, trustHost?: boolean }) => void;
  onConnect: (repo: Repository) => void;
  onMount: (repo: Repository) => void;
  onCheck: (repo: Repository) => void;
  onDelete: (repoId: string) => void;
  onBreakLock: (repo: Repository) => void;
  // Job Handlers
  onAddJob: (job: BackupJob) => void;
  onDeleteJob: (jobId: string) => void;
  onRunJob: (jobId: string) => void;
}

const RepositoriesView: React.FC<RepositoriesViewProps> = ({ 
    repos, jobs, onAddRepo, onEditRepo, onConnect, onMount, onCheck, onDelete, onBreakLock,
    onAddJob, onDeleteJob, onRunJob
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
  const [useWsl, setUseWsl] = useState(true);
  
  // ADD MODAL STATE
  const [addMode, setAddMode] = useState<'connect' | 'init'>('connect');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initLog, setInitLog] = useState<string>('');

  // TEST CONNECTION STATE
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testLog, setTestLog] = useState('');

  // Modals
  const [maintenanceRepo, setMaintenanceRepo] = useState<Repository | null>(null);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [exportKeyRepo, setExportKeyRepo] = useState<Repository | null>(null);
  const [deleteRepo, setDeleteRepo] = useState<Repository | null>(null);
  
  // Backup Modal
  const [backupRepo, setBackupRepo] = useState<Repository | null>(null);
  
  // Jobs Modal
  const [jobsRepo, setJobsRepo] = useState<Repository | null>(null);

  // Terminal/Log Feedback for Maintenance/Delete
  const [localLogData, setLocalLogData] = useState<{title: string, logs: string[]} | null>(null);
  
  const [repoForm, setRepoForm] = useState<{
    name: string;
    url: string;
    encryption: 'repokey' | 'keyfile' | 'none';
    passphrase?: string;
    trustHost: boolean;
  }>({
    name: '',
    url: '',
    encryption: 'repokey',
    passphrase: '',
    trustHost: false
  });

  useEffect(() => {
    if (isModalOpen) {
        const storedWsl = localStorage.getItem('winborg_use_wsl');
        setUseWsl(storedWsl === null ? true : storedWsl === 'true');
    }
  }, [isModalOpen]);

  const handleOpenAdd = () => {
      setRepoForm({ name: '', url: '', encryption: 'repokey', passphrase: '', trustHost: false });
      setConfirmPassphrase('');
      setEditingRepoId(null);
      setAddMode('connect');
      setIsInitializing(false);
      setInitError(null);
      setIsModalOpen(true);
      setTestResult(null);
      setTestLog('');
  };

  const handleOpenEdit = async (repo: Repository) => {
      setRepoForm({
          name: repo.name,
          url: repo.url,
          encryption: repo.encryption,
          passphrase: '', 
          trustHost: repo.trustHost || false
      });
      setConfirmPassphrase('');
      setEditingRepoId(repo.id);
      setAddMode('connect'); // Edit implies connection settings
      setIsModalOpen(true);
      setTestResult(null);
      setTestLog('');
  };

  const handleTestConnection = async () => {
      setIsTesting(true);
      setTestLog('Starting connection test...\n');
      setTestResult(null);
      
      const success = await borgService.testConnection(
          repoForm.url,
          (log) => setTestLog(prev => prev + log),
          { disableHostCheck: repoForm.trustHost }
      );
      
      setTestResult(success ? 'success' : 'error');
      setIsTesting(false);
  };
  
  const handleApplyTemplate = (provider: 'hetzner' | 'rsync' | 'nas' | 'borgbase' | 'linux') => {
      switch (provider) {
          case 'hetzner':
              setRepoForm({ ...repoForm, name: 'Hetzner StorageBox', url: 'ssh://uXXXXXX@uXXXXXX.your-storagebox.de:23/./backups/repo1', trustHost: true });
              break;
          case 'rsync':
              setRepoForm({ ...repoForm, name: 'Rsync.net', url: 'ssh://user@host.rsync.net:22/./repo1', trustHost: true });
              break;
          case 'borgbase':
              setRepoForm({ ...repoForm, name: 'BorgBase', url: 'ssh://user@repo.borgbase.com:22/./repo', trustHost: true });
              break;
          case 'nas':
              setRepoForm({ ...repoForm, name: 'Local NAS', url: 'ssh://admin@192.168.1.50:22/volume1/backups/repo1', trustHost: true });
              break;
          case 'linux':
              setRepoForm({ ...repoForm, name: 'Linux Server / VPS', url: 'ssh://user@your-server.com:22/path/to/repo', trustHost: true });
              break;
      }
  };

  const handleSave = async () => {
    if (!repoForm.name || !repoForm.url) return;
    
    if (addMode === 'init' && repoForm.encryption !== 'none') {
        if (repoForm.passphrase !== confirmPassphrase) {
            setInitError("Passphrases do not match.");
            return;
        }
        if (!repoForm.passphrase) {
            setInitError("Passphrase is required for encryption.");
            return;
        }
    }

    if (editingRepoId) {
        onEditRepo(editingRepoId, {
            ...repoForm,
            passphrase: undefined 
        });
        if (repoForm.passphrase) {
            await borgService.savePassphrase(editingRepoId, repoForm.passphrase);
        }
        setIsModalOpen(false);

    } else {
        const newId = Math.random().toString(36).substr(2, 9);
        
        if (repoForm.passphrase) {
            await borgService.savePassphrase(newId, repoForm.passphrase);
        }

        if (addMode === 'connect') {
            onAddRepo({ ...repoForm, id: newId } as any);
            setIsModalOpen(false);
        } else {
            setIsInitializing(true);
            setInitError(null);
            setInitLog("Starting initialization...\n");

            const success = await borgService.initRepo(
                repoForm.url,
                repoForm.encryption,
                (log) => setInitLog(prev => prev + log),
                { repoId: newId, disableHostCheck: repoForm.trustHost }
            );

            setIsInitializing(false);

            if (success) {
                onAddRepo({ ...repoForm, id: newId } as any);
                setIsModalOpen(false);
            } else {
                await borgService.deletePassphrase(newId);
                setInitError("Initialization failed. Check logs below.");
            }
        }
    }
  };

  const handleOpenMaintenance = (repo: Repository) => {
      setMaintenanceRepo(repo);
      setIsMaintenanceOpen(true);
  };
  
  const handleExportKey = (repo: Repository) => {
      setExportKeyRepo(repo);
  };

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Maintenance Modal */}
      {maintenanceRepo && (
          <MaintenanceModal 
              repo={maintenanceRepo}
              isOpen={isMaintenanceOpen}
              onClose={() => setIsMaintenanceOpen(false)}
              onRefreshRepo={onConnect}
              onLog={(title, logs) => setLocalLogData({ title, logs })}
          />
      )}
      
      {/* Key Export Modal */}
      {exportKeyRepo && (
          <KeyExportModal 
              repo={exportKeyRepo}
              isOpen={!!exportKeyRepo}
              onClose={() => setExportKeyRepo(null)}
          />
      )}
      
      {/* Delete Repo Modal */}
      {deleteRepo && (
          <DeleteRepoModal 
            repo={deleteRepo}
            isOpen={!!deleteRepo}
            onClose={() => setDeleteRepo(null)}
            onConfirmForget={() => onDelete(deleteRepo.id)}
            onLog={(title, logs) => setLocalLogData({ title, logs })}
          />
      )}
      
      {/* Create Backup Modal (One-off) */}
      {backupRepo && (
          <CreateBackupModal 
              initialRepo={backupRepo}
              isOpen={!!backupRepo}
              onClose={() => setBackupRepo(null)}
              onLog={(title, logs) => setLocalLogData({ title, logs })}
              onSuccess={() => onConnect(backupRepo)}
          />
      )}
      
      {/* Jobs Modal */}
      {jobsRepo && (
          <JobsModal
             repo={jobsRepo}
             jobs={jobs}
             isOpen={!!jobsRepo}
             onClose={() => setJobsRepo(null)}
             onAddJob={onAddJob}
             onDeleteJob={onDeleteJob}
             onRunJob={onRunJob}
          />
      )}

      {/* Local Log Modal (Simple) */}
      {localLogData && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-[#1e1e1e] w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="px-4 py-2 bg-[#2d2d2d] border-b border-black/20 flex justify-between items-center text-gray-300">
                      <span className="font-mono text-sm">{localLogData.title}</span>
                      <button onClick={() => setLocalLogData(null)}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1">
                      {localLogData.logs.map((l, i) => (
                          <div key={i} className="text-gray-300 break-all">{l}</div>
                      ))}
                  </div>
                  <div className="p-3 bg-[#2d2d2d] flex justify-end">
                      <Button size="sm" onClick={() => setLocalLogData(null)}>Close</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5 flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/80 dark:bg-slate-900/50 shrink-0">
               <h3 className="font-semibold text-slate-800 dark:text-white">{editingRepoId ? 'Edit Repository' : 'Add Repository'}</h3>
               <button onClick={() => setIsModalOpen(false)} disabled={isInitializing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50">
                 <X size={18} />
               </button>
             </div>

             {!editingRepoId && (
                 <div className="flex border-b border-gray-200 dark:border-slate-700">
                    <button 
                        onClick={() => setAddMode('connect')}
                        disabled={isInitializing}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${addMode === 'connect' 
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400' 
                            : 'text-slate-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        <Link className="w-4 h-4" /> Connect Existing
                    </button>
                    <button 
                        onClick={() => setAddMode('init')}
                        disabled={isInitializing}
                        className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${addMode === 'init' 
                            ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-400' 
                            : 'text-slate-500 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        <FolderPlus className="w-4 h-4" /> Initialize New
                    </button>
                 </div>
             )}
             
             <div className="p-6 space-y-4 overflow-y-auto flex-1">
               
               {/* Quick Templates */}
               {!editingRepoId && !repoForm.url && (
                   <div className="mb-4">
                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Provider Templates</label>
                       <div className="grid grid-cols-3 gap-2">
                           <button onClick={() => handleApplyTemplate('hetzner')} className="p-2 border border-gray-200 dark:border-slate-700 rounded hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 text-center">
                               <Cloud className="w-3 h-3 shrink-0" /> Hetzner
                           </button>
                           <button onClick={() => handleApplyTemplate('borgbase')} className="p-2 border border-gray-200 dark:border-slate-700 rounded hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 text-center">
                               <Cloud className="w-3 h-3 shrink-0" /> BorgBase
                           </button>
                           <button onClick={() => handleApplyTemplate('linux')} className="p-2 border border-gray-200 dark:border-slate-700 rounded hover:bg-gray-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 text-center">
                               <Terminal className="w-3 h-3 shrink-0" /> Linux / VPS
                           </button>
                       </div>
                   </div>
               )}

               <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Name</label>
                 <input 
                   type="text" 
                   autoFocus
                   disabled={isInitializing}
                   className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white transition-all shadow-sm"
                   placeholder="My Remote Backup"
                   value={repoForm.name}
                   onChange={e => setRepoForm({...repoForm, name: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">SSH Connection URL</label>
                 <input 
                   type="text" 
                   disabled={isInitializing}
                   className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white font-mono transition-all shadow-sm"
                   placeholder="ssh://user@example.com:22/path/to/repo"
                   value={repoForm.url}
                   onChange={e => setRepoForm({...repoForm, url: e.target.value})}
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Encryption</label>
                     <div className="relative">
                        <select 
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white appearance-none shadow-sm disabled:opacity-50"
                          value={repoForm.encryption}
                          onChange={e => setRepoForm({...repoForm, encryption: e.target.value as any})}
                          disabled={isInitializing}
                        >
                          <option value="repokey">Repokey</option>
                          <option value="keyfile">Keyfile</option>
                          <option value="none">None</option>
                        </select>
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Passphrase</label>
                     <div className="relative">
                        <input 
                          type="password" 
                          disabled={isInitializing}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-900 dark:text-white shadow-sm"
                          placeholder={editingRepoId ? "Change (Optional)" : "Required"}
                          value={repoForm.passphrase}
                          onChange={e => setRepoForm({...repoForm, passphrase: e.target.value})}
                        />
                     </div>
                   </div>
               </div>
               
               {addMode === 'init' && repoForm.encryption !== 'none' && (
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm Passphrase</label>
                     <input 
                       type="password" 
                       disabled={isInitializing}
                       className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-900 dark:text-white shadow-sm ${
                           confirmPassphrase && confirmPassphrase !== repoForm.passphrase ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-slate-600 focus:border-blue-500'
                       }`}
                       placeholder="Re-enter to confirm"
                       value={confirmPassphrase}
                       onChange={e => setConfirmPassphrase(e.target.value)}
                     />
                     {confirmPassphrase && confirmPassphrase !== repoForm.passphrase && (
                         <p className="text-red-500 text-[10px] mt-1">Passphrases do not match</p>
                     )}
                   </div>
               )}

               <div className="pt-2">
                 <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                     <div className="mt-0.5">
                        <input 
                            type="checkbox" 
                            id="trust-host" 
                            disabled={isInitializing}
                            className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white dark:bg-slate-700"
                            checked={repoForm.trustHost}
                            onChange={(e) => setRepoForm({...repoForm, trustHost: e.target.checked})}
                        />
                     </div>
                     <div>
                         <label htmlFor="trust-host" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">Trust Unknown SSH Host</label>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                             Fixes "Exit Code 1" on first connection.
                         </p>
                     </div>
                 </div>
               </div>
               
               {/* Test Connection Button */}
               {!editingRepoId && addMode === 'connect' && repoForm.url && (
                   <div className="pt-2">
                       <Button 
                            variant="secondary" 
                            size="sm"
                            className="w-full border-blue-200 dark:border-slate-600" 
                            onClick={handleTestConnection}
                            disabled={isTesting}
                       >
                           {isTesting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Terminal className="w-3 h-3 mr-2" />}
                           {isTesting ? 'Testing...' : 'Test Connection'}
                       </Button>
                       {testResult === 'success' && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Connection successful!</p>}
                       {testResult === 'error' && (
                           <div className="mt-1 text-xs text-red-600 bg-red-50 dark:bg-red-900/10 p-2 rounded">
                               <p className="font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Connection failed</p>
                               <div className="truncate text-[10px] mt-1 font-mono">{testLog.slice(0, 100)}...</div>
                           </div>
                       )}
                   </div>
               )}

               {initError && (
                   <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-lg border border-red-200 dark:border-red-800">
                       <strong>Error:</strong> {initError}
                   </div>
               )}
               
               {isInitializing && (
                   <div className="bg-slate-900 p-3 rounded-lg text-xs font-mono text-slate-300 max-h-32 overflow-y-auto">
                        <div className="flex items-center gap-2 text-blue-400 mb-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> Initializing...
                        </div>
                        <div className="whitespace-pre-wrap">{initLog}</div>
                   </div>
               )}

             </div>

             <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 shrink-0">
               <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isInitializing} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">Cancel</Button>
               <Button onClick={handleSave} disabled={!repoForm.name || !repoForm.url || isInitializing} loading={isInitializing}>
                   {editingRepoId ? 'Save Changes' : (addMode === 'init' ? 'Initialize Repository' : 'Add Repository')}
               </Button>
             </div>
           </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Repositories</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your remote Borg repositories</p>
        </div>
        <Button onClick={handleOpenAdd} title="Configure a new Borg repository">
          <Plus className="w-4 h-4 mr-2" />
          Add Repository
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text"
          placeholder="Search repositories..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRepos.map(repo => (
          <RepoCard 
            key={repo.id} 
            repo={repo} 
            jobs={jobs}
            onConnect={onConnect}
            onMount={onMount}
            onCheck={onCheck}
            onBreakLock={onBreakLock}
            onDelete={() => setDeleteRepo(repo)}
            onEdit={handleOpenEdit}
            onMaintenance={handleOpenMaintenance}
            onExportKey={handleExportKey}
            onBackup={(r) => setBackupRepo(r)}
            onManageJobs={(r) => setJobsRepo(r)}
          />
        ))}
        {filteredRepos.length === 0 && (
            <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                <p className="text-slate-400 dark:text-slate-500">No repositories found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RepositoriesView;
