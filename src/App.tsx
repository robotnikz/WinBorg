import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import RepositoriesView from './views/RepositoriesView';
import JobsView from './views/JobsView';
import MountsView from './views/MountsView';
import SettingsView from './views/SettingsView';
import DashboardView from './views/DashboardView';
import ActivityView from './views/ActivityView';
import ArchivesView from './views/ArchivesView';
import RepoDetailsView from './views/RepoDetailsView';
import TerminalModal from './components/TerminalModal';
import FuseSetupModal from './components/FuseSetupModal';
import CreateBackupModal from './components/CreateBackupModal';
import { View, Repository, MountPoint, Archive, ActivityLogEntry, BackupJob, SshConnection } from './types';
import { borgService } from './services/borgService';
import { formatDate } from './utils/formatters';
import { ToastContainer } from './components/ToastContainer';
import { toast } from './utils/eventBus';
import { Loader2 } from 'lucide-react';
import OnboardingModal from './components/OnboardingModal';
import UpdateModal from './components/UpdateModal';
import { getIpcRendererOrNull } from './services/electron';
import RestoreView, { RestoreTab } from './views/RestoreView';
import ConnectionsView from './views/ConnectionsView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  
  // --- ONBOARDING STATE ---
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCheckedSystem, setHasCheckedSystem] = useState(false);
    const systemCheckedRef = useRef(false);

  // --- THEME STATE (Keep simple in localstorage for UI pref only) ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
      const saved = localStorage.getItem('winborg_theme');
      return saved ? saved === 'dark' : true;
  });

    useEffect(() => {
        // Borg ops can get queued per repository. Avoid stacking multiple toasts:
        // show a single persistent toast while ANY queued command is waiting.
        const queuedCommandIds = new Set<string>();
        let toastId: string | null = null;

        const showIfNeeded = () => {
            if (queuedCommandIds.size === 0) return;
            if (toastId) return;
            toastId = toast.loading('Waiting for an ongoing repository operation…');
        };

        const dismissIfDone = () => {
            if (queuedCommandIds.size !== 0) return;
            if (!toastId) return;
            toast.dismiss(toastId);
            toastId = null;
        };

        const onQueued = (e: any) => {
            const commandId = e?.detail?.commandId;
            if (typeof commandId === 'string' && commandId.length > 0) {
                queuedCommandIds.add(commandId);
            } else {
                // Fallback: still show a single toast even if detail is missing.
                queuedCommandIds.add('unknown');
            }
            showIfNeeded();
        };

        const onDequeued = (e: any) => {
            const commandId = e?.detail?.commandId;
            if (typeof commandId === 'string' && commandId.length > 0) {
                queuedCommandIds.delete(commandId);
            } else {
                queuedCommandIds.clear();
            }
            dismissIfDone();
        };

        try {
            window.addEventListener('winborg:borg-queued', onQueued as any);
            window.addEventListener('winborg:borg-dequeued', onDequeued as any);
            return () => {
                window.removeEventListener('winborg:borg-queued', onQueued as any);
                window.removeEventListener('winborg:borg-dequeued', onDequeued as any);
                // Cleanup any persistent toast to avoid leaking UI on hot reload.
                if (toastId) toast.dismiss(toastId);
            };
        } catch {
            return;
        }
    }, []);

    useEffect(() => {
            localStorage.setItem('winborg_theme', isDarkMode ? 'dark' : 'light');
            if (isDarkMode) {
                    document.documentElement.classList.add('dark');
            } else {
                    document.documentElement.classList.remove('dark');
            }
    }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- AUTO UPDATE LISTENERS ---
  useEffect(() => {
        const ipcRenderer = getIpcRendererOrNull();
        if (!ipcRenderer) return;

    ipcRenderer.on('update-available', (event: any, info: any) => {
        setUpdateAvailable(true);
        setUpdateInfo(info);
        setShowUpdateModal(true);
    });

    ipcRenderer.on('download-progress', (event: any, progressObj: any) => {
        setIsDownloadingUpdate(true);
        setUpdateProgress(progressObj.percent);
    });

    ipcRenderer.on('update-downloaded', () => {
        setIsDownloadingUpdate(false);
        setIsUpdateReady(true);
        setUpdateProgress(100);
        // Prompt user to restart now? The modal will likely handle this transition if it's open.
        // If modal was closed, we might want to show a toast or notification.
        // toast.success("Update downloaded. Restart to install.");
    });

    ipcRenderer.on('update-error', (event: any, message: string) => {
        setIsDownloadingUpdate(false);
        setUpdateProgress(0);
        toast.error(`Updater Error: ${message}`);
    });

    return () => {
       ipcRenderer.removeAllListeners('update-available');
       ipcRenderer.removeAllListeners('download-progress');
       ipcRenderer.removeAllListeners('update-downloaded');
       ipcRenderer.removeAllListeners('update-error');
    };
  }, []);

  // --- MAIN STATE ---
  const [repos, setRepos] = useState<Repository[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
    const [archivesRepoId, setArchivesRepoId] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [mounts, setMounts] = useState<MountPoint[]>([]);
    const [connections, setConnections] = useState<SshConnection[]>([]);
  
  // --- UPDATE STATE ---
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const [preselectedRepoId, setPreselectedRepoId] = useState<string | null>(null);
    const [restoreTab, setRestoreTab] = useState<RestoreTab>('archives');
  const [detailRepo, setDetailRepo] = useState<Repository | null>(null);
    const [openJobsRepoId, setOpenJobsRepoId] = useState<string | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const dataLoadedRef = useRef(false);

  // --- EARLY SYSTEM CHECK (BLOCK UI UNTIL DONE) ---
  useEffect(() => {
      if (systemCheckedRef.current) return;
      systemCheckedRef.current = true;

      const run = async () => {
          try {
              const ipcRenderer = getIpcRendererOrNull();
              if (!ipcRenderer) return;
              const [wsl, borg] = await Promise.all([
                  ipcRenderer.invoke('system-check-wsl'),
                  ipcRenderer.invoke('system-check-borg'),
              ]);

              if (!wsl?.installed || !borg?.installed) {
                  setShowOnboarding(true);
              }
          } catch (e) {
              // Browser/mock mode: no-op, don't block the UI.
          } finally {
              setHasCheckedSystem(true);
          }
      };

      run();
  }, []);

  // --- LOAD DATA FROM BACKEND (PERSISTENCE) ---
  useEffect(() => {
      if (dataLoadedRef.current) return;

      const normalizeServerUrl = (serverUrl: string) => {
          const s = String(serverUrl || '').trim();
          if (!s) return '';
          return s.endsWith('/') ? s.slice(0, -1) : s;
      };

      const parseServerUrlFromRepoUrl = (repoUrl: string): string | null => {
          const u = String(repoUrl || '').trim();
          if (!u.toLowerCase().startsWith('ssh://')) return null;
          const afterProto = u.substring('ssh://'.length);
          const slashIndex = afterProto.indexOf('/');
          if (slashIndex === -1) return normalizeServerUrl(u);
          const hostPart = afterProto.substring(0, slashIndex);
          return normalizeServerUrl(`ssh://${hostPart}`);
      };

      const fnv1a32 = (str: string) => {
          let h = 0x811c9dc5;
          for (let i = 0; i < str.length; i++) {
              h ^= str.charCodeAt(i);
              h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
          }
          return h >>> 0;
      };

      const stableConnectionId = (serverUrl: string) => {
          const hash = fnv1a32(normalizeServerUrl(serverUrl)).toString(16).padStart(8, '0');
          return `conn_${hash}`;
      };

      const guessConnectionName = (serverUrl: string) => {
          const s = normalizeServerUrl(serverUrl);
          return s.toLowerCase().startsWith('ssh://') ? s.replace(/^ssh:\/\//i, '') : (s || 'SSH Connection');
      };

      const deriveConnectionsFromRepos = (reposToScan: Repository[]): { connections: SshConnection[]; repos: Repository[] } => {
          const now = new Date().toISOString();
          const serverToConn = new Map<string, SshConnection>();
          const derived: SshConnection[] = [];
          const updatedRepos = reposToScan.map((r) => {
              if (!r?.url || r.connectionId) return r;
              const serverUrl = parseServerUrlFromRepoUrl(r.url);
              if (!serverUrl) return r;
              const norm = normalizeServerUrl(serverUrl);
              let conn = serverToConn.get(norm);
              if (!conn) {
                  conn = { id: stableConnectionId(norm), name: guessConnectionName(norm), serverUrl: norm, createdAt: now, updatedAt: now };
                  serverToConn.set(norm, conn);
                  derived.push(conn);
              }
              return { ...r, connectionId: conn.id };
          });
          return { connections: derived, repos: updatedRepos };
      };
      
      const load = async () => {
          try {
              const ipcRenderer = getIpcRendererOrNull();
              if (!ipcRenderer) {
                  // Browser/mock mode: allow the UI to render without persistence.
                  setIsLoaded(true);
                  dataLoadedRef.current = true;
                  return;
              }
              const db = await ipcRenderer.invoke('get-db');
              
              // MIGRATION LOGIC: If DB is empty but LocalStorage has data, migrate it!
              let initialRepos = db.repos || [];
              let initialJobs = db.jobs || [];
              let initialArchives = db.archives || [];
              let initialArchivesRepoId = db.archivesRepoId || null;
              let initialLogs = db.activityLogs || [];
              let initialConnections = db.connections || [];

              if (initialRepos.length === 0) {
                  const lsRepos = localStorage.getItem('winborg_repos');
                  if (lsRepos) {
                      console.log("Migrating Repos from LocalStorage...");
                      try { initialRepos = JSON.parse(lsRepos); } catch(e) {}
                  }
              }
              if (initialJobs.length === 0) {
                  const lsJobs = localStorage.getItem('winborg_jobs');
                  if (lsJobs) {
                      console.log("Migrating Jobs from LocalStorage...");
                      try { initialJobs = JSON.parse(lsJobs); } catch(e) {}
                  }
              }

              // Sanitize Repos (remove legacy plain text passwords if any existed)
              const sanitizedRepos: Repository[] = (initialRepos || []).map((r: Repository) => ({
                  ...r,
                  passphrase: undefined,
                  status: 'disconnected', 
                  checkStatus: r.checkStatus === 'running' ? 'idle' : r.checkStatus,
                  checkProgress: r.checkStatus === 'running' ? undefined : r.checkProgress,
                  activeCommandId: undefined
              }));

              // Connections migration fallback (main process also migrates; this is for tests/browser mode/older DB mocks)
              let effectiveRepos: Repository[] = sanitizedRepos;
              let effectiveConnections: SshConnection[] = Array.isArray(initialConnections) ? initialConnections : [];
              if (effectiveConnections.length === 0) {
                  const derived = deriveConnectionsFromRepos(sanitizedRepos);
                  effectiveConnections = derived.connections;
                  effectiveRepos = derived.repos;
              }

              // Normalize Jobs (multi-source migration + legacy field compatibility)
              const safeJobs = (initialJobs || []).map((j: any) => {
                  const rawSourcePaths = Array.isArray(j.sourcePaths) ? j.sourcePaths : [];
                  const cleanedSourcePaths = rawSourcePaths.map((p: any) => String(p).trim()).filter(Boolean);
                  const legacySourcePath = j.sourcePath ? String(j.sourcePath).trim() : '';

                  const finalSourcePaths = cleanedSourcePaths.length
                      ? cleanedSourcePaths
                      : (legacySourcePath ? [legacySourcePath] : []);

                  return {
                      ...j,
                      sourcePath: legacySourcePath || finalSourcePaths[0] || '',
                      sourcePaths: finalSourcePaths
                  };
              });

              setRepos(effectiveRepos);
              reposRef.current = effectiveRepos;
              setJobs(safeJobs);
              setArchives(initialArchives);
              setArchivesRepoId(initialArchivesRepoId);
              setActivityLogs(initialLogs);
              setConnections(effectiveConnections);
              
              setIsLoaded(true);
              dataLoadedRef.current = true;

              // Immediately save to backend to finalize migration
              if (effectiveRepos.length > 0 || initialJobs.length > 0 || effectiveConnections.length > 0) {
                  ipcRenderer.invoke('save-db', { 
                      repos: effectiveRepos,
                      jobs: safeJobs, 
                      archives: initialArchives, 
                      archivesRepoId: initialArchivesRepoId,
                      activityLogs: initialLogs,
                      connections: effectiveConnections
                  });
              }

          } catch (e) {
              console.warn("Could not load backend data (Browser Mode?)", e);
              setIsLoaded(true);
              setHasCheckedSystem(true);
          }
      };
      load();
  }, []);

  // --- SAVE DATA TO BACKEND ---
  useEffect(() => {
      if (!isLoaded) return;
      try {
          const ipcRenderer = getIpcRendererOrNull();
          if (!ipcRenderer) return;
          // We save essentially everything except mounts (ephemeral)
          ipcRenderer.invoke('save-db', { repos, jobs, archives, archivesRepoId, activityLogs, connections });
      } catch(e) {}
  }, [repos, jobs, archives, archivesRepoId, activityLogs, connections, isLoaded]);

  const handleAddConnection = (conn: SshConnection) => {
      setConnections(prev => {
          const next = [...prev, conn];
          return next;
      });
      toast.success('Connection added');
  };

  const handleUpdateConnection = (conn: SshConnection) => {
      setConnections(prev => prev.map(c => c.id === conn.id ? conn : c));
      toast.success('Connection updated');
  };

  const handleDeleteConnection = (id: string) => {
      setConnections(prev => prev.filter(c => c.id !== id));
      // Keep repos intact; only clear the reference.
      setRepos(prev => prev.map(r => r.connectionId === id ? { ...r, connectionId: undefined } : r));
      toast.info('Connection removed');
  };

  const handleReorderConnections = (next: SshConnection[]) => {
      setConnections(next);
  };

  // --- BACKGROUND LISTENER ---
  useEffect(() => {
      try {
          const ipcRenderer = getIpcRendererOrNull();
          if (!ipcRenderer) return;
          
          type JobStartedPayload =
              | string
              | { jobId: string; repoId?: string; commandId?: string };

          type JobCompletePayload = {
              jobId: string;
              success: boolean;
              repoId?: string;
              commandId?: string;
          };

          const handleJobStarted = (_: any, payload: JobStartedPayload) => {
              const jobId = typeof payload === 'string' ? payload : payload.jobId;
              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'running' } : j));

              if (typeof payload !== 'string' && payload.repoId && payload.commandId) {
                  const repo = reposRef.current.find(r => r.id === payload.repoId);
                  if (repo) {
                      startRepoBackup(repo, payload.commandId, jobId);
                  }
              }
          };

          const handleJobComplete = (_: any, payload: JobCompletePayload) => {
              const { jobId, success } = payload;
              setJobs(prev => prev.map(j => j.id === jobId ? {
                  ...j,
                  status: success ? 'success' : 'error',
                  lastRun: new Date().toISOString()
              } : j));

              if (payload.repoId) {
                  const repo = reposRef.current.find(r => r.id === payload.repoId);
                  if (repo) {
                      const startTime = repo.backupStartTime;
                      const durationMs = typeof startTime === 'number' ? Date.now() - startTime : undefined;
                      finishRepoBackup(repo, success ? 'success' : 'error', durationMs);
                  }
              }
          };

          const handleActivityLog = (_: any, log: ActivityLogEntry) => {
              const newLog: ActivityLogEntry = {
                  id: Math.random().toString(36).substr(2, 9),
                  time: new Date().toISOString(),
                  ...log
              };
              setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
              if(log.status === 'success') toast.success(log.title);
              if(log.status === 'error') toast.error(log.title);
          };

          ipcRenderer.on('job-started', handleJobStarted);
          ipcRenderer.on('job-complete', handleJobComplete);
          ipcRenderer.on('activity-log', handleActivityLog);

          return () => {
              ipcRenderer.removeListener('job-started', handleJobStarted);
              ipcRenderer.removeListener('job-complete', handleJobComplete);
              ipcRenderer.removeListener('activity-log', handleActivityLog);
          };
      } catch(e) {}
  }, []);

  // --- TASKBAR PROGRESS ---
  useEffect(() => {
      const runningRepo = repos.find(r => r.checkStatus === 'running');
      try {
          const ipcRenderer = getIpcRendererOrNull();
          if (!ipcRenderer) return;
          if (runningRepo && runningRepo.checkProgress !== undefined) {
              ipcRenderer.send('set-progress', runningRepo.checkProgress / 100);
          } else {
              ipcRenderer.send('set-progress', -1);
          }
      } catch(e) {}
  }, [repos]);

  // --- MODAL STATES FOR DASHBOARD ACCESS ---
    const [backupModal, setBackupModal] = useState<{ repo: Repository; isOpen: boolean } | null>(null);

  // Helper to add activity
  const addActivity = (title: string, detail: string, status: 'success' | 'warning' | 'error' | 'info', cmd?: string) => {
      const newLog: ActivityLogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          title,
          detail,
          time: new Date().toISOString(),
          status,
          cmd
      };
      setActivityLogs(prev => [newLog, ...prev].slice(0, 100));
  };

  // Helper to check lock status for a repo
  const checkRepoLock = async (repo: Repository) => {
      if(!repo.url) return;
      const isLocked = await borgService.checkLockStatus(repo.url, { disableHostCheck: repo.trustHost });
      setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, isLocked } : r));
  };

  const reposRef = useRef<Repository[]>([]);
  useEffect(() => {
      reposRef.current = repos;
  }, [repos]);

  // Mount Listener
  useEffect(() => {
    try {
        const ipcRenderer = getIpcRendererOrNull();
        if (!ipcRenderer) return;
        const handleMountExited = (
            _: any,
            { mountId, code, expected }: { mountId: string, code: number, expected?: boolean }
        ) => {
            console.log(`Mount ${mountId} exited with code ${code}`);

            setMounts(prev => {
                const mount = prev.find(m => m.id === mountId);
                if (mount) {
                     if (!expected) {
                         addActivity('Mount Crashed', `Mount point ${mount.localPath} exited unexpectedly (Code ${code})`, 'error');
                         toast.error(`Mount exited unexpectedly: ${mount.archiveName}`);
                     }

                     const repo = reposRef.current.find(r => r.id === mount.repoId);
                     if (repo) setTimeout(() => checkRepoLock(repo), 1000);
                }
                return prev.filter(m => m.id !== mountId);
            });
        };

        ipcRenderer.on('mount-exited', handleMountExited);
        return () => {
            ipcRenderer.removeListener('mount-exited', handleMountExited);
        };
    } catch (e) {
        console.warn("Could not attach mount-exited listener");
    }
    }, []);

  // Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFuseHelp, setShowFuseHelp] = useState(false);
    const [fuseOfferRepair, setFuseOfferRepair] = useState(false);

  // Helper to run commands
  const runCommand = async (
      title: string, 
      args: string[], 
      onSuccess?: (output: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean, remotePath?: string }
  ) => {
    setTerminalTitle(title);
    setTerminalLogs([]);
    setIsProcessing(true);

    let fullOutput = '';
    const success = await borgService.runCommand(args, (log) => {
        setTerminalLogs(prev => [...prev, log.trimEnd()]); 
        fullOutput += log;
    }, overrides);

    setIsProcessing(false);
    if (success) {
        if (onSuccess) onSuccess(fullOutput);
    } else {
        setTerminalLogs(prev => [...prev, "Command failed. Please check the error above."]);
        setIsTerminalOpen(true);
    }
  };

  const handleMount = async (repoId: string, archiveName: string, path: string) => {
    const repo = repos.find(r => r.id === repoId);
    if (!repo) return;

    setTerminalTitle(`Mounting ${archiveName}`);
    setTerminalLogs([`Requesting mount of ${repo.url}::${archiveName} to ${path}...`]);
    setIsProcessing(true);
    
    addActivity('Mount Requested', `Mounting ${archiveName} to ${path}`, 'info');

    const result = await borgService.mount(
        repo.url, 
        archiveName, 
        path, 
        (log) => {
            setTerminalLogs(prev => [...prev, log.trim()]);
        }, 
        {
            repoId: repo.id, // Secure Injection
            disableHostCheck: repo.trustHost,
            remotePath: repo.remotePath
        }
    );

    setIsProcessing(false);
    setTimeout(() => checkRepoLock(repo), 1000);

    if (result.success) {
        addActivity('Mount Successful', `Archive ${archiveName} mounted at ${path}`, 'success');
        toast.success(`Mounted ${archiveName}`);
        
        setTerminalLogs(prev => [...prev, "Mount process started successfully."]);
        const newMount: MountPoint = {
          id: result.mountId || Date.now().toString(),
          repoId,
          archiveName,
          localPath: path,
          status: 'mounted',
        };
        setMounts(prev => [...prev, newMount]);
        setRestoreTab('mounts');
        setCurrentView(View.ARCHIVES);
        
        try {
            getIpcRendererOrNull()?.send('open-path', path);
        } catch(e) { console.error("Could not auto-open explorer"); }
        
    } else {
        addActivity('Mount Failed', `Failed to mount ${archiveName}: ${result.error || 'Unknown error'}`, 'error');
        toast.error(`Mount failed. See activity logs.`);
        setIsTerminalOpen(true);

        if (result.error === 'FUSE_MISSING') {
            setFuseOfferRepair(!!(result as any)?.offerWslRepair);
            setTimeout(() => {
                setIsTerminalOpen(false);
                setShowFuseHelp(true);
            }, 500);
        }
    }
  };

  const handleUnmount = async (id: string) => {
    const mount = mounts.find(m => m.id === id);
    if (!mount) return;

    setTerminalTitle(`Unmounting ${mount.localPath}`);
    setIsProcessing(true);

    await borgService.unmount(mount.id, mount.localPath);
    
    addActivity('Unmount', `Unmounted ${mount.localPath}`, 'success');
    toast.info(`Unmounted ${mount.localPath}`);
    
    setMounts(prev => prev.filter(m => m.id !== id));
    setIsProcessing(false);
    
    const repo = repos.find(r => r.id === mount.repoId);
    if (repo) setTimeout(() => checkRepoLock(repo), 1000);
  };

  const extractJson = (text: string) => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start > -1 && end > start) return text.substring(start, end + 1);
      return text;
  };

  const handleFetchArchiveStats = async (repo: Repository, archiveName: string) => {
     const stats = await borgService.getArchiveInfo(repo.url, archiveName, {
         repoId: repo.id,
         disableHostCheck: repo.trustHost,
         remotePath: repo.remotePath
     });

     if (stats) {
         setArchives(prev => prev.map(a => 
             a.name === archiveName ? { ...a, size: stats.size, duration: stats.duration } : a
         ));
         addActivity('Archive Stats Updated', `Fetched stats for ${archiveName} (${stats.size})`, 'success');
     } else {
         addActivity('Stats Fetch Failed', `Could not get info for ${archiveName}`, 'warning');
     }
  };

  const handleConnect = (repo: Repository) => {
    setRepos(prev => prev.map(r => ({
        ...r,
        status: r.id === repo.id ? 'connecting' : 'disconnected'
    })));

    runCommand(
        `Connecting to ${repo.name}`, 
        ['list', '--json', repo.url], 
        (rawOutput) => {
            checkRepoLock(repo);

            try {
                const jsonString = extractJson(rawOutput);
                const data = JSON.parse(jsonString);
                
                // Get the raw ISO time of the latest archive (Borg usually lists oldest to newest, but we check)
                const archivesRaw = data.archives || [];
                const latestArchiveRawTime = archivesRaw.length > 0 ? archivesRaw[archivesRaw.length - 1].time : null;

                const newArchives: Archive[] = archivesRaw.map((a: any) => ({
                    id: a.id || a.name,
                    name: a.name,
                    time: formatDate(a.time),
                    size: 'Unknown',
                    duration: 'Unknown'
                })).reverse();

                setArchives(newArchives);
                setArchivesRepoId(repo.id);
                addActivity('Connection Successful', `Connected to ${repo.name}`, 'success');
                toast.success(`Connected to ${repo.name}`);

                if (newArchives.length > 0) {
                    setTimeout(() => handleFetchArchiveStats(repo, newArchives[0].name), 500);
                }

                setRepos(prev => prev.map(r => 
                    r.id === repo.id ? { 
                        ...r, 
                        status: 'connected', 
                        lastBackup: latestArchiveRawTime || 'Never',
                        fileCount: newArchives.length,
                        checkStatus: (r.checkStatus === 'error' || r.checkStatus === 'aborted') ? 'idle' : r.checkStatus
                    } : { ...r, status: 'disconnected' }
                ));

                setTimeout(() => {
                     runCommand(
                        `Fetching Stats for ${repo.name}`,
                        ['info', '--json', repo.url],
                        (infoRawOutput) => {
                             try {
                                 const infoJson = extractJson(infoRawOutput);
                                 const infoData = JSON.parse(infoJson);
                                 const stats = infoData.cache?.stats || infoData.repository?.stats;
                                 let sizeStr = 'Unknown';
                                 let repoStats = undefined;

                                 if (stats && stats.unique_csize) {
                                     // Format size string for display
                                     const gb = stats.unique_csize / 1024 / 1024 / 1024;
                                     sizeStr = gb.toFixed(2) + ' GB';
                                     
                                     // Store raw stats for efficiency calculation
                                     repoStats = {
                                         originalSize: stats.total_size || 0,
                                         deduplicatedSize: stats.unique_csize || 0
                                     };
                                 }
                                 setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, size: sizeStr, stats: repoStats } : r));
                             } catch(e) {}
                        },
                        { repoId: repo.id, disableHostCheck: repo.trustHost, remotePath: repo.remotePath }
                     );
                }, 800);

            } catch (e) {
                addActivity('Connection Failed', `Failed to parse response from ${repo.name}`, 'error');
                toast.error(`Failed to connect to ${repo.name}`);
                setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, status: 'error' } : r));
            }
        },
        { repoId: repo.id, disableHostCheck: repo.trustHost, remotePath: repo.remotePath } // Secure Injection
    );
  };

  const handleRefreshArchives = () => {
      const activeRepo = repos.find(r => r.status === 'connected');
      if (activeRepo) handleConnect(activeRepo);
  };

  const handleCheckIntegrity = async (repo: Repository) => {
      const commandId = `check-${repo.id}-${Date.now()}`;
      setRepos(prev => prev.map(r => r.id === repo.id ? { 
          ...r, 
          checkStatus: 'running', 
          checkProgress: 0, 
          checkStartTime: Date.now(),
          activeCommandId: commandId
      } : r));
      
      addActivity('Integrity Check Started', `Started check on ${repo.name}`, 'info');
      toast.info(`Integrity check started for ${repo.name}`);

      const progressCallback = (log: string) => {
         const matches = [...log.matchAll(/(\d+\.\d+|\d+)%/g)];
         if (matches.length > 0) {
             const progress = parseFloat(matches[matches.length - 1][1]);
             if (!isNaN(progress)) {
                 setRepos(prev => prev.map(r => r.id === repo.id ? { ...r, checkProgress: progress } : r));
             }
         }
      };

      const success = await borgService.runCommand(
          ['check', '--progress', repo.url], 
          progressCallback,
          { repoId: repo.id, disableHostCheck: repo.trustHost, commandId: commandId, remotePath: repo.remotePath }
      );

      await checkRepoLock(repo);

      setRepos(prev => {
          const current = prev.find(r => r.id === repo.id);
          if (current?.checkStatus === 'aborted') return prev;
          
          if (success) {
              addActivity('Integrity Check Passed', `Repository ${repo.name} verified.`, 'success');
              toast.success(`Integrity check passed for ${repo.name}`);
          } else {
              addActivity('Integrity Check Failed', `Check failed for ${repo.name}.`, 'error');
              toast.error(`Integrity check failed for ${repo.name}`);
          }

          return prev.map(r => r.id === repo.id ? { 
            ...r, 
            checkStatus: success ? 'ok' : 'error', 
            checkProgress: success ? 100 : undefined,
            checkStartTime: undefined, 
            lastCheckTime: new Date().toLocaleString(), 
            activeCommandId: undefined
          } : r);
      });
  };

  const handleAbortCheck = async (repo: Repository) => {
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r, checkStatus: 'aborted', checkProgress: undefined, checkStartTime: undefined, activeCommandId: undefined
      } : r));
      addActivity('Integrity Check Aborted', `Cancelled check for ${repo.name}`, 'warning');
      if (repo.activeCommandId) {
          await borgService.stopCommand(repo.activeCommandId);
          setTimeout(() => checkRepoLock(repo), 1000);
      }
  };

  const loadEstimatedBackupDurationMs = (repoId: string): number | undefined => {
      try {
          const raw = localStorage.getItem('winborg_backup_duration_ms');
          if (!raw) return 10 * 60 * 1000; // default 10 minutes
          const parsed = JSON.parse(raw);
          const val = parsed?.[repoId];
          if (typeof val === 'number' && isFinite(val) && val > 0) return val;

          // Fallback: average across any known repos, else a sane default.
          const nums = Object.values(parsed || {}).filter(v => typeof v === 'number' && isFinite(v as any) && (v as any) > 0) as number[];
          if (nums.length > 0) {
              const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
              return Math.round(avg);
          }

          return 10 * 60 * 1000;
      } catch {
          return 10 * 60 * 1000;
      }
  };

  const recordBackupDurationMs = (repoId: string, durationMs: number) => {
      if (!isFinite(durationMs) || durationMs <= 0) return;
      try {
          const raw = localStorage.getItem('winborg_backup_duration_ms');
          const parsed = raw ? JSON.parse(raw) : {};
          const prev = typeof parsed?.[repoId] === 'number' ? parsed[repoId] : undefined;
          // Exponential smoothing so ETA doesn't jump around too much.
          const next = typeof prev === 'number' && isFinite(prev) && prev > 0
              ? Math.round(prev * 0.7 + durationMs * 0.3)
              : Math.round(durationMs);
          parsed[repoId] = next;
          localStorage.setItem('winborg_backup_duration_ms', JSON.stringify(parsed));
      } catch {
          // ignore
      }
  };

  const startRepoBackup = (repo: Repository, commandId: string, jobId?: string) => {
      const estimated = loadEstimatedBackupDurationMs(repo.id);
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r,
          backupStatus: 'running',
          backupStartTime: Date.now(),
          backupEstimatedDurationMs: estimated,
          activeBackupCommandId: commandId,
          activeBackupJobId: jobId
      } : r));
  };

  const finishRepoBackup = (repo: Repository, result: 'success' | 'error', durationMs?: number) => {
      if (typeof durationMs === 'number' && durationMs > 0 && result === 'success') {
          recordBackupDurationMs(repo.id, durationMs);
      }
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r,
          backupStatus: 'idle',
          backupStartTime: undefined,
          backupEstimatedDurationMs: undefined,
          activeBackupCommandId: undefined,
          activeBackupJobId: undefined
      } : r));
  };

  const cancelRepoBackup = (repo: Repository) => {
      setRepos(prev => prev.map(r => r.id === repo.id ? {
          ...r,
          backupStatus: 'aborted',
          backupStartTime: undefined,
          backupEstimatedDurationMs: undefined,
          activeBackupCommandId: undefined,
          activeBackupJobId: undefined
      } : r));
  };

  const handleAbortBackup = async (repo: Repository) => {
      const commandId = repo.activeBackupCommandId;
      const jobId = repo.activeBackupJobId;

      cancelRepoBackup(repo);
      addActivity('Backup Cancelled', `Cancelled backup for ${repo.name}`, 'warning');
      toast.info(`Backup cancelled for ${repo.name}`);

      // If it was a job backup, mark it as errored.
      if (jobId) {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
      }

      if (commandId) {
          await borgService.stopCommand(commandId);
          setTimeout(() => checkRepoLock(repo), 1000);
      }
  };
  
  const handleBreakLock = async (repo: Repository) => {
      if(!window.confirm(`FORCE UNLOCK REPO?\n\nThis will run 'borg break-lock'.`)) return;
      setTerminalTitle(`Unlocking Repo: ${repo.name}`);
      setTerminalLogs([]);
      setIsProcessing(true);
      
      await borgService.breakLock(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { repoId: repo.id, disableHostCheck: repo.trustHost, remotePath: repo.remotePath }
      );
      
      const deleteSuccess = await borgService.forceDeleteLockFiles(
          repo.url,
          (log) => setTerminalLogs(prev => [...prev, log.trim()]),
          { disableHostCheck: repo.trustHost, remotePath: repo.remotePath }
      );

      setIsProcessing(false);
      await checkRepoLock(repo);

      if(deleteSuccess) {
          addActivity('Unlock Successful', `Lock files removed for ${repo.name}`, 'success');
          toast.success("Repository unlocked.");
      } else {
          setIsTerminalOpen(true);
      }
  };

  const handleQuickMount = (repo: Repository) => {
    setPreselectedRepoId(repo.id);
        setRestoreTab('mounts');
        setCurrentView(View.ARCHIVES);
    handleConnect(repo);
  };
  
  const handleArchiveMount = (repo: Repository, archiveName: string) => {
      setPreselectedRepoId(repo.id);
            setRestoreTab('mounts');
            setCurrentView(View.ARCHIVES);
      if (repo.status !== 'connected') handleConnect(repo);
  };

  const handleAddRepo = (repoData: any) => {
    const newRepo: Repository = {
       id: repoData.id || Math.random().toString(36).substr(2, 9),
       name: repoData.name,
       url: repoData.url,
             connectionId: repoData.connectionId,
       encryption: repoData.encryption,
       trustHost: repoData.trustHost,
       remotePath: repoData.remotePath,
       lastBackup: 'Never',
       status: 'disconnected',
       size: 'Unknown',
       fileCount: 0,
       checkStatus: 'idle',
       lastCheckTime: 'Never'
    };
    setRepos(prev => [...prev, newRepo]);
    handleConnect(newRepo);
  };

  const handleEditRepo = (id: string, repoData: any) => {
     setRepos(prev => prev.map(r => r.id === id ? { ...r, ...repoData, status: 'disconnected' } : r));
  };

  const handleDeleteRepo = async (repoId: string) => {
      if (window.confirm("Remove this repository?")) {
          // Clean up secret
          await borgService.deletePassphrase(repoId);
          setRepos(prev => prev.filter(r => r.id !== repoId));
          // Clean up jobs for this repo
          setJobs(prev => prev.filter(j => j.repoId !== repoId));
          toast.success("Repository removed.");
      }
  };

  const handleAddJob = (job: BackupJob) => {
      setJobs(prev => [...prev, job]);
      toast.success("Backup Job created.");
  };

  const handleUpdateJob = (job: BackupJob) => {
      setJobs(prev => prev.map(j => j.id === job.id ? job : j));
      toast.success("Backup Job updated.");
  };

  const handleDeleteJob = (jobId: string) => {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast.info("Backup Job deleted.");
  };

  const handleRunJob = async (jobId: string) => {
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;
      const repo = repos.find(r => r.id === job.repoId);
      if (!repo) {
          toast.error("Repository not found for this job");
          return;
      }

      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'running' } : j));
      addActivity('Backup Job Started', `Job: ${job.name} (Repo: ${repo.name})`, 'info');

    const commandId = `job-${job.id}-${Date.now()}`;
    const startTime = Date.now();
    startRepoBackup(repo, commandId, job.id);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
      const archiveName = `${job.archivePrefix}-${dateStr}-${timeStr}`;

      const logs: string[] = [];
      const logCollector = (l: string) => logs.push(l);

      const effectiveSourcePaths = (job.sourcePaths && job.sourcePaths.length)
          ? job.sourcePaths
          : [job.sourcePath];

      try {
          const success = await borgService.createArchive(
              repo.url,
              archiveName,
              effectiveSourcePaths,
              logCollector,
              { repoId: repo.id, disableHostCheck: repo.trustHost, remotePath: repo.remotePath, commandId },
              { excludePatterns: job.excludePatterns }
          );

          if (success) {
              addActivity('Backup Job Success', `Created archive: ${archiveName}`, 'success');
              toast.success(`Job '${job.name}' finished successfully!`);
              
              if (job.pruneEnabled) {
                  addActivity('Auto Prune Started', `Pruning repo for job ${job.name}...`, 'info');
                  const pruneSuccess = await borgService.prune(
                      repo.url,
                      { daily: job.keepDaily, weekly: job.keepWeekly, monthly: job.keepMonthly, yearly: job.keepYearly },
                      logCollector,
                      { repoId: repo.id, disableHostCheck: repo.trustHost, remotePath: repo.remotePath }
                  );
                  if (pruneSuccess) {
                      addActivity('Auto Prune Success', `Repository pruned according to retention policy.`, 'success');
                  } else {
                      addActivity('Auto Prune Failed', `Pruning step failed. Check logs.`, 'warning');
                  }
              }

              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'success', lastRun: new Date().toISOString() } : j));
              if (repo.status === 'connected') handleConnect(repo); // Refresh archive list
              finishRepoBackup(repo, 'success', Date.now() - startTime);
          } else {
              finishRepoBackup(repo, 'error', Date.now() - startTime);
              setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
              addActivity('Backup Job Failed', `Job: ${job.name} failed`, 'error');
              toast.error(`Job '${job.name}' failed. Check activity log.`);
          }
      } catch (e: any) {
          finishRepoBackup(repo, 'error', Date.now() - startTime);
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'error' } : j));
          addActivity('Backup Job Error', e.message, 'error');
          toast.error(`Job '${job.name}' error: ${e.message}`);
      }
  };

  const renderContent = () => {
    if (!isLoaded) return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

    switch (currentView) {
      case View.REPOSITORIES:
        return (
          <RepositoriesView 
            repos={repos} 
            jobs={jobs}
                        connections={connections}
                        onOpenConnections={() => setCurrentView(View.CONNECTIONS)}
            onAddRepo={handleAddRepo} 
            onEditRepo={handleEditRepo}
            onConnect={handleConnect}
            onMount={handleQuickMount}
            onCheck={handleCheckIntegrity}
            onBreakLock={handleBreakLock}
            onDelete={handleDeleteRepo}
            onAddJob={handleAddJob}
                        onUpdateJob={handleUpdateJob}
            onDeleteJob={handleDeleteJob}
            onRunJob={handleRunJob}
                        onBackupStarted={startRepoBackup}
                        onBackupFinished={finishRepoBackup}
                        onBackupCancelled={cancelRepoBackup}
                        openJobsRepoId={openJobsRepoId}
                        onOpenJobsConsumed={() => setOpenJobsRepoId(null)}
          />
        );
            case View.CONNECTIONS:
                return (
                    <ConnectionsView
                        connections={connections}
                        onAddConnection={handleAddConnection}
                        onUpdateConnection={handleUpdateConnection}
                        onDeleteConnection={handleDeleteConnection}
                        onReorderConnections={handleReorderConnections}
                    />
                );
            case View.JOBS:
                return (
                    <JobsView
                        repos={repos}
                        jobs={jobs}
                        onChangeView={setCurrentView}
                        onAddJob={handleAddJob}
                        onUpdateJob={handleUpdateJob}
                        onDeleteJob={handleDeleteJob}
                        onRunJob={handleRunJob}
                        openJobsRepoId={openJobsRepoId}
                        onOpenJobsConsumed={() => setOpenJobsRepoId(null)}
                    />
                );
            case View.MOUNTS:
                // Backwards-compat / deep links: treat Mounts as a tab inside Archives.
                return (
                    <RestoreView
                        tab={'mounts'}
                        onTabChange={setRestoreTab}
                        archives={archives}
                        archivesRepoId={archivesRepoId}
                        repos={repos}
                        onArchiveMount={handleArchiveMount}
                        onRefreshArchives={handleRefreshArchives}
                        onGetInfo={(archiveName) => {
                            const repo = repos.find(r => r.status === 'connected');
                            if (repo) return handleFetchArchiveStats(repo, archiveName);
                            return Promise.resolve();
                        }}
                        mounts={mounts}
                        onUnmount={handleUnmount}
                        onMount={handleMount}
                        preselectedRepoId={preselectedRepoId}
                    />
                );
      case View.ARCHIVES:
        return (
                        <RestoreView
                            tab={restoreTab}
                            onTabChange={setRestoreTab}
                            archives={archives}
                            archivesRepoId={archivesRepoId}
                            repos={repos}
                            onArchiveMount={handleArchiveMount}
                            onRefreshArchives={handleRefreshArchives}
                            onGetInfo={(archiveName) => {
                                const repo = repos.find(r => r.status === 'connected');
                                if (repo) return handleFetchArchiveStats(repo, archiveName);
                                return Promise.resolve();
                            }}
                            mounts={mounts}
                            onUnmount={handleUnmount}
                            onMount={handleMount}
                            preselectedRepoId={preselectedRepoId}
                        />
        );
      case View.REPO_DETAILS:
        return detailRepo ? (
           <RepoDetailsView repo={detailRepo} onBack={() => setCurrentView(View.DASHBOARD)} /> 
        ) : (
           <div className="flex h-full items-center justify-center">Select a repository</div>
        );
      case View.SETTINGS: return <SettingsView />;
      case View.ACTIVITY: return <ActivityView logs={activityLogs} onClearLogs={() => setActivityLogs([])} />;
      case View.DASHBOARD:
      default:
        return (
           <DashboardView 
              repos={repos} 
              mounts={mounts}
              jobs={jobs}
              activityLogs={activityLogs}
              onQuickMount={handleQuickMount}
              onConnect={handleConnect}
              onCheck={handleCheckIntegrity}
                  onAbortBackup={handleAbortBackup}
              onChangeView={setCurrentView}
              onViewDetails={(repo) => { setDetailRepo(repo); setCurrentView(View.REPO_DETAILS); }}
              onAbortCheck={handleAbortCheck}
                            onManageJobs={(repo) => {
                                setOpenJobsRepoId(repo.id);
                                setCurrentView(View.JOBS);
                            }}
                  onOneOffBackup={(r) => setBackupModal({ repo: r, isOpen: true })}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              isLoading={!isLoaded}
           />
        );
    }
  };

  return (
    <div className="h-screen w-screen relative">
        <ToastContainer />
        
        <UpdateModal 
            isOpen={showUpdateModal} 
            onClose={() => setShowUpdateModal(false)}
            onUpdate={() => {
                const ipcRenderer = getIpcRendererOrNull();
                if (!ipcRenderer) return;
                if (isUpdateReady) {
                    ipcRenderer.send('install-update'); 
                } else {
                    ipcRenderer.send('download-update');
                }
            }}
            version={updateInfo?.version || ''}
            releaseNotes={updateInfo?.releaseNotes}
            downloading={isDownloadingUpdate}
            progress={updateProgress}
            readyToInstall={isUpdateReady}
        />

        {!hasCheckedSystem && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-lg bg-white/90 dark:bg-[#1e1e1e]/90 px-4 py-3 shadow-lg border border-gray-200 dark:border-[#333]" role="status" aria-live="polite" aria-label="Checking system">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-200">Checking system…</span>
                </div>
            </div>
        )}

        {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}

        {backupModal && (
          <CreateBackupModal 
              initialRepo={backupModal.repo}
              repos={repos} 
              isOpen={backupModal.isOpen}
              onClose={() => setBackupModal(prev => prev ? { ...prev, isOpen: false } : prev)}
              onLog={() => {}}
              onSuccess={() => { /* handled via onBackupFinished */ }}
              onBackupStarted={(repo, commandId) => startRepoBackup(repo, commandId)}
              onBackupFinished={(repo, result, durationMs) => {
                  finishRepoBackup(repo, result, durationMs);
                  if (result === 'success') handleConnect(repo);
                  setBackupModal(null);
              }}
              onBackupCancelled={(repo) => {
                  cancelRepoBackup(repo);
                  setBackupModal(null);
              }}
          />
        )}

        <div className="flex flex-col h-full w-full overflow-hidden bg-[#f3f3f3] dark:bg-[#0f172a] transition-colors duration-300">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden pt-9">
              <Sidebar 
                  currentView={currentView} 
                  onChangeView={(view) => { setCurrentView(view); setPreselectedRepoId(null); if (view !== View.ARCHIVES && view !== View.MOUNTS) setRestoreTab('archives'); }} 
                  updateAvailable={updateAvailable}
              />
              <TerminalModal isOpen={isTerminalOpen} title={terminalTitle} logs={terminalLogs} onClose={() => setIsTerminalOpen(false)} isProcessing={isProcessing} />
            <FuseSetupModal
                isOpen={showFuseHelp}
                showRepairButton={fuseOfferRepair}
                onClose={() => {
                    setShowFuseHelp(false);
                    setFuseOfferRepair(false);
                }}
            />
              <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-8 pt-4">
                   {renderContent()}
                </div>
              </main>
          </div>
        </div>
    </div>
  );
};

export default App;