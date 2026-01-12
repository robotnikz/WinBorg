
import React, { useState, useEffect } from 'react';
import { Repository, BackupJob } from '../types';
import RepoCard from '../components/RepoCard';
import MaintenanceModal from '../components/MaintenanceModal';
import KeyExportModal from '../components/KeyExportModal';
import DeleteRepoModal from '../components/DeleteRepoModal';
import CreateBackupModal from '../components/CreateBackupModal';
import JobsModal from '../components/JobsModal';
import Button from '../components/Button';
import { Plus, Search, X, Link, FolderPlus, Loader2, Terminal, Cloud, Check, AlertTriangle, Key, Copy, RefreshCw, Server, XCircle } from 'lucide-react';
import { borgService } from '../services/borgService';
import { toast } from '../utils/eventBus';

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

  // SSH STATE
  const [sshShowDetails, setSshShowDetails] = useState(false);
  const [sshKeyStatus, setSshKeyStatus] = useState<'loading' | 'found' | 'missing' | null>(null);
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null);
  const [isSshAction, setIsSshAction] = useState(false);

  const handleCheckKey = async () => {
    setSshKeyStatus('loading');
    try {
        const res = await borgService.manageSSHKey('check');
        if (res.exists) {
            setSshKeyStatus('found');
            const keyRes = await borgService.manageSSHKey('read');
            if (keyRes.success) setSshPublicKey(keyRes.key || '');
        } else {
            setSshKeyStatus('missing');
            setSshPublicKey(null);
        }
    } catch (e) {
        console.error(e);
        setSshKeyStatus('missing');
    }
  };

  const handleGenerateKey = async () => {
    if (!confirm("This will overwrite any existing 'id_ed25519' key in your WSL distribution. Continue?")) return;
    setIsSshAction(true);
    try {
        const res = await borgService.manageSSHKey('generate');
        if (res.success) {
            await handleCheckKey();
        }
    } finally {
        setIsSshAction(false);
    }
  };

  useEffect(() => {
    if (sshShowDetails && sshKeyStatus === null) {
        handleCheckKey();
    }
  }, [sshShowDetails]);

  // Modals
  const [maintenanceRepo, setMaintenanceRepo] = useState<Repository | null>(null);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [exportKeyRepo, setExportKeyRepo] = useState<Repository | null>(null);
  const [deleteRepo, setDeleteRepo] = useState<Repository | null>(null);
  
  // Backup Modal
  const [backupRepo, setBackupRepo] = useState<Repository | null>(null);
  
  // Jobs Modal
  const [jobsRepo, setJobsRepo] = useState<Repository | null>(null);

  // Terminal/Log Feedback
  const [localLogData, setLocalLogData] = useState<{title: string, logs: string[]} | null>(null);

  // SSH Install Modal State
  const [installKeyTarget, setInstallKeyTarget] = useState<string | null>(null);
  const [installKeyPort, setInstallKeyPort] = useState<string | null>(null);
  const [installKeyPassword, setInstallKeyPassword] = useState('');
  const [isInstallingKey, setIsInstallingKey] = useState(false);

  // Borg Install Modal State
  const [installBorgTarget, setInstallBorgTarget] = useState<string | null>(null);
  const [installBorgPort, setInstallBorgPort] = useState<string | null>(null);
  const [installBorgPassword, setInstallBorgPassword] = useState('');
  const [isInstallingBorg, setIsInstallingBorg] = useState(false);
  const [connectionTestStatus, setConnectionTestStatus] = useState<'none' | 'loading' | 'success' | 'failure'>('none');
  
  // Add Repo Flow State
  const [addRepoStep, setAddRepoStep] = useState<'none' | 'success' | 'ssh_fail' | 'borg_fail'>('none');


  // Helper to parse target
  const parseTargetFromUrl = () => {
    let target = "user@host";
    let port = "";
    if (repoForm.url && repoForm.url.includes('@')) {
        try {
            let nice = repoForm.url.replace(/^ssh:\/\//, '').replace(/^sftp:\/\//, '').replace(/^scp:\/\//, '');
            const pathSplit = nice.split('/');
            let hostPart = pathSplit[0];
            if (hostPart.includes(':') && !hostPart.includes('[')) { // IPv6 safety
                const parts = hostPart.split(':');
                target = parts[0]; 
                port = parts[1];
            } else {
                target = hostPart;
            }
        } catch(e) {}
    }
    return { target, port };
  };

  const handleInstallBorg = async () => {
    if (!installBorgTarget || !installBorgPassword) return;
    setIsInstallingBorg(true);
    const toastId = toast.show("Installing BorgBackup on remote server...", 'loading', 0);
    
    try {
        const res = await borgService.installBorg(installBorgTarget, installBorgPassword, installBorgPort || undefined);
        toast.dismiss(toastId);
        
        if (res.success) {
            toast.show("BorgBackup installed successfully!", 'success');
            setInstallBorgTarget(null);
            setInstallBorgPort(null);
            setInstallBorgPassword('');
            
            // Auto-enable main button
            setAddRepoStep('success');
            setTestResult('success');
            setTestLog('Installation successful. BorgBackup found.\n');
        } else {
            toast.show("Installation failed", 'error');
            alert("Installation Failed:\n" + (res.details || res.error));
        }
    } catch (err: any) {
        toast.dismiss(toastId);
        toast.show("Error: " + err.message, 'error');
    } finally {
        setIsInstallingBorg(false);
    }
  };

  const handleInstallKey = async () => {
    if (!installKeyTarget || !installKeyPassword) return;
    setIsInstallingKey(true);
    const toastId = toast.show("Deploying SSH key...", 'loading', 0);
    
    try {
        const res = await borgService.installSSHKey(installKeyTarget, installKeyPassword, installKeyPort || undefined);
        toast.dismiss(toastId);
        
        if (res.success) {
            toast.show("SSH Key deployed successfully!", 'success');
            setInstallKeyTarget(null);
            setInstallKeyPort(null);
            setInstallKeyPassword('');
        } else {
            toast.show("Failed to deploy key", 'error');
            alert("Error deploying key:\n" + res.error);
        }
    } catch (err: any) {
        toast.dismiss(toastId);
        toast.show("Error: " + err.message, 'error');
    } finally {
        setIsInstallingKey(false);
    }
  };
  
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

  const handleOpenEdit = (repo: Repository) => {
      setRepoForm({
          name: repo.name,
          url: repo.url,
          encryption: repo.encryption,
          passphrase: '', 
          trustHost: repo.trustHost || false
      });
      setConfirmPassphrase('');
      setEditingRepoId(repo.id);
      setAddMode('connect'); 
      setIsModalOpen(true);
      setTestResult(null);
      setTestLog('');
  };  

  // Force check on open
  useEffect(() => {
    if (isModalOpen) {
        handleCheckKey();
    }
  }, [isModalOpen]);

  const handleTestConnection = async () => {
      setIsTesting(true);
      setTestLog('Starting connection test...\n');
      setTestResult(null);
      setAddRepoStep('none');
      
      const isSsh = repoForm.url.startsWith('ssh://');
      
      if (isSsh) {
         setTestLog(prev => prev + "Detected SSH URL. Running connectivity checks...\n");
         const { target, port } = parseTargetFromUrl();
         
         // Step 1: Connectivity
         setTestLog(prev => prev + `1. Checking SSH connectivity to ${target}...\n`);
         const sshRes = await borgService.testSshConnection(target, port || undefined);
         
         if (!sshRes.success) {
             setTestLog(prev => prev + `❌ SSH Connection Failed: ${sshRes.error || 'Unknown error'}\n`);
             // Determine if it's a key issue? Mostly likely yes if BatchMode failed.
             setAddRepoStep('ssh_fail');
             setTestResult('error');
             setIsTesting(false);
             return;
         }
         setTestLog(prev => prev + `✅ SSH Connection successful.\n`);

         // Step 2: Borg Check
         setTestLog(prev => prev + `2. Checking for BorgBackup installation...\n`);
         const borgRes = await borgService.checkBorgInstalledRemote(target, port || undefined);
         
         if (!borgRes.success) {
             setTestLog(prev => prev + `❌ BorgBackup not found: ${borgRes.error}\n`);
             setAddRepoStep('borg_fail');
             setTestResult('error'); 
             setIsTesting(false);
             return;
         }
         
         setTestLog(prev => prev + `✅ BorgBackup found (Version: ${borgRes.version || 'unknown'}).\n`);
         setAddRepoStep('success');
         setTestResult('success');
         setIsTesting(false);
         
      } else {
        const success = await borgService.testConnection(
            repoForm.url,
            (log) => setTestLog(prev => prev + log),
            { disableHostCheck: repoForm.trustHost }
        );
        
        setTestResult(success ? 'success' : 'error');
        setIsTesting(false);
      }
  };
  
  const handleApplyTemplate = (provider: 'hetzner' | 'rsync' | 'nas' | 'borgbase' | 'linux') => {
      switch (provider) {
          case 'hetzner':
              setRepoForm(prev => ({ ...prev, name: 'Hetzner StorageBox', url: 'ssh://uXXXXXX@uXXXXXX.your-storagebox.de:23/./backups/repo1', trustHost: true }));
              break;
          case 'rsync':
              setRepoForm(prev => ({ ...prev, name: 'Rsync.net', url: 'ssh://user@host.rsync.net:22/./repo1', trustHost: true }));
              break;
          case 'borgbase':
              setRepoForm(prev => ({ ...prev, name: 'BorgBase', url: 'ssh://user@repo.borgbase.com:22/./repo', trustHost: true }));
              break;
          case 'nas':
              setRepoForm(prev => ({ ...prev, name: 'Local NAS', url: 'ssh://admin@192.168.1.50:22/volume1/backups/repo1', trustHost: true }));
              break;
          case 'linux':
              setRepoForm(prev => ({ ...prev, name: 'Linux Server / VPS', url: 'ssh://user@your-server.com:22/path/to/repo', trustHost: true }));
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

  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-12">
      
      {/* --- MODALS --- */}
      {maintenanceRepo && (
          <MaintenanceModal 
              repo={maintenanceRepo}
              isOpen={isMaintenanceOpen}
              onClose={() => setIsMaintenanceOpen(false)}
              onRefreshRepo={onConnect}
              onLog={(title, logs) => setLocalLogData({ title, logs })}
          />
      )}
      
      {exportKeyRepo && (
          <KeyExportModal 
              repo={exportKeyRepo}
              isOpen={!!exportKeyRepo}
              onClose={() => setExportKeyRepo(null)}
          />
      )}
      
      {deleteRepo && (
          <DeleteRepoModal 
            repo={deleteRepo}
            isOpen={!!deleteRepo}
            onClose={() => setDeleteRepo(null)}
            onConfirmForget={() => onDelete(deleteRepo.id)}
            onLog={(title, logs) => setLocalLogData({ title, logs })}
          />
      )}
      
      {backupRepo && (
          <CreateBackupModal 
              initialRepo={backupRepo}
              isOpen={!!backupRepo}
              onClose={() => setBackupRepo(null)}
              onLog={(title, logs) => setLocalLogData({ title, logs })}
              onSuccess={() => onConnect(backupRepo)}
          />
      )}
      
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

      {/* Log Detail Modal */}
      {localLogData && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#1e1e1e] w-full max-w-3xl rounded-xl shadow-2xl border border-gray-700 flex flex-col max-h-[85vh]">
                  <div className="px-5 py-3 bg-[#252526] border-b border-gray-700 flex justify-between items-center rounded-t-xl">
                      <div className="flex items-center gap-2 text-gray-200">
                          <Terminal className="w-4 h-4 text-blue-400" />
                          <span className="font-mono text-sm font-semibold">{localLogData.title}</span>
                      </div>
                      <button onClick={() => setLocalLogData(null)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1 bg-[#1e1e1e] text-gray-300">
                      {localLogData.logs.map((l, i) => (
                          <div key={i} className="break-all whitespace-pre-wrap">{l}</div>
                      ))}
                  </div>
                  <div className="p-3 bg-[#252526] border-t border-gray-700 flex justify-end rounded-b-xl">
                      <Button size="sm" variant="secondary" onClick={() => setLocalLogData(null)}>Close Output</Button>
                  </div>
              </div>
          </div>
      )}

      {/* SSH Install Key Modal */}
      {installKeyTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-indigo-500"/> Install SSH Key
                    </h3>
                    {!isInstallingKey && (
                        <button onClick={() => setInstallKeyTarget(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={18} />
                        </button>
                    )}
                </div>
                <div className="p-5 space-y-4">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        Enter the password for <strong>{installKeyTarget}</strong> to install the public key.
                    </div>
                    <div>
                        <input 
                            type="password" 
                            autoFocus
                            placeholder="Server Password"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            value={installKeyPassword}
                            onChange={e => setInstallKeyPassword(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter' && installKeyPassword && !isInstallingKey) {
                                    handleInstallKey();
                                }
                            }}
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700">
                    <Button variant="ghost" size="sm" onClick={() => setInstallKeyTarget(null)} disabled={isInstallingKey}>Cancel</Button>
                    <Button 
                        size="sm" 
                        disabled={!installKeyPassword || isInstallingKey} 
                        onClick={handleInstallKey}
                    >
                        {isInstallingKey ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Server className="w-3 h-3 mr-2"/>}
                        {isInstallingKey ? 'Installing...' : 'Install Key'}
                    </Button>
                </div>
           </div>
        </div>
      )}

      {installBorgTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-500"/> Install BorgBackup
                    </h3>
                    {!isInstallingBorg && (
                        <button onClick={() => setInstallBorgTarget(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X size={18} />
                        </button>
                    )}
                </div>
                <div className="p-5 space-y-4">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        <p className="mb-2">Enter the password for <strong>{installBorgTarget}</strong> to install BorgBackup.</p>
                        <p className="text-xs text-slate-400">This will run <code>apt-get install borgbackup</code>. A sudo password may be required.</p>
                    </div>

                    <div>
                        <input 
                            type="password" 
                            autoFocus
                            placeholder="Sudo/Root Password"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            value={installBorgPassword}
                            onChange={e => setInstallBorgPassword(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter' && installBorgPassword && !isInstallingBorg) {
                                    handleInstallBorg();
                                }
                            }}
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700">
                    <Button variant="ghost" size="sm" onClick={() => setInstallBorgTarget(null)} disabled={isInstallingBorg}>Cancel</Button>
                    <Button 
                        size="sm" 
                        disabled={!installBorgPassword || isInstallingBorg} 
                        onClick={handleInstallBorg}
                    >
                        {isInstallingBorg ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Cloud className="w-3 h-3 mr-2"/>}
                        {isInstallingBorg ? 'Installing...' : 'Install Borg'}
                    </Button>
                </div>
           </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
               <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingRepoId ? 'Edit Repository' : 'Add Repository'}</h3>
               <button onClick={() => setIsModalOpen(false)} disabled={isInitializing} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
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
             
             <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
               
               {/* Quick Templates */}
               {!editingRepoId && !repoForm.url && (
                   <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                       <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Start Templates</label>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {['hetzner', 'borgbase', 'linux'].map((t) => (
                                <button key={t} onClick={() => handleApplyTemplate(t as any)} className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all text-xs font-medium text-slate-600 dark:text-slate-300 capitalize flex items-center justify-center gap-2">
                                    {t === 'linux' ? <Terminal className="w-3 h-3" /> : <Cloud className="w-3 h-3" />} {t}
                                </button>
                           ))}
                       </div>
                   </div>
               )}

               <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Display Name</label>
                        <input 
                        type="text" 
                        autoFocus
                        disabled={isInitializing}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        placeholder="e.g. Work Backups"
                        value={repoForm.name}
                        onChange={e => setRepoForm(prev => ({...prev, name: e.target.value}))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">SSH URL</label>
                        <input 
                        type="text" 
                        disabled={isInitializing}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        placeholder="ssh://user@example.com:22/./repo"
                        value={repoForm.url}
                        onChange={e => setRepoForm(prev => ({...prev, url: e.target.value}))}
                        />
                    </div>
                    
                    {/* Test Connection Button */}
                   {!editingRepoId && (addMode === 'connect' || (addMode === 'init' && repoForm.url.startsWith('ssh://'))) && repoForm.url && (
                       <div>
                           <Button 
                                variant="secondary" 
                                size="sm"
                                className="w-full" 
                                onClick={handleTestConnection}
                                disabled={isTesting}
                           >
                               {isTesting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Terminal className="w-3 h-3 mr-2" />}
                               {isTesting ? 'Testing Connection...' : 'Test ' + (repoForm.url.startsWith('ssh://') ? 'SSH & Remote ' : '') + 'Connection'}
                           </Button>
                           {testResult === 'success' && (
                               <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs flex items-center gap-2">
                                   <Check className="w-3 h-3" /> Connection successful
                               </div>
                           )}
                           {testResult === 'error' && (
                               <div className={`mt-3 p-3 rounded-lg text-sm border animate-in slide-in-from-top-1 duration-200 ${addRepoStep === 'borg_fail' ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200' : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-200'}`}>
                                   <div className="font-bold flex items-center gap-2 mb-1">
                                       {addRepoStep === 'borg_fail' ? <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400"/> : <XCircle className="w-4 h-4 text-red-600 dark:text-red-400"/>}
                                       {addRepoStep === 'borg_fail' ? 'BorgBackup Missing' : 'Connection Failed'}
                                   </div>
                                   
                                   <div className="text-xs opacity-90 mb-2 leading-relaxed">
                                       {addRepoStep === 'borg_fail' 
                                         ? "BorgBackup is not installed on the remote server. Please use the 'Install BorgBackup on Server' button below to fix this automatically." 
                                         : (addRepoStep === 'ssh_fail' 
                                             ? "Could not establish an SSH connection. Please ensure your SSH Public Key is deployed to the server."
                                             : "An error occurred while testing the connection."
                                           )
                                       }
                                   </div>

                                   {(addRepoStep !== 'borg_fail') && (
                                       <div className="mt-2 p-2 bg-black/5 dark:bg-black/30 rounded font-mono text-[10px] break-all max-h-24 overflow-y-auto">
                                           {testLog.split('\n').map((line, i) => (
                                               <div key={i} className={line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') ? 'text-red-600 dark:text-red-400 font-bold' : ''}>{line}</div>
                                           ))}
                                       </div>
                                   )}
                               </div>
                           )}
                       </div>
                   )}
                    
                    {/* SSH Key Management */}
                    <div className="space-y-3">
                         {/* SSH Keys Panel */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                               <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                   <Key className="w-3 h-3" /> SSH Authentication 
                                   <span className="text-[10px] font-normal text-slate-400 capitalize flex-1">
                                       &mdash; {sshKeyStatus === 'found' ? 'Key Present' : sshKeyStatus === 'missing' ? 'No Key' : 'Checking...'}
                                   </span>
                               </div>
                            </div>
                            
                            {sshKeyStatus === 'loading' && <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> Checking keys...</div>}
                            
                            {sshKeyStatus === 'missing' && (
                                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
                                    <span>No SSH key found in WSL (~/.ssh/id_ed25519).</span>
                                    <Button size="sm" variant="primary" onClick={handleGenerateKey} disabled={isSshAction}>
                                        {isSshAction ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <RefreshCw className="w-3 h-3 mr-1"/>}
                                        {isSshAction ? 'Gen...' : 'Generate '}
                                    </Button>
                                </div>
                            )}
                            
                            {sshKeyStatus === 'found' && sshPublicKey && (
                                <div className="space-y-2">
                                    <div className="relative group">
                                        <textarea 
                                            readOnly 
                                            value={sshPublicKey} 
                                            className="w-full h-16 p-2 text-[10px] font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded resize-none focus:outline-none text-slate-700 dark:text-gray-300"
                                        />
                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { navigator.clipboard.writeText(sshPublicKey); toast.show("SSH Public Key copied to clipboard", 'success'); }}
                                                className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-500"
                                                title="Copy Public Key"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleCheckKey()}
                                            className="px-2 py-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                                            title="Refresh"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const { target, port } = parseTargetFromUrl();
                                                setInstallKeyTarget(target);
                                                setInstallKeyPort(port || null);
                                                setInstallKeyPassword('');
                                            }}
                                            disabled={addRepoStep !== 'ssh_fail'}
                                            className={`flex-1 px-3 py-1.5 text-[10px] uppercase font-bold text-white bg-indigo-500 rounded flex items-center justify-center gap-1.5 transition-colors ${addRepoStep !== 'ssh_fail' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600'}`}
                                        >
                                            <Server className="w-3 h-3" /> Install SSH Key
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Remote Server Setup */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <Cloud className="w-3 h-3"/> Remote Server Tools
                                </span>
                            </div>
                            <button 
                                onClick={() => {
                                    const { target, port } = parseTargetFromUrl();
                                    setInstallBorgTarget(target);
                                    setInstallBorgPort(port || null);
                                    setInstallBorgPassword('');
                                    setConnectionTestStatus('none');
                                }}
                                disabled={addRepoStep !== 'borg_fail'}
                                className={`w-full px-3 py-1.5 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center gap-1.5 transition-colors ${addRepoStep !== 'borg_fail' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                <Cloud className="w-3 h-3" /> Install BorgBackup on Server
                            </button>
                            <p className="text-[9px] text-slate-400 mt-1.5 text-center px-1">
                                Installs <code>borgbackup</code> on compatible Debian/Ubuntu servers via apt-get.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Encryption Mode</label>
                            <select 
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all text-slate-900 dark:text-white"
                                value={repoForm.encryption}
                                onChange={e => setRepoForm(prev => ({...prev, encryption: e.target.value as any}))}
                                disabled={isInitializing}
                            >
                                <option value="repokey" className="dark:bg-slate-900">Repokey</option>
                                <option value="keyfile" className="dark:bg-slate-900">Keyfile</option>
                                <option value="none" className="dark:bg-slate-900">None</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Passphrase</label>
                            <input 
                                type="password" 
                                disabled={isInitializing}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                placeholder={editingRepoId ? "Keep Current" : "Required"}
                                value={repoForm.passphrase}
                                onChange={e => setRepoForm(prev => ({...prev, passphrase: e.target.value}))}
                            />
                        </div>
                    </div>
               </div>
               
               {addMode === 'init' && repoForm.encryption !== 'none' && (
                   <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-800">
                     <label className="block text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider mb-1.5">Confirm Passphrase</label>
                     <input 
                       type="password" 
                       disabled={isInitializing}
                       className={`w-full px-3 py-2 bg-white dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 ${
                           confirmPassphrase && confirmPassphrase !== repoForm.passphrase ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-slate-700 focus:border-indigo-500'
                       }`}
                       placeholder="Re-enter to confirm"
                       value={confirmPassphrase}
                       onChange={e => setConfirmPassphrase(e.target.value)}
                     />
                     {confirmPassphrase && confirmPassphrase !== repoForm.passphrase && (
                         <p className="text-red-500 text-[10px] mt-1 font-bold">Passphrases do not match</p>
                     )}
                   </div>
               )}

               <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                    <input 
                        type="checkbox" 
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={repoForm.trustHost}
                        onChange={(e) => setRepoForm(prev => ({...prev, trustHost: e.target.checked}))}
                        disabled={isInitializing}
                    />
                    <div>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Trust Unknown Host</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Accept SSH fingerprint automatically (fixes "Host unknown" errors)</p>
                    </div>
               </label>
               
               {/* Test Connection Button - OLD LOCATION REMOVED */}

               {initError && (
                   <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-xs rounded-lg border border-red-100 dark:border-red-900/50 flex items-start gap-2">
                       <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                       <div><strong>Error:</strong> {initError}</div>
                   </div>
               )}
               
               {isInitializing && (
                   <div className="bg-slate-900 p-4 rounded-lg text-xs font-mono text-slate-300 max-h-32 overflow-y-auto border border-slate-700">
                        <div className="flex items-center gap-2 text-blue-400 mb-2 font-bold uppercase tracking-wider">
                            <Loader2 className="w-3 h-3 animate-spin" /> Initializing...
                        </div>
                        <div className="whitespace-pre-wrap">{initLog}</div>
                   </div>
               )}

             </div>

             <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 shrink-0">
               <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isInitializing}>Cancel</Button>
               <Button 
                    onClick={handleSave} 
                    disabled={!repoForm.name || !repoForm.url || isInitializing || (repoForm.url.startsWith('ssh://') && addRepoStep !== 'success')} 
                    loading={isInitializing}
               >
                   {editingRepoId ? 'Save Changes' : (addMode === 'init' ? 'Initialize' : 'Connect')}
               </Button>
             </div>
           </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Repositories</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage remote storage locations.</p>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="Search..."
                  className="w-64 pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-900 dark:text-white shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>
             
             <Button onClick={handleOpenAdd} className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
             </Button>
        </div>
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
            onEdit={() => handleOpenEdit(repo)} 
            onMaintenance={() => { setMaintenanceRepo(repo); setIsMaintenanceOpen(true); }}
            onExportKey={() => setExportKeyRepo(repo)}
            onBackup={(r) => setBackupRepo(r)}
            onManageJobs={(r) => setJobsRepo(r)}
          />
        ))}
        {filteredRepos.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50/50 dark:bg-slate-800/50">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-full mb-3 shadow-sm">
                    <Cloud className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-semibold">No repositories found</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-4 max-w-sm">Connect a remote SSH server, Local NAS, or Hetzner StorageBox to start backing up your data.</p>
                <Button onClick={handleOpenAdd} variant="secondary">
                   <Plus className="w-4 h-4 mr-2" />
                   Add your first repository
                </Button>
            </div>
        )}
      </div>
    </div>
  );
};

export default RepositoriesView;
