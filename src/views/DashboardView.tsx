
import React, { useMemo, useState, useEffect } from 'react';
import { Repository, MountPoint, View, ActivityLogEntry, BackupJob } from '../types';
import { 
  ShieldCheck, 
  HardDrive, 
  Server, 
  Activity, 
  Zap,
  Loader2,
  Lock,
  Moon,
  Sun,
    Play,
  Plus,
  RefreshCw,
  FolderOpen,
  CalendarClock,
  Archive,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Database,
  Terminal,
  Clock,
  LayoutGrid
} from 'lucide-react';
import Button from '../components/Button';
import SystemStatusModal from '../components/SystemStatusModal';
import { parseSizeString, formatBytes, formatDate, formatDuration, getNextRunForRepo } from '../utils/formatters';
import { getIpcRendererOrNull } from '../services/electron';

interface DashboardViewProps {
  repos: Repository[];
  mounts: MountPoint[];
  jobs?: BackupJob[];
  activityLogs: ActivityLogEntry[];
  onQuickMount: (repo: Repository) => void;
  onConnect: (repo: Repository) => void;
  onCheck: (repo: Repository) => void;
  onChangeView: (view: any) => void;
  onViewDetails?: (repo: Repository) => void;
  onAbortCheck?: (repo: Repository) => void;
    onAbortBackup?: (repo: Repository) => void;
    onManageJobs?: (repo: Repository) => void;
    onOneOffBackup?: (repo: Repository) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  isLoading?: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
    repos, mounts, jobs, activityLogs, onQuickMount, onConnect, onCheck, onChangeView, onViewDetails, onAbortCheck, onAbortBackup, onManageJobs, onOneOffBackup, isDarkMode, toggleTheme, isLoading 
}) => {
  
  // Real-time Current File Logic
  const [currentFile, setCurrentFile] = useState<string>('');
  const [isSystemStatusOpen, setIsSystemStatusOpen] = useState(false);

  // Greeting Logic
  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 18) return 'Good Afternoon';
      return 'Good Evening';
  };
  
  // Listen for terminal logs to extract "Current File" being backed up
  useEffect(() => {
    const handleTerminalLog = (_: any, data: { id: string, text: string }) => {
        const lines = data.text.split('\n');
        for (const line of lines) {
            const match = line.match(/^[AMU]\s+(.+)$/);
            if (match) {
                setCurrentFile(match[1]);
                break; 
            }
        }
    };
    
    const ipcRenderer = getIpcRendererOrNull();
    if (!ipcRenderer) return;
    ipcRenderer.on('terminal-log', handleTerminalLog);
    return () => {
        ipcRenderer.removeListener('terminal-log', handleTerminalLog);
    };
  }, []);

  // Force update for ETA
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
      const hasRunningOp = repos.some(r => r.checkStatus === 'running' || r.backupStatus === 'running');
      if (hasRunningOp) {
          const interval = setInterval(() => setNow(Date.now()), 1000);
          return () => clearInterval(interval);
      }
  }, [repos]);

  const getBackupProgress = (repo: Repository): { pct?: number; etaLabel: string } => {
      if (repo.backupStatus !== 'running' || !repo.backupStartTime) return { pct: undefined, etaLabel: '' };

      const elapsedMs = Math.max(0, now - repo.backupStartTime);
      const est = repo.backupEstimatedDurationMs;

      if (!est || !isFinite(est) || est < 5_000) {
          return { pct: undefined, etaLabel: 'Estimating…' };
      }

      const ratio = elapsedMs / est;
      const pct = Math.max(0, Math.min(99, Math.round(ratio * 100)));
      const remainingMs = est - elapsedMs;
      const etaLabel = remainingMs > 0
          ? `ETA ${formatDuration(Math.round(remainingMs / 1000))}`
          : 'Overdue';

      return { pct, etaLabel };
  };

  // --- NEW LOGIC: STATUS CALCULATION ---
  const getRepoHealth = (repo: Repository) => {
      if (!repo.lastBackup || repo.lastBackup === 'Never') return 'unknown';
      const t = new Date(repo.lastBackup).getTime();
      if (isNaN(t)) return 'unknown';
      
      const diff = Date.now() - t;
      const days = diff / (1000 * 3600 * 24);
      
      if (days > 30) return 'critical';
      if (days > 7) return 'warning';
      return 'healthy';
  };

  const dashboardStats = useMemo(() => {
      let totalBytes = 0;
      let totalOriginalBytes = 0; // For efficiency calc
      
      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;
      let unknownCount = 0;

      repos.forEach(r => {
          let currentRepoStoredBytes = 0;

          // 1. Determine "Stored" size (Deduplicated/Compressed on Disk)
          if (r.stats && r.stats.deduplicatedSize > 0) {
              currentRepoStoredBytes = r.stats.deduplicatedSize;
          } else {
              currentRepoStoredBytes = parseSizeString(r.size);
          }
          totalBytes += currentRepoStoredBytes;
          
          // 2. Determine "Original" size (Logical size of all archives)
          if (r.stats && r.stats.originalSize > 0) {
              totalOriginalBytes += r.stats.originalSize;
          } else {
             // If unavailable, assume 1:1 ratio (0% efficiency)
             totalOriginalBytes += currentRepoStoredBytes;
          }

          const health = getRepoHealth(r);
          if (health === 'healthy') healthyCount++;
          else if (health === 'warning') warningCount++;
          else if (health === 'critical') criticalCount++;
          else unknownCount++;
      });

      // Calculate Efficiency
      let savings = 0;
      let savingsPercent = 0;
      
      if (totalOriginalBytes > 0 && totalOriginalBytes >= totalBytes) {
          savings = totalOriginalBytes - totalBytes;
          savingsPercent = Math.round((savings / totalOriginalBytes) * 100);
      }

      return {
          totalSize: formatBytes(totalBytes),
          savings: formatBytes(savings),
          savingsPercent,
          counts: { healthy: healthyCount, warning: warningCount, critical: criticalCount, unknown: unknownCount }
      };
  }, [repos]);

  const getRelativeTime = (iso: string) => {
      try {
          const diff = Date.now() - new Date(iso).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return 'Just now';
          if (mins < 60) return `${mins}m ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours}h ago`;
          const days = Math.floor(hours / 24);
          if (days < 7) return `${days}d ago`;
          return formatDate(iso).split(',')[0]; // Just date
      } catch (e) { return 'Unknown'; }
  };

  const getEta = (repo: Repository): string => {
      if (repo.checkStatus !== 'running' || !repo.checkProgress) return '';
      // Simple ETA based on progress (0-100)
      if (repo.checkProgress < 2) return 'Calculating...';
      return `${Math.round(repo.checkProgress)}%`; 
  };

    const showQuickStart = repos.length === 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        
        {/* UNIFIED HEADER */}
        <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{getGreeting()}. Here is your backup overview.</p>
            </div>
            
            <div className="flex items-center gap-3">
                 <button onClick={toggleTheme} title="Toggle Theme" aria-label="Toggle Theme" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
                     {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                 </button>
            </div>
        </div>

                {showQuickStart && (
                    <div data-testid="dashboard-quick-start" className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-800 dark:text-white">Quick Start</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    New here? Create a connection (SSH), add a repository, then create a job.
                                </div>
                                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                    <div><span className="font-semibold">1.</span> Connections (optional) → Deploy your SSH key</div>
                                    <div><span className="font-semibold">2.</span> Repositories → Add and connect a repo</div>
                                    <div><span className="font-semibold">3.</span> Jobs → Create a schedule and run</div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                <Button size="sm" onClick={() => onChangeView(View.CONNECTIONS)}>
                                    <Plus className="w-3 h-3 mr-2" /> Add Connection
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => onChangeView(View.REPOSITORIES)}>
                                    <Server className="w-3 h-3 mr-2" /> Add Repository
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => onChangeView(View.JOBS)}>
                                    <CalendarClock className="w-3 h-3 mr-2" /> Create Job
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                 <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-full">
                     <HardDrive className="w-6 h-6" />
                 </div>
                 <div>
                     <div className="text-2xl font-bold text-slate-800 dark:text-white">{dashboardStats.totalSize}</div>
                     <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Stored</div>
                 </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4 group hover:border-green-200/50 transition-colors">
                 <div className="p-3 bg-green-100 dark:bg-green-900/40 text-green-600 rounded-full">
                     <Zap className="w-6 h-6" />
                 </div>
                 <div>
                     <div className="text-2xl font-bold text-slate-800 dark:text-white">{dashboardStats.savingsPercent}%</div>
                     <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Efficiency</div>
                 </div>
                 
                 {/* Tooltip / Hint */}
                 <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs p-2 rounded shadow-lg -top-12 left-1/2 -translate-x-1/2 w-48 pointer-events-none z-50">
                    Deduplication saved approx {dashboardStats.savings} of space.
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                 </div>
            </div>

            <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4 ${dashboardStats.counts.critical > 0 ? 'border-red-500 dark:border-red-500' : ''}`}>
                 <div className={`p-3 rounded-full ${dashboardStats.counts.critical > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                     <ShieldCheck className="w-6 h-6" />
                 </div>
                 <div>
                     <div className="text-2xl font-bold text-slate-800 dark:text-white">
                         {dashboardStats.counts.healthy} / {repos.length}
                     </div>
                     <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Healthy Repos</div>
                 </div>
            </div>

            <button onClick={() => setIsSystemStatusOpen(true)} className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl shadow-md text-white flex items-center justify-between hover:shadow-lg hover:scale-[1.02] transition-all">
                <div>
                     <div className="text-lg font-bold">System Status</div>
                     <div className="text-xs opacity-90">Borg & Drivers</div>
                </div>
                <Activity className="w-8 h-8 opacity-80" />
            </button>
        </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)]"> 
          
          {/* LEFT: REPO CARDS */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400" /> Active Repositories
              </h3>

               <div className="space-y-4">
                  {isLoading ? (
                      <div className="text-center py-20">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                          <p className="text-slate-400 text-sm">Loading repositories...</p>
                      </div>
                  ) : repos.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                           <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                           <h3 className="font-semibold text-slate-700 dark:text-slate-200">No Repositories</h3>
                           <p className="text-slate-500 text-sm mb-4">Add your first backup location to get started.</p>
                           <Button onClick={() => onChangeView(View.REPOSITORIES)}>
                               <Plus className="w-4 h-4 mr-2" />
                               Add Repository
                           </Button>
                      </div>
                  ) : (
                      repos.map(repo => {
                          const nextRun = jobs ? getNextRunForRepo(jobs, repo.id) : null;
                          const hasAnyJobs = !!jobs?.some(j => j.repoId === repo.id);
                          const health = getRepoHealth(repo);
                                                    const connectionLabel = repo.status === 'connected'
                                                        ? 'Online'
                                                        : repo.status === 'connecting'
                                                            ? 'Connecting'
                                                            : 'Offline';
                          const borderColor = 
                                health === 'critical' ? 'border-red-500' :
                                health === 'warning' ? 'border-yellow-500' :
                                repo.checkStatus === 'running' ? 'border-blue-500' :
                                'border-transparent'; // Default handled by card bg

                          return (
                              <div key={repo.id} className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border-t-4 hover:shadow-md transition-all group relative ${borderColor}`}>
                                  {/* Card Header */}
                                  <div className="flex justify-between items-start mb-4">
                                      <div className="flex gap-3 overflow-hidden">
                                          <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${repo.status === 'connected' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                          <div className="min-w-0">
                                              <h3 className="font-bold text-slate-800 dark:text-white truncate" title={repo.name}>{repo.name}</h3>
                                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                  <HardDrive className="w-3 h-3" /> {repo.size} used
                                              </div>
                                          </div>
                                      </div>
                                      {/* Status Badge */}
                                                                            <div className="flex items-center gap-2">
                                                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                                                        repo.status === 'connected'
                                                                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                                                                            : repo.status === 'connecting'
                                                                                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                                                                                : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                                                                                    }`} title={`Connection: ${connectionLabel}`}>
                                                                                        {connectionLabel}
                                                                                    </div>

                                                                                    <div className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                                                                                        health === 'critical'
                                                                                            ? 'bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                                            : health === 'warning'
                                                                                                ? 'bg-yellow-100/70 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                                                                : 'bg-green-100/70 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                                    }`} title="Backup health based on last snapshot">
                                                                                        {health === 'critical' ? 'At Risk' : health === 'warning' ? 'Warning' : 'Healthy'}
                                                                                    </div>
                                                                            </div>
                                  </div>

                                  {/* Last Backup Display */}
                                  <div className="mb-6">
                                      <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Last Snapshot</div>
                                      <div className="flex items-baseline gap-2">
                                          <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                                              {repo.lastBackup === 'Never' ? 'Never' : getRelativeTime(new Date(repo.lastBackup).toISOString())}
                                          </span>
                                          {repo.lastBackup !== 'Never' && (
                                              <span className="text-xs text-slate-400">
                                                  ({formatDate(repo.lastBackup).split(',')[0]})
                                              </span>
                                          )}
                                      </div>

                                                                            {jobs && (
                                                                                <div className="mt-2 flex items-center gap-2 text-xs">
                                                                                    <CalendarClock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                                                    <span className="text-slate-500 dark:text-slate-400">Next job:</span>
                                                                                    {nextRun ? (
                                                                                        <span className="font-medium text-purple-700 dark:text-purple-400 truncate" title="Next scheduled run">
                                                                                            {nextRun}
                                                                                        </span>
                                                                                    ) : !hasAnyJobs ? (
                                                                                        <span className="font-medium text-slate-600 dark:text-slate-300 truncate" title="No jobs configured">
                                                                                            No jobs yet
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="font-medium text-yellow-700 dark:text-yellow-400 truncate" title="Jobs exist, but none are scheduled">
                                                                                            No schedule enabled
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                  </div>

                                  {/* Backup ETA + Cancel */}
                                  {repo.backupStatus === 'running' && (
                                      <div className="mb-5">
                                          <div className="flex items-center justify-between mb-1">
                                              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Backup Running</div>
                                              {onAbortBackup && (
                                                  <button
                                                      onClick={() => onAbortBackup(repo)}
                                                      className="text-[10px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                  >
                                                      Cancel
                                                  </button>
                                              )}
                                          </div>

                                          {(() => {
                                              const { pct, etaLabel } = getBackupProgress(repo);
                                              return (
                                                  <>
                                                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                          {typeof pct === 'number' ? (
                                                              <div
                                                                  className="h-full bg-green-500 transition-all"
                                                                  style={{ width: `${pct}%` }}
                                                              />
                                                          ) : (
                                                              <div className="h-full bg-green-500/70 animate-pulse w-full" />
                                                          )}
                                                      </div>
                                                      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                                          <span>{etaLabel}</span>
                                                          {typeof pct === 'number' && <span>{pct}%</span>}
                                                      </div>
                                                  </>
                                              );
                                          })()}
                                      </div>
                                  )}

                                  {/* Action Footer */}
                                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex gap-2">
                                      {repo.status === 'connected' ? (
                                          <>
                                              <button 
                                                onClick={() => onViewDetails?.(repo)}
                                                                                                className="h-9 w-9 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex justify-center items-center"
                                                title="View Details & History"
                                                                                                aria-label="View Details & History"
                                              >
                                                <Activity className="w-4 h-4" />
                                              </button>
                                                                                            {onOneOffBackup && (
                                                                                                <button 
                                                                                                    onClick={() => onOneOffBackup(repo)}
                                                                                                    className="h-9 w-9 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex justify-center items-center"
                                                                                                    title="One-off Backup"
                                                                                                    aria-label="One-off Backup"
                                                                                                >
                                                                                                    <Play className="w-4 h-4" />
                                                                                                </button>
                                                                                            )}
                                              <button 
                                                onClick={() => onQuickMount(repo)}
                                                                                                className="flex-1 h-9 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors flex justify-center items-center gap-2"
                                              >
                                                  <FolderOpen className="w-4 h-4" /> Mount
                                              </button>
                                              {onManageJobs && (
                                                 <button 
                                                    onClick={() => onManageJobs(repo)}
                                                                                                        className="flex-1 h-9 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors flex justify-center items-center gap-2"
                                                 >
                                                     <CalendarClock className="w-4 h-4" /> Jobs
                                                 </button>
                                              )}
                                          </>
                                      ) : (
                                          <button 
                                              onClick={() => onConnect(repo)}
                                              disabled={repo.status === 'connecting'}
                                              className="w-full py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold hover:bg-slate-700 hover:shadow-lg transition-all flex justify-center items-center gap-2"
                                          >
                                              {repo.status === 'connecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                              Connect Source
                                          </button>
                                      )}
                                  </div>

                                  {/* Overlay for Checks */}
                                  {repo.checkStatus === 'running' && (
                                      <div className="absolute inset-x-0 bottom-0 bg-blue-500/10 backdrop-blur-[1px] h-1">
                                          <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                                      </div>
                                  )}
                              </div>
                          );
                      })
                  )}
              </div>
          </div>

          {/* RIGHT: ACTIVITY FEED (Fixed Width) */}
          <div className="w-80 shrink-0 flex flex-col bg-white/50 dark:bg-slate-800/50 rounded-xl border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-sm overflow-hidden h-full">
              <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/80">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-slate-400" /> Live Activity
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {activityLogs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 text-xs italic">
                          System waiting for tasks...
                      </div>
                  ) : (
                      activityLogs.slice(0, 20).map(log => (
                          <div key={log.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm text-left">
                              <div className="flex justify-between items-start mb-1">
                                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                      log.status === 'success' ? 'bg-green-100 text-green-700' :
                                      log.status === 'error' ? 'bg-red-100 text-red-700' :
                                      log.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-blue-100 text-blue-700'
                                  }`}>{log.status}</span>
                                  <span className="text-[10px] text-slate-400">{getRelativeTime(log.time)}</span>
                              </div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-tight mb-0.5">{log.title}</div>
                              {log.detail && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={log.detail}>{log.detail}</div>}
                          </div>
                      ))
                  )}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700">
                  <button 
                    onClick={() => onChangeView(View.ACTIVITY)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                      View Full History
                  </button>
              </div>
          </div>
      </div>

      <SystemStatusModal 
        isOpen={isSystemStatusOpen} 
        onClose={() => setIsSystemStatusOpen(false)} 
      />
    </div>
  );
};

export default DashboardView;
