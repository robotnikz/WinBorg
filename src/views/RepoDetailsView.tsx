import React, { useEffect, useState } from 'react';
import { Repository, ArchiveStats } from '../types';
import { borgService } from '../services/borgService';
import StorageChart from '../components/StorageChart';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { ArrowLeft, HardDrive, ShieldCheck, Clock, RefreshCw, Loader2, Database, Calendar } from 'lucide-react';
import Button from '../components/Button';

interface RepoDetailsViewProps {
  repo: Repository;
  onBack: () => void;
}

const RepoDetailsView: React.FC<RepoDetailsViewProps> = ({ repo, onBack }) => {
  const [history, setHistory] = useState<ArchiveStats[]>([]);
  const [allArchiveDates, setAllArchiveDates] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden animate-in fade-in duration-300">
       {/* Header */}
       <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
             <Button variant="secondary" onClick={onBack} size="sm">
               <ArrowLeft className="mr-2 h-4 w-4" />
               Back
             </Button>
             <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                   <Database className="h-5 w-5 text-blue-400" />
                   {repo.name}
                </h2>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{repo.url}</div>
             </div>
          </div>
          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
             {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
             {loading ? 'Refreshing...' : 'Refresh Stats'}
          </Button>
       </div>

       {/* Stats Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-gray-400 mb-1">
                <HardDrive className="h-4 w-4" />
                <span className="text-sm">Storage Used</span>
             </div>
             <div className="text-lg font-bold text-white">
                {history.length > 0 ? (
                    <span className="flex items-center gap-2">
                        {repo.size || 'Unknown'} 
                    </span>
                ) : repo.size || 'Unknown'}
             </div>
             <div className="text-[10px] text-gray-500">Total repository size</div>
          </div>
           <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
             <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Latest Activity</span>
             </div>
             <div className="text-xl font-bold text-white">
                {allArchiveDates.length > 0 
                  ? new Date(allArchiveDates[allArchiveDates.length - 1]).toLocaleDateString() 
                  : 'None'}
             </div>
             <div className="text-[10px] text-gray-500">
                {allArchiveDates.length > 0 
                  ? new Date(allArchiveDates[allArchiveDates.length - 1]).toLocaleTimeString() 
                  : '-'}
             </div>
          </div>
       </div>

       {/* Heatmap Section (Full Width) */}
       <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm shrink-0 overflow-hidden">
             <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Activity Heatmap (1Y)</span>
             </div>
             <div className="mt-1 text-white w-full pb-1">
                 {loading ? <div className="h-28 w-full bg-white/5 rounded animate-pulse" /> : <ActivityHeatmap archiveDates={allArchiveDates} />}
             </div>
       </div>

       {/* Chart Section */}
       <div className="flex-1 w-full min-h-0 flex flex-col">
          {loadingChart ? (
             <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p>Analyzing repository history (Last 30 Days)...</p>
                <p className="text-xs text-gray-600">Fetching detailed stats for accurate dedup sizing.</p>
             </div>
          ) : error ? (
             <div className="h-full w-full flex items-center justify-center text-red-400 bg-red-900/10 rounded-xl border border-red-900/20">
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
