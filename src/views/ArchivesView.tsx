
import React, { useState } from 'react';
import { Archive, Repository } from '../types';
import Button from '../components/Button';
import { Database, Clock, HardDrive, Search, Filter, Calendar, RefreshCw, Info, DownloadCloud, Loader2, ListChecks, FolderSearch, GitCompare, Trash2, AlertTriangle } from 'lucide-react';
import ArchiveBrowserModal from '../components/ArchiveBrowserModal';
import TerminalModal from '../components/TerminalModal';
import DiffViewerModal from '../components/DiffViewerModal';
import ExtractionSuccessModal from '../components/ExtractionSuccessModal';
import { borgService } from '../services/borgService';
import { toast } from '../utils/eventBus';

interface ArchivesViewProps {
  archives: Archive[];
  repos: Repository[];
  onMount: (repo: Repository, archiveName: string) => void;
  onRefresh: () => void;
  onGetInfo?: (archiveName: string) => Promise<void>;
}

const ArchivesView: React.FC<ArchivesViewProps> = ({ archives, repos, onMount, onRefresh, onGetInfo }) => {
  const [search, setSearch] = useState('');
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  
  // Selection for Diff / Delete
  const [selectedArchives, setSelectedArchives] = useState<string[]>([]);
  const [diffLogs, setDiffLogs] = useState<string[]>([]);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isDiffing, setIsDiffing] = useState(false);
  
  // Delete State
  const [itemsToDelete, setItemsToDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Browser Modal State
  const [browserArchive, setBrowserArchive] = useState<Archive | null>(null);
  
  // Log Modal State (for extraction errors)
  const [logData, setLogData] = useState<{title: string, logs: string[]} | null>(null);

  // Success Modal State
  const [successPath, setSuccessPath] = useState<string | null>(null);

  // Basic filtering
  const filteredArchives = archives.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  // Helper to find the active connected repo
  const activeRepo = repos.find(r => r.status === 'connected');

  const handleGetInfo = async (archiveName: string) => {
      setLoadingInfo(archiveName);
      if (onGetInfo) {
          await onGetInfo(archiveName);
          setLoadingInfo(null);
      }
  };

  const handleFetchAllStats = async () => {
      if (!onGetInfo || !activeRepo) return;
      
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
      if (selectedArchives.includes(archiveName)) {
          setSelectedArchives(prev => prev.filter(n => n !== archiveName));
      } else {
          // If shift key held? For now simple toggle
          setSelectedArchives(prev => [...prev, archiveName]);
      }
  };

  const handleCompare = async () => {
      if (selectedArchives.length !== 2 || !activeRepo) return;
      setIsDiffing(true);
      setIsDiffOpen(true);
      setDiffLogs([]);

      let oldArchive = selectedArchives[0];
      let newArchive = selectedArchives[1];

      // Simple heuristic: if we find them in the list, the one with higher index is older (assuming sorted descending).
      const idx0 = archives.findIndex(a => a.name === selectedArchives[0]);
      const idx1 = archives.findIndex(a => a.name === selectedArchives[1]);
      
      if (idx0 < idx1) {
          newArchive = selectedArchives[0];
          oldArchive = selectedArchives[1];
      } else {
          newArchive = selectedArchives[1];
          oldArchive = selectedArchives[0];
      }
      
      try {
          await borgService.diffArchives(
              activeRepo.url,
              oldArchive, 
              newArchive,
              (log) => setDiffLogs(prev => [...prev, log]),
              { repoId: activeRepo.id, disableHostCheck: activeRepo.trustHost }
          );
      } catch (e) {
          console.error(e);
      } finally {
          setIsDiffing(false);
      }
  };

  const handleDeleteClick = (targets: string[]) => {
      setItemsToDelete(targets);
  };

  const confirmDelete = async () => {
      if (!itemsToDelete || !activeRepo) return;
      
      setIsDeleting(true);
      
      // Process one by one
      for (const archiveName of itemsToDelete) {
          try {
              await borgService.deleteArchive(
                  activeRepo.url,
                  archiveName,
                  (log) => console.log(log),
                  { repoId: activeRepo.id, disableHostCheck: activeRepo.trustHost }
              );
              toast.success(`Deleted archive: ${archiveName}`);
          } catch(e: any) {
              toast.error(`Failed to delete ${archiveName}`);
          }
      }
      
      setIsDeleting(false);
      setItemsToDelete(null);
      setSelectedArchives([]); // Clear selection
      onRefresh(); // Refresh list
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Archive Browser Modal */}
      {browserArchive && activeRepo && (
          <ArchiveBrowserModal 
             repo={activeRepo}
             archive={browserArchive}
             isOpen={!!browserArchive}
             onClose={() => setBrowserArchive(null)}
             onLog={(title, logs) => setLogData({ title, logs })}
             onExtractSuccess={(path) => setSuccessPath(path)}
          />
      )}

      {/* Extraction Log Modal (Errors) */}
      {logData && (
          <TerminalModal 
              isOpen={!!logData}
              title={logData.title}
              logs={logData.logs}
              isProcessing={false}
              onClose={() => setLogData(null)}
          />
      )}
      
      {/* Visual Diff Viewer */}
      <DiffViewerModal 
          isOpen={isDiffOpen}
          archiveOld={selectedArchives.length === 2 ? selectedArchives[0] : ''} // We pass these just for display headers
          archiveNew={selectedArchives.length === 2 ? selectedArchives[1] : ''}
          logs={diffLogs}
          isProcessing={isDiffing}
          onClose={() => setIsDiffOpen(false)}
      />

      {/* Extraction Success Modal */}
      <ExtractionSuccessModal 
          isOpen={!!successPath}
          path={successPath || ''}
          onClose={() => setSuccessPath(null)}
      />

      {/* Delete Confirmation Modal */}
      {itemsToDelete && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
                          <Trash2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete Archives?</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                          Are you sure you want to permanently delete <b>{itemsToDelete.length}</b> archive(s)? This cannot be undone.
                      </p>
                      
                      {itemsToDelete.length < 5 && (
                          <ul className="text-xs text-slate-600 dark:text-slate-300 font-mono mb-6 bg-slate-50 dark:bg-slate-900 p-2 rounded w-full">
                              {itemsToDelete.map(name => <li key={name} className="truncate">{name}</li>)}
                          </ul>
                      )}

                      <div className="flex gap-3 w-full">
                          <Button variant="secondary" onClick={() => setItemsToDelete(null)} disabled={isDeleting} className="flex-1">
                              Cancel
                          </Button>
                          <Button onClick={confirmDelete} disabled={isDeleting} variant="danger" className="flex-1">
                              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                          </Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Archives</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
             {activeRepo 
                ? `Snapshots for ${activeRepo.name}`
                : "Select a repository in the 'Repositories' tab to load archives."}
          </p>
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search archives..."
                  className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 transition-colors"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            {/* Diff Button */}
            {selectedArchives.length === 2 && (
                <Button 
                    onClick={handleCompare}
                    className="bg-purple-600 hover:bg-purple-700 text-white animate-in zoom-in"
                >
                    <GitCompare className="w-4 h-4 mr-2" />
                    Diff ({selectedArchives.length})
                </Button>
            )}
            
            {/* Bulk Delete Button */}
            {selectedArchives.length > 0 && (
                <Button 
                    variant="danger"
                    onClick={() => handleDeleteClick(selectedArchives)}
                    className="animate-in zoom-in"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete ({selectedArchives.length})
                </Button>
            )}
            
            <Button 
                variant="secondary" 
                onClick={handleFetchAllStats} 
                title="Fetch size & duration for all archives" 
                disabled={!activeRepo || isFetchingAll || filteredArchives.every(a => a.size !== 'Unknown')}
                className={isFetchingAll ? "bg-blue-50 text-blue-600 border-blue-200" : "dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"}
            >
                {isFetchingAll ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ListChecks className="w-4 h-4 mr-2" />}
                {isFetchingAll ? "Fetching..." : "Get All Stats"}
            </Button>

            <Button variant="secondary" onClick={onRefresh} title="Refresh Archives List" disabled={!activeRepo || isFetchingAll} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                <RefreshCw className="w-4 h-4" />
            </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
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
                            <p className="mb-4">{activeRepo ? "No archives found or list is empty." : "Connect to a repository to see archives."}</p>
                            {activeRepo && (
                                <Button variant="secondary" onClick={onRefresh} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Load Archives for {activeRepo.name}
                                </Button>
                            )}
                        </td>
                    </tr>
                ) : (
                    filteredArchives.map((archive) => {
                        const isSelected = selectedArchives.includes(archive.name);
                        return (
                        <tr key={archive.id} className={`hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group ${isSelected ? 'bg-purple-50 dark:bg-purple-900/10' : ''}`}>
                            <td className="px-3 py-4 text-center">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(archive.name)}
                                />
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Database className="w-4 h-4" />
                                </div>
                                {archive.name}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    {archive.time}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">
                                {archive.size === 'Unknown' ? (
                                    <button 
                                        onClick={() => handleGetInfo(archive.name)}
                                        className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                        title="Click to calculate size"
                                        disabled={loadingInfo === archive.name || isFetchingAll}
                                    >
                                        {loadingInfo === archive.name ? <Loader2 className="w-3 h-3 animate-spin"/> : <DownloadCloud className="w-3 h-3" />}
                                        Calc
                                    </button>
                                ) : (
                                    archive.size
                                )}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {archive.duration === 'Unknown' ? '-' : archive.duration}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                                        onClick={() => setBrowserArchive(archive)}
                                        disabled={isFetchingAll}
                                        title="Browse Files"
                                    >
                                        <FolderSearch className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                                        onClick={() => activeRepo && onMount(activeRepo, archive.name)}
                                        disabled={isFetchingAll}
                                        title="Mount Archive"
                                    >
                                        <HardDrive className="w-3 h-3" />
                                    </Button>
                                    
                                    {/* Delete Single Item */}
                                    <button 
                                        onClick={() => handleDeleteClick([archive.name])}
                                        className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                                        title="Delete Archive"
                                        disabled={isFetchingAll}
                                    >
                                        <Trash2 className="w-3 h-3" />
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
  );
};

export default ArchivesView;
