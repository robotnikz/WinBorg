
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
  CalendarClock
} from 'lucide-react';
import Button from '../components/Button';
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
  onAbortCheck?: (repo: Repository) => void;
  onOneOffBackup?: (repo: Repository) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ 
    repos, mounts, jobs, activityLogs, onQuickMount, onConnect, onCheck, onChangeView, onAbortCheck, onOneOffBackup, isDarkMode, toggleTheme 
}) => {
  
  // Real-time Current File Logic
  const [currentFile, setCurrentFile] = useState<string>('');
  
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

  // Calculate Statistics
  const stats = useMemo(() => {
    const totalRepos = repos.length;
    const activeMounts = mounts.length;
    const connectedRepos = repos.filter(r => r.status === 'connected').length;
    const runningChecks = repos.filter(r => r.checkStatus === 'running').length;
    const errorChecks = repos.filter(r => r.checkStatus === 'error').length;
    const totalBytes = repos.reduce((acc, repo) => acc + parseSizeString(repo.size), 0);
    const simulatedOriginalBytes = totalBytes * 2.4; 
    const savingsBytes = simulatedOriginalBytes - totalBytes;
    const savingsPercent = totalBytes > 0 ? Math.round((savingsBytes / simulatedOriginalBytes) * 100) : 0;

    return {
        totalRepos,
        activeMounts,
        connectedRepos,
        runningChecks,
        errorChecks,
        totalBytes,
        formattedTotal: formatBytes(totalBytes),
        formattedOriginal: formatBytes(simulatedOriginalBytes),
        formattedSavings: formatBytes(savingsBytes),
        savingsPercent
    };
  }, [repos, mounts]);

  // Actions
  const handleSmartVerify = () => {
    if (repos.length === 1 && repos[0].status === 'connected') {
        onCheck(repos[0]);
    } else {
        onChangeView(View.REPOSITORIES);
    }
  };

  const handleQuickBackup = () => {
      // Find the first available connected repo, OR fallback to the first repo in list
      const targetRepo = repos.find(r => r.status === 'connected') || repos[0];
      
      if (targetRepo && onOneOffBackup) {
          onOneOffBackup(targetRepo);
      } else {
          // Only redirect if absolutely no repos exist
          onChangeView(View.REPOSITORIES);
      }
  };

  const getRelativeTime = (iso: string) => {
      try {
          const diff = Date.now() - new Date(iso).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) return 'Just now';
          if (mins < 60) return `${mins}m ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours}h ago`;
          return formatDate(iso);
      } catch { return iso; }
  };
  
  const getEta = (repo: Repository) => {
      if (repo.checkStatus !== 'running' || !repo.checkStartTime || !repo.checkProgress || repo.checkProgress <= 0.5) return null;
      const elapsedMs = now - repo.checkStartTime;
      if (elapsedMs < 2000) return "Calculating...";
      const timePerPercent = elapsedMs / repo.checkProgress;
      const remainingPercent = 100 - repo.checkProgress;
      const remainingMs = timePerPercent * remainingPercent;
      return formatDuration(remainingMs / 1000) + ' remaining';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header / Hero Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              {getGreeting()}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              System Status: 
              {stats.errorChecks > 0 ? (
                  <span className="text-red-500 font-medium">Attention Needed</span>
              ) : stats.runningChecks > 0 ? (
                  <span className="text-blue-500 font-medium">Processing...</span>
              ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium">Operational</span>
              )}
          </p>
        </div>
        <div className="flex items-center gap-4">
             {toggleTheme && (
                 <button 
                    onClick={toggleTheme}
                    className="p-2 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shadow-sm"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                 >
                     {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                 </button>
             )}
        </div>
      </div>

      {/* TOP ROW: ACTIONS & STATS COMBINED */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Quick Actions (Takes 2 columns on large screens) */}
          <div className="xl:col-span-2">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Action 1: New Backup */}
                  <button 
                      onClick={handleQuickBackup}
                      className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] transition-all flex flex-col items-start gap-3 h-full"
                  >
                      <div className="p-2 bg-white/20 rounded-lg">
                          <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                          <div className="font-bold text-sm">New Backup</div>
                          <div className="text-[10px] text-blue-100 opacity-80">Create snapshot</div>
                      </div>
                  </button>

                  {/* Action 2: Add Repo */}
                  <button 
                      onClick={() => onChangeView(View.REPOSITORIES)}
                      className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-500 transition-colors flex flex-col items-start gap-3 group h-full"
                  >
                      <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <Plus className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-200">Add Repo</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Connect new source</div>
                      </div>
                  </button>

                  {/* Action 3: Mount Latest */}
                  <button 
                      onClick={() => {
                          const connected = repos.find(r => r.status === 'connected');
                          if(connected) onQuickMount(connected);
                          else onChangeView(View.REPOSITORIES);
                      }}
                      className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors flex flex-col items-start gap-3 group h-full"
                  >
                      <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-200">Mount</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Browse latest files</div>
                      </div>
                  </button>

                  {/* Action 4: Verify */}
                  <button 
                      onClick={handleSmartVerify}
                      className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors flex flex-col items-start gap-3 group h-full"
                  >
                      <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-200">Verify</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Check integrity</div>
                      </div>
                  </button>
              </div>
          </div>

          {/* Mini Stats (Takes 1 column) */}
          <div>
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">System Overview</h3>
              <div className="grid grid-cols-2 gap-4 h-[calc(100%-2rem)]">
                  <StatCard 
                      title="Repositories" 
                      value={stats.totalRepos.toString()} 
                      icon={Server} 
                      color="blue"
                  />
                  <StatCard 
                      title="Active Mounts" 
                      value={stats.activeMounts.toString()} 
                      icon={HardDrive} 
                      color="indigo"
                  />
              </div>
          </div>
      </div>

      {/* BOTTOM ROW: MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: REPO LIST (Takes 2/3) - Now h-fit to shrink wrap content */}
        <div className="lg:col-span-2 h-fit">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-500" /> Repository Status
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => onChangeView('REPOSITORIES')} className="text-xs">View All</Button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {repos.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            No repositories configured.
                        </div>
                    ) : (
                        repos.map(repo => {
                            const eta = getEta(repo);
                            const nextRun = jobs ? getNextRunForRepo(jobs, repo.id) : null;
                            
                            return (
                                <div key={repo.id} className="px-6 py-4 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${repo.status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{repo.name}</div>
                                                    {nextRun && (
                                                        <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1 border border-purple-100 dark:border-purple-800">
                                                            <CalendarClock className="w-3 h-3" /> {nextRun}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                                    <span className="truncate max-w-[200px]">{repo.url}</span>
                                                    
                                                    {/* Status Badges */}
                                                    {repo.isLocked && (
                                                        <span className="flex items-center gap-1 text-[10px] text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                                                            <Lock className="w-3 h-3" /> Locked
                                                        </span>
                                                    )}
                                                    {repo.checkStatus === 'running' && (
                                                        <span className="flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Check Running {eta ? `(${eta})` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Inline Actions - ALWAYS VISIBLE */}
                                        <div className="flex items-center gap-2">
                                            {repo.status === 'connected' ? (
                                                <>
                                                    <button 
                                                        onClick={() => onQuickMount(repo)}
                                                        className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                                                        title="Mount"
                                                    >
                                                        <HardDrive className="w-4 h-4" />
                                                    </button>
                                                    {onOneOffBackup && (
                                                        <button 
                                                            onClick={() => onOneOffBackup(repo)}
                                                            className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 rounded-lg transition-colors"
                                                            title="New Backup"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => onConnect(repo)}
                                                    disabled={repo.status === 'connecting'}
                                                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                                                >
                                                    {repo.status === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Progress Bar for Checks */}
                                    {repo.checkStatus === 'running' && (
                                        <div className="h-1 w-full bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden mt-1">
                                            <div 
                                                className="h-full bg-blue-500 rounded-full transition-all duration-300" 
                                                style={{ width: `${repo.checkProgress || 0}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: STATS & LOGS (Takes 1/3) */}
        <div className="space-y-8">
            
            {/* Storage Efficiency */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Storage Efficiency</h3>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                        {stats.savingsPercent}% Saved
                    </span>
                </div>
                
                <div className="space-y-4">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Physical Size</span>
                        <span className="font-mono text-slate-700 dark:text-slate-200">{stats.formattedTotal}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        <div className="h-full bg-blue-500 dark:bg-blue-600" style={{ width: `${100 - stats.savingsPercent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 pt-1">
                        <span>Deduplicated from {stats.formattedOriginal}</span>
                    </div>
                </div>
            </div>

            {/* Activity Log Preview */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm flex flex-col h-full max-h-[400px]">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm mb-4">Recent Activity</h3>
                <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                    {activityLogs.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-xs">
                            No recent activity
                        </div>
                    ) : (
                        activityLogs.slice(0, 5).map(log => (
                            <div key={log.id} className="flex gap-3 items-start group">
                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    log.status === 'success' ? 'bg-green-500' : 
                                    log.status === 'warning' ? 'bg-yellow-500' : 
                                    log.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                }`}></div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{log.title}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{getRelativeTime(log.time)}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <button 
                    onClick={() => onChangeView(View.ACTIVITY)}
                    className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline w-full text-left"
                >
                    View Full History
                </button>
            </div>

        </div>

      </div>
    </div>
  );
};

// --- Subcomponents ---

const StatCard = ({ title, value, icon: Icon, color }: any) => {
    const colors = {
        blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
        indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-full min-h-[90px]">
            <div className="flex justify-between items-start">
                <div className={`p-1.5 rounded-lg ${colors[color as keyof typeof colors]}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-slate-800 dark:text-white">{value}</span>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-2">{title}</p>
        </div>
    );
}

export default DashboardView;
