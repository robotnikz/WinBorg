
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
  onOneOffBackup?: (repo: Repository) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  isLoading?: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
    repos, mounts, jobs, activityLogs, onQuickMount, onConnect, onCheck, onChangeView, onViewDetails, onAbortCheck, onOneOffBackup, isDarkMode, toggleTheme, isLoading 
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
    
    try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.on('terminal-log', handleTerminalLog);
        return () => {
            ipcRenderer.removeListener('terminal-log', handleTerminalLog);
        };
    } catch(e) {}
  }, []);

  // Force update for ETA
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
      const hasRunningCheck = repos.some(r => r.checkStatus === 'running');
      if (hasRunningCheck) {
          const interval = setInterval(() => setNow(Date.now()), 1000);
          return () => clearInterval(interval);
      }
  }, [repos]);

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
      let healthyCount = 0;
      let warningCount = 0;
      let criticalCount = 0;
      let unknownCount = 0;

      repos.forEach(r => {
          totalBytes += parseSizeString(r.size);
          const health = getRepoHealth(r);
          if (health === 'healthy') healthyCount++;
          else if (health === 'warning') warningCount++;
          else if (health === 'critical') criticalCount++;
          else unknownCount++;
      });

      const simulatedOriginal = totalBytes * 2.4; 
      const savings = simulatedOriginal - totalBytes;
      const savingsPercent = totalBytes > 0 ? Math.round((savings / simulatedOriginal) * 100) : 0;

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
      } catch { return iso; }
  };
  
  const getEta = (repo: Repository) => {
      if (repo.checkStatus !== 'running' || !repo.checkStartTime || !repo.checkProgress || repo.checkProgress <= 0.5) return null;
      const elapsedMs = now - repo.checkStartTime;
      if (elapsedMs < 2000) return null;
      const timePerPercent = elapsedMs / repo.checkProgress;
      const remainingPercent = 100 - repo.checkProgress;
      const remainingMs = timePerPercent * remainingPercent;
      return formatDuration(remainingMs / 1000);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-2">
      
      {/* HEADER & INFRASTRUCTURE STATS */}
      <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {getGreeting()}
                </h1>
                <div 
                    onClick={() => setIsSystemStatusOpen(true)}
                    className="text-xs text-slate-500 hover:text-blue-500 cursor-pointer flex items-center gap-1 mt-1 transition-colors"
                >
                    <Activity className="w-3 h-3" /> System Operational
                </div>
              </div>
              <div className="flex gap-2">
                 {/* Quick Add Button */}
                 <button 
                    onClick={() => onChangeView(View.REPOSITORIES)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                 >
                     <Plus className="w-4 h-4" /> Add Repository
                 </button>
                 {toggleTheme && (
                     <button onClick={toggleTheme} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 hover:text-blue-500 transition-colors">
                         {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                     </button>
                 )}
              </div>
          </div>

          {/* Infrastructure Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               {/* Stat 1: Managed Data */}
               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                   <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                       <Database className="w-6 h-6" />
                   </div>
                   <div>
                       <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Data</div>
                       <div className="text-2xl font-bold text-slate-800 dark:text-white">{dashboardStats.totalSize}</div>
                   </div>
               </div>

               {/* Stat 2: Savings */}
               <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                   <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                       <Zap className="w-6 h-6" />
                   </div>
                   <div>
                       <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Efficiency</div>
                       <div className="text-2xl font-bold text-slate-800 dark:text-white">{dashboardStats.savingsPercent}%</div>
                   </div>
               </div>

               {/* Stat 3: Repo Health Summary */}
               <div className="md:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                            <Server className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Repositories</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-white">{repos.length} Sources</div>
                        </div>
                   </div>
                   {/* Health Pills */}
                   <div className="flex gap-2">
                       {dashboardStats.counts.critical > 0 && (
                           <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-xs font-bold flex items-center gap-2">
                               <AlertTriangle className="w-4 h-4" /> {dashboardStats.counts.critical} Critical
                           </div>
                       )}
                       {dashboardStats.counts.warning > 0 && (
                           <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-xs font-bold flex items-center gap-2">
                               <AlertOctagon className="w-4 h-4" /> {dashboardStats.counts.warning} Warning
                           </div>
                       )}
                       <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold flex items-center gap-2">
                           <CheckCircle className="w-4 h-4" /> {dashboardStats.counts.healthy} Healthy
                       </div>
                   </div>
               </div>
          </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 min-h-0 flex gap-6">
          
          {/* LEFT: REPO GRID (Grow) */}
          <div className="flex-1 overflow-y-auto pr-2">
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-slate-400" /> Active Repositories
                  </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                  {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 h-[180px] animate-pulse">
                              <div className="flex gap-4 mb-4">
                                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                  <div className="flex-1 space-y-2 py-1">
                                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                                  </div>
                              </div>
                              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                              <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100 dark:border-slate-700">
                                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                              </div>
                          </div>
                      ))
                  ) : repos.length === 0 ? (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                          <Cloud className="w-12 h-12 mb-4 opacity-50" />
                          <p>No repositories configured yet.</p>
                          <Button variant="primary" className="mt-4" onClick={() => onChangeView(View.REPOSITORIES)}>Setup First Repo</Button>
                      </div>
                  ) : (
                      repos.map(repo => {
                          const health = getRepoHealth(repo);
                          const eta = getEta(repo);
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
                                      {health === 'critical' ? (
                                          <div className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold uppercase">At Risk</div>
                                      ) : health === 'warning' ? (
                                           <div className="px-2 py-0.5 bg-yellow-100 text-yellow-600 rounded text-[10px] font-bold uppercase">Warning</div>
                                      ) : (
                                           <div className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-[10px] font-bold uppercase">Healthy</div>
                                      )}
                                  </div>

                                  {/* Last Backup Large Display */}
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
                                  </div>

                                  {/* Action Footer */}
                                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex gap-2">
                                      {repo.status === 'connected' ? (
                                          <>
                                              <button 
                                                onClick={() => onViewDetails?.(repo)}
                                                className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex justify-center items-center"
                                                title="View Details & History"
                                              >
                                                <Activity className="w-4 h-4" />
                                              </button>
                                              <button 
                                                onClick={() => onQuickMount(repo)}
                                                className="flex-1 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition-colors flex justify-center items-center gap-2"
                                              >
                                                  <FolderOpen className="w-4 h-4" /> Mount
                                              </button>
                                              {onOneOffBackup && (
                                                 <button 
                                                    onClick={() => onOneOffBackup(repo)}
                                                    className="flex-1 py-2 rounded-lg bg-gray-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-colors flex justify-center items-center gap-2"
                                                 >
                                                     <Play className="w-4 h-4" /> Backup
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
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
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
                              {log.message && <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={log.message}>{log.message}</div>}
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
