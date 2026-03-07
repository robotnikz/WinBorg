import React, { useEffect, useState } from 'react';
import { Repository, ArchiveStats, RecoveryDrillConfig } from '../types';
import { borgService } from '../services/borgService';
import StorageChart from '../components/StorageChart';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { ArrowLeft, HardDrive, ShieldCheck, Clock, RefreshCw, Loader2, Database, Calendar, Save, Play, FolderOpen, AlertTriangle, CheckCircle } from 'lucide-react';
import Button from '../components/Button';
import { getRecoveryConfidence, getRecoveryConfidenceLabel, normalizeRecoveryDrillConfig } from '../utils/recovery';

interface RepoDetailsViewProps {
  repo: Repository;
  onBack: () => void;
   onSaveRecoveryDrill?: (repoId: string, config: RecoveryDrillConfig) => void;
   onRunRecoveryDrill?: (repoId: string) => void | Promise<boolean>;
}

const RepoDetailsView: React.FC<RepoDetailsViewProps> = ({ repo, onBack, onSaveRecoveryDrill, onRunRecoveryDrill }) => {
  const [history, setHistory] = useState<ArchiveStats[]>([]);
  const [allArchiveDates, setAllArchiveDates] = useState<string[]>([]);
   const [recoveryEnabled, setRecoveryEnabled] = useState(false);
   const [autoRunAfterBackup, setAutoRunAfterBackup] = useState(false);
   const [samplePathsText, setSamplePathsText] = useState('');
   const [recoverySaved, setRecoverySaved] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const config = normalizeRecoveryDrillConfig(repo.recoveryDrill);
      setRecoveryEnabled(config.enabled);
      setAutoRunAfterBackup(config.autoRunAfterBackup);
      setSamplePathsText(config.samplePaths.join('\n'));
   }, [repo.id, repo.recoveryDrill]);

  useEffect(() => {
    loadData();
  }, [repo.id]);

  const loadData = async () => {
    setLoading(true);
    setLoadingChart(true);
    setError(null);
    
    try {
        // 1. Fast Fetch: Get all archives for Heatmap
        const archives = await borgService.listArchives(repo.url, { repoId: repo.id, disableHostCheck: repo.trustHost });
        const dates = archives.map(a => a.time);
        setAllArchiveDates(dates);
        setLoading(false); // Heatmap is ready!

        // 2. Slow Fetch: Get details for chart (last 30 days only)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentArchives = archives
            .filter(a => new Date(a.time) >= thirtyDaysAgo)
            .sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const statsList: ArchiveStats[] = [];
        
        // Fetch stats one by one (this can be slow)
        for(const arch of recentArchives) {
             const stats = await borgService.getArchiveInfo(repo.url, arch.name, { repoId: repo.id, disableHostCheck: repo.trustHost });
             if(stats) {
                 statsList.push({
                     archiveName: arch.name,
                     time: arch.time,
                     originalSize: stats.originalSize,
                     compressedSize: stats.compressedSize,
                     deduplicatedSize: stats.deduplicatedSize
                 });
             }
        }
        setHistory(statsList);
        setLoadingChart(false);

    } catch (e) {
       console.error(e);
       setError("Failed to load repository data. Please ensure the repository is reachable.");
       setLoading(false);
       setLoadingChart(false);
    }
  };


  // Prepare chart data
  const chartData = history.map(h => ({
      date: h.time,
      size: h.deduplicatedSize,
      originalSize: h.originalSize
  }));

  // Get current repo stats from history (latest)
  const latest = history.length > 0 ? history[history.length - 1] : null;
   const recoveryConfidence = getRecoveryConfidence(repo);
   const recoveryLabel = getRecoveryConfidenceLabel(repo);
   const recoveryState = repo.recoveryDrillState;

   const handleSaveRecovery = () => {
      onSaveRecoveryDrill?.(repo.id, {
         enabled: recoveryEnabled,
         autoRunAfterBackup,
         samplePaths: samplePathsText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      });
      setRecoverySaved(true);
      setTimeout(() => setRecoverySaved(false), 2000);
   };

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-300">
       {/* Header */}
       <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-4">
             <Button variant="secondary" onClick={onBack} size="sm">
               <ArrowLeft className="mr-2 h-4 w-4" />
               Back
             </Button>
             <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                   <Database className="h-5 w-5 text-blue-400" />
                   {repo.name}
                </h2>
                <div className="text-xs text-slate-500 dark:text-gray-500 font-mono mt-0.5">{repo.url}</div>
             </div>
          </div>
          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
             {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
             {loading ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
       </div>

       {/* Stats Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400 mb-1">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Storage Used</span>
             </div>
             <div className="text-lg font-bold text-slate-800 dark:text-white">
                {history.length > 0 ? (
                    <span className="flex items-center gap-2">
                        {repo.size || 'Unknown'} 
                    </span>
                ) : repo.size || 'Unknown'}
             </div>
             <div className="text-[10px] text-slate-400 dark:text-gray-500">Total repository size</div>
          </div>
           <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Latest Activity</span>
             </div>
             <div className="text-xl font-bold text-slate-800 dark:text-white">
                {allArchiveDates.length > 0 
                  ? new Date(allArchiveDates[allArchiveDates.length - 1]).toLocaleDateString() 
                  : 'None'}
             </div>
             <div className="text-[10px] text-slate-400 dark:text-gray-500">
                {allArchiveDates.length > 0 
                  ? new Date(allArchiveDates[allArchiveDates.length - 1]).toLocaleTimeString() 
                  : '-'}
             </div>
          </div>
       </div>

         <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 shrink-0">
           <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 backdrop-blur-sm">
             <div className="flex items-center justify-between gap-4 mb-3">
               <div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
                     <ShieldCheck className="h-4 w-4 text-blue-500" />
                     Recovery Drill
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Restore a few important paths into a safe folder to prove this repository is recoverable.</p>
               </div>
               <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  recoveryConfidence === 'healthy'
                     ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/30'
                     : recoveryConfidence === 'warning'
                     ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/30'
                     : recoveryConfidence === 'critical'
                     ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30'
                     : 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-700'
               }`}>
                  {recoveryLabel}
               </div>
             </div>

             <div className="space-y-3">
               <label className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <span>Enable recovery drill</span>
                  <input aria-label="Enable recovery drill" type="checkbox" checked={recoveryEnabled} onChange={(e) => setRecoveryEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
               </label>

               <label className={`flex items-center justify-between gap-3 text-sm ${recoveryEnabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                  <span>Auto-run after WinBorg backup</span>
                  <input aria-label="Auto-run recovery drill after backup" type="checkbox" checked={autoRunAfterBackup} onChange={(e) => setAutoRunAfterBackup(e.target.checked)} disabled={!recoveryEnabled} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
               </label>

               <div>
                  <label htmlFor="recovery-sample-paths" className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Restore test paths</label>
                  <textarea
                     id="recovery-sample-paths"
                     aria-label="Recovery drill sample paths"
                     value={samplePathsText}
                     onChange={(e) => setSamplePathsText(e.target.value)}
                     className="w-full min-h-[110px] px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white font-mono"
                     placeholder={["Documents/important.docx", "Photos/family.jpg"].join('\n')}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">One repository-relative path per line. Keep the list small so the drill stays fast and repeatable.</p>
               </div>

               <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveRecovery} variant="secondary" size="sm">
                     {recoverySaved ? <CheckCircle className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                     {recoverySaved ? 'Saved' : 'Save Drill Settings'}
                  </Button>
                  <Button onClick={() => onRunRecoveryDrill?.(repo.id)} size="sm" disabled={!recoveryEnabled || samplePathsText.trim().length === 0} loading={recoveryState?.status === 'running'}>
                     <Play className="mr-2 h-4 w-4" />
                     Run Recovery Drill
                  </Button>
                  {recoveryState?.lastRestorePath && (
                     <Button variant="ghost" size="sm" onClick={() => borgService.openPath(recoveryState.lastRestorePath!)}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Open Last Drill Folder
                     </Button>
                  )}
               </div>
             </div>
           </div>

           <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold mb-3">
               {recoveryConfidence === 'critical' ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <ShieldCheck className="h-4 w-4 text-blue-500" />}
               Recovery Confidence
             </div>
             <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
               <div><span className="font-medium">Status:</span> {recoveryLabel}</div>
               <div><span className="font-medium">Last run:</span> {recoveryState?.lastRunAt && recoveryState.lastRunAt !== 'Never' ? new Date(recoveryState.lastRunAt).toLocaleString() : 'Never'}</div>
               <div><span className="font-medium">Last archive:</span> {recoveryState?.lastArchiveName || 'Not tested yet'}</div>
               <div><span className="font-medium">Verified paths:</span> {typeof recoveryState?.lastVerifiedCount === 'number' ? recoveryState.lastVerifiedCount : 0}</div>
               <div><span className="font-medium">Last duration:</span> {typeof recoveryState?.lastDurationMs === 'number' ? `${Math.round(recoveryState.lastDurationMs / 1000)}s` : '-'}</div>
               {recoveryState?.lastError && (
                  <div className="text-red-600 dark:text-red-400"><span className="font-medium">Last error:</span> {recoveryState.lastError}</div>
               )}
             </div>
           </div>
         </div>

       {/* Heatmap Section (Full Width) */}
       <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 backdrop-blur-sm shrink-0 overflow-hidden">
             <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Activity Heatmap (1Y)</span>
             </div>
             <div className="mt-1 text-slate-800 dark:text-white w-full pb-1">
                 {loading ? <div className="h-28 w-full bg-gray-100 dark:bg-white/5 rounded animate-pulse" /> : <ActivityHeatmap archiveDates={allArchiveDates} />}
             </div>
       </div>

       {/* Chart Section */}
       <div className="flex-1 w-full min-h-0 flex flex-col">
          {loadingChart ? (
             <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 dark:text-gray-500 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p>Analyzing repository history (Last 30 Days)...</p>
                <p className="text-xs text-slate-400 dark:text-gray-600">Fetching detailed stats for accurate dedup sizing.</p>
             </div>
          ) : error ? (
             <div className="h-full w-full flex items-center justify-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/20">
                {error}
             </div>
          ) : (
             <div className="h-full w-full">
                <StorageChart data={chartData} height={300} /> {/* Fixed height prop, but container controls overflow */}
             </div>
          )}
       </div>
    </div>
  );
};

export default RepoDetailsView;
