
import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Archive, Repository } from '../types';
import Button from '../components/Button';
import { Database, Clock, HardDrive, Search, Calendar, RefreshCw, DownloadCloud, Loader2, ListChecks, FolderSearch, GitCompare, Trash2, FileBox } from 'lucide-react';
import ArchiveBrowserModal from '../components/ArchiveBrowserModal';
import TerminalModal from '../components/TerminalModal';
import DiffViewerModal from '../components/DiffViewerModal';
import ExtractionSuccessModal from '../components/ExtractionSuccessModal';
import { borgService } from '../services/borgService';

interface ArchivesViewProps {
  archives: Archive[];
    archivesRepoId?: string | null;
  repos: Repository[];
  onMount: (repo: Repository, archiveName: string) => void;
  onRefresh: () => void;
  onGetInfo?: (archiveName: string) => Promise<void>;
}

const ArchivesView: React.FC<ArchivesViewProps> = ({ archives, archivesRepoId, repos, onMount, onRefresh, onGetInfo }) => {
    const deleteTitleId = useId();
    const deleteDescriptionId = useId();
  const [search, setSearch] = useState('');
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  
  // Selection for Diff / Delete
  const [selectedArchives, setSelectedArchives] = useState<string[]>([]);
  const [diffLogs, setDiffLogs] = useState<string[]>([]);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
    const [diffArchiveOld, setDiffArchiveOld] = useState('');
    const [diffArchiveNew, setDiffArchiveNew] = useState('');
  
  // Delete State
  const [itemsToDelete, setItemsToDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
    const deleteDialogRef = useRef<HTMLDivElement>(null);
  
  // Browser Modal State
  const [browserArchive, setBrowserArchive] = useState<Archive | null>(null);
  
  // Log Modal State (for extraction errors)
  const [logData, setLogData] = useState<{title: string, logs: string[]} | null>(null);

  // Success Modal State
  const [successPath, setSuccessPath] = useState<string | null>(null);

    // Helper to find the active connected repo
        const activeRepo = useMemo(() => repos.find((r) => r.status === 'connected'), [repos]);

        const canShowArchives = !!activeRepo && String(archivesRepoId || '') === String(activeRepo.id || '');
        const displayArchives = canShowArchives ? archives : [];

    // Basic filtering
        const filteredArchives = useMemo(() => {
                const needle = search.trim().toLowerCase();
                if (!needle) return displayArchives;
                return displayArchives.filter((a) => a.name.toLowerCase().includes(needle));
        }, [displayArchives, search]);

    const selectedArchiveSet = useMemo(() => new Set(selectedArchives), [selectedArchives]);

    // Stats
    const totalArchives = displayArchives.length;
  
  const handleGetInfo = async (archiveName: string) => {
      setLoadingInfo(archiveName);
      if (onGetInfo && canShowArchives) {
          await onGetInfo(archiveName);
          setLoadingInfo(null);
      }
  };

  const handleFetchAllStats = async () => {
      if (!onGetInfo || !activeRepo || !canShowArchives) return;
      
      setIsFetchingAll(true);
      const targets = filteredArchives.filter(a => a.size === 'Unknown');
      
      for (const archive of targets) {
          if (!activeRepo) break; 
          setLoadingInfo(archive.name);
          try {
              await onGetInfo(archive.name);
          } catch (e) {
              console.error(`Failed to fetch info for ${archive.name}`, e);
          }
          await new Promise(r => setTimeout(r, 200));
      }
      
      setLoadingInfo(null);
      setIsFetchingAll(false);
  };

  const toggleSelection = (archiveName: string) => {
      setSelectedArchives((prev) =>
        prev.includes(archiveName) ? prev.filter((n) => n !== archiveName) : [...prev, archiveName]
      );
  };

  const handleCompare = async () => {
      if (!canShowArchives || selectedArchives.length !== 2 || !activeRepo) return;
      setIsDiffing(true);
      setIsDiffOpen(true);
      setDiffLogs([]);

      let oldArchive = selectedArchives[0];
      let newArchive = selectedArchives[1];

      // Simple heuristic: if we find them in the list, the one with higher index is older (assuming sorted descending).
       const idx1 = displayArchives.findIndex(a => a.name === oldArchive);
       const idx2 = displayArchives.findIndex(a => a.name === newArchive);
       if (idx1 < idx2) {
           [oldArchive, newArchive] = [newArchive, oldArchive];
       }

       setDiffArchiveOld(oldArchive);
       setDiffArchiveNew(newArchive);

       try {
           const ok = await borgService.diffArchives(
               activeRepo.url,
               oldArchive,
               newArchive,
               (log) => setDiffLogs(prev => [...prev, log]),
               {
                   repoId: activeRepo.id,
                   remotePath: activeRepo.remotePath
               }
           );

           if (!ok) {
               setDiffLogs(prev => [...prev, '[Error] borg diff failed (see logs above for details).']);
           }
       } catch (e: any) {
           const msg = e?.message || String(e);
           setDiffLogs(prev => [...prev, `[Error] borg diff crashed: ${msg}`]);
       } finally {
           setIsDiffing(false);
       }
  };

  const handleDeleteClick = (names: string[]) => {
      setItemsToDelete(names);
  };

  const confirmDelete = async () => {
      if (!itemsToDelete || !activeRepo || !canShowArchives) return;
      setIsDeleting(true);
      
      for (const archiveName of itemsToDelete) {
          await borgService.deleteArchive(activeRepo.url, archiveName, () => {});
      }
      
      onRefresh();
      setIsDeleting(false);
      setItemsToDelete(null);
      setSelectedArchives([]);
  };

    useEffect(() => {
        if (canShowArchives) return;
        setSelectedArchives([]);
        setBrowserArchive(null);
        setItemsToDelete(null);
        setIsDiffOpen(false);
    }, [canShowArchives]);

    useEffect(() => {
        if (!itemsToDelete) return;
        setTimeout(() => deleteDialogRef.current?.focus(), 0);
        if (isDeleting) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setItemsToDelete(null);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [itemsToDelete, isDeleting]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Browser Modal */}
      {browserArchive && activeRepo && canShowArchives && (
          <ArchiveBrowserModal 
             archive={browserArchive}
             repo={activeRepo}
             isOpen={!!browserArchive}
             onClose={() => setBrowserArchive(null)}
             onLog={(title, logs) => setLogData({ title, logs })}
             onExtractSuccess={(path) => {
                 setBrowserArchive(null);
                 setSuccessPath(path);
             }}
          />
      )}
      
      {/* Diff Viewer Modal */}
      <DiffViewerModal 
          isOpen={isDiffOpen}
          onClose={() => setIsDiffOpen(false)}
          archiveOld={diffArchiveOld || selectedArchives[0] || ''}
          archiveNew={diffArchiveNew || selectedArchives[1] || ''}
          logs={diffLogs}
          isProcessing={isDiffing}
      />
      
      {/* Delete Confirmation */}
      {itemsToDelete && (
          <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (!isDeleting) setItemsToDelete(null);
              }}
          >
              <div
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={deleteTitleId}
                  aria-describedby={deleteDescriptionId}
                  tabIndex={-1}
                  ref={deleteDialogRef}
              >
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mb-4 mx-auto">
                      <Trash2 className="w-6 h-6" />
                  </div>
                  <h3 id={deleteTitleId} className="text-lg font-bold text-center text-slate-800 dark:text-white mb-2">Delete Archives?</h3>
                  <p id={deleteDescriptionId} className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
                      Are you sure you want to permanently delete {itemsToDelete.length} {itemsToDelete.length === 1 ? 'archive' : 'archives'}?<br/>
                      This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => setItemsToDelete(null)} className="flex-1">Cancel</Button>
                      <Button variant="danger" onClick={confirmDelete} loading={isDeleting} className="flex-1">Delete Forever</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Logs Modal */}
      {logData && (
          <TerminalModal
              isOpen={!!logData}
              onClose={() => setLogData(null)}
              title={logData.title}
              logs={logData.logs}
              isProcessing={false}
          />
      )}

      {/* Success Modal */}
      {successPath && (
          <ExtractionSuccessModal 
              isOpen={!!successPath}
              onClose={() => setSuccessPath(null)}
              path={successPath}
          />
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Archives</h1>
            <p
                className={`text-sm mt-1 ${
                    canShowArchives
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-red-600 dark:text-red-400 font-bold'
                }`}
                role={!canShowArchives ? 'alert' : undefined}
            >
                {canShowArchives ? `Snapshots for ${activeRepo?.name || ''}` : 'Connect to a repository to view archives'}
            </p>
        </div>
        
        {/* ACTION BAR */}
        <div className="flex items-center gap-2">
            <div className="relative group hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search archives..." 
                    className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm text-slate-700 dark:text-slate-200"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            {/* Diff Button */}
            {canShowArchives && selectedArchives.length === 2 && (
                <Button 
                    onClick={handleCompare}
                    className="bg-purple-600 hover:bg-purple-700 text-white animate-in zoom-in"
                >
                    <GitCompare className="w-4 h-4 mr-2" />
                    Diff
                </Button>
            )}
            
            {/* Bulk Delete Button */}
            {canShowArchives && selectedArchives.length > 0 && (
                <Button 
                    variant="danger"
                    onClick={() => handleDeleteClick(selectedArchives)}
                    className="animate-in zoom-in"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedArchives.length})
                </Button>
            )}
            
            {activeRepo && (
                <div className="flex gap-2 border-l border-gray-200 dark:border-slate-700 pl-2 ml-2">
                    <Button 
                        variant="secondary" 
                        onClick={handleFetchAllStats} 
                        title="Fetch size & duration for all archives" 
                        aria-label="Fetch size & duration for all archives"
                        disabled={!canShowArchives || isFetchingAll || filteredArchives.every(a => a.size !== 'Unknown')}
                        className={isFetchingAll ? "bg-blue-50 text-blue-600 border-blue-200" : "dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 border-gray-200"}
                    >
                        {isFetchingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                    </Button>

                    <Button variant="secondary" onClick={onRefresh} title="Refresh Archives List" aria-label="Refresh Archives List" disabled={!canShowArchives || isFetchingAll} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 border-gray-200">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
      </div>
      
      {/* SUMMARY STATS (New!) */}
      {canShowArchives && displayArchives.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      <FileBox className="w-5 h-5" />
                  </div>
                  <div>
                      <div className="text-2xl font-bold text-slate-800 dark:text-white">{totalArchives}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Snapshots</div>
                  </div>
              </div>
              
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                      <Clock className="w-5 h-5" />
                  </div>
                  <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[120px]" title={displayArchives[0].time}>{displayArchives[0].time}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Latest</div>
                  </div>
              </div>
          </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-gray-100 dark:border-slate-700">
                    <tr>
                        <th className="px-3 py-3 w-10"></th>
                        <th className="px-6 py-3">Archive Name</th>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Size</th>
                        <th className="px-6 py-3">Duration</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredArchives.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                                <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                <p className="mb-4 text-sm">{canShowArchives ? "No archives found matching your criteria." : "Connect to a repository to view history."}</p>
                                {canShowArchives && (
                                    <Button variant="secondary" onClick={onRefresh} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Reload List
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ) : (
                        filteredArchives.map((archive) => {
                            const isSelected = selectedArchiveSet.has(archive.name);
                            return (
                            <tr key={archive.id} className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group ${isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}>
                                <td className="px-3 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer w-4 h-4"
                                        checked={isSelected}
                                        onChange={() => toggleSelection(archive.name)}
                                        aria-label={`Select archive ${archive.name}`}
                                    />
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                                            <Database className="w-4 h-4" />
                                        </div>
                                        <span className="truncate max-w-[200px]" title={archive.name}>{archive.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {archive.time}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">
                                    {archive.size === 'Unknown' ? (
                                        <button 
                                            onClick={() => handleGetInfo(archive.name)}
                                            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                            title="Click to calculate size"
                                            disabled={!canShowArchives || loadingInfo === archive.name || isFetchingAll}
                                        >
                                            {loadingInfo === archive.name ? <Loader2 className="w-3 h-3 animate-spin"/> : <DownloadCloud className="w-3 h-3" />}
                                            Calc
                                        </button>
                                    ) : (
                                        archive.size
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    {archive.duration === 'Unknown' ? '-' : archive.duration}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-100 transition-opacity">
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-10 w-10 p-0 bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-600/70 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600"
                                            onClick={() => setBrowserArchive(archive)}
                                            disabled={!canShowArchives || isFetchingAll}
                                            title="Browse Files"
                                            aria-label="Browse Files"
                                        >
                                            <FolderSearch className="w-5 h-5" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-10 w-10 p-0 bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-600/70 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600"
                                            onClick={() => activeRepo && onMount(activeRepo, archive.name)}
                                            disabled={!canShowArchives || isFetchingAll}
                                            title="Mount Archive"
                                            aria-label="Mount Archive"
                                        >
                                            <HardDrive className="w-5 h-5" />
                                        </Button>
                                        
                                        <button 
                                            onClick={() => handleDeleteClick([archive.name])}
                                            className="h-10 w-10 p-0 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-100 dark:bg-red-900/25 dark:text-red-300 dark:hover:bg-red-900/45 dark:border-red-900/60"
                                            title="Delete Archive"
                                            aria-label="Delete Archive"
                                            disabled={!canShowArchives || isFetchingAll}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default ArchivesView;
