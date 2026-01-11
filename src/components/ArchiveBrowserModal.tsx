import React, { useState, useEffect, useMemo } from 'react';
import { Repository, Archive } from '../types';
import Button from './Button';
import { FileEntry, borgService } from '../services/borgService';
import { X, Folder, File, Download, ChevronRight, ChevronDown, Loader2, ArrowLeft, Search, Home, FolderInput } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface ArchiveBrowserModalProps {
  repo: Repository;
  archive: Archive;
  isOpen: boolean;
  onClose: () => void;
  onLog: (title: string, logs: string[]) => void;
  onExtractSuccess?: (path: string) => void;
}

// Simple Tree Node Structure
interface TreeNode {
    name: string;
    path: string;
    type: 'd' | 'f';
    size?: number;
    children?: { [key: string]: TreeNode };
}

const ArchiveBrowserModal: React.FC<ArchiveBrowserModalProps> = ({ repo, archive, isOpen, onClose, onLog, onExtractSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]); // Current directory stack
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
      if (isOpen) {
          loadFiles();
      } else {
          setFileList([]);
          setCurrentPath([]);
          setSelectedPaths([]);
          setSearch('');
      }
  }, [isOpen]);

  const loadFiles = async () => {
      setLoading(true);
      try {
          const files = await borgService.listArchiveFiles(repo.url, archive.name, { repoId: repo.id, disableHostCheck: repo.trustHost });
          // Sort so folders come first
          files.sort((a, b) => {
             if (a.type === 'd' && b.type !== 'd') return -1;
             if (a.type !== 'd' && b.type === 'd') return 1;
             return a.path.localeCompare(b.path);
          });
          setFileList(files);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Build a virtual view of the current folder based on the flat fileList
  const currentFolderContents = useMemo(() => {
      if (search) {
          // Flat search mode
          return fileList.filter(f => f.path.toLowerCase().includes(search.toLowerCase()));
      }

      const prefix = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
      
      // Filter items that start with prefix
      const relevant = fileList.filter(f => f.path.startsWith(prefix) && f.path !== prefix.slice(0, -1));
      
      // Reduce to direct children
      const directChildren: FileEntry[] = [];
      const seenFolders = new Set<string>();

      for (const file of relevant) {
          const relativePath = file.path.slice(prefix.length);
          const parts = relativePath.split('/');
          
          if (parts.length === 1) {
              // Direct child file or empty folder marker
              directChildren.push(file);
          } else {
              // It's a subfolder item
              const folderName = parts[0];
              if (!seenFolders.has(folderName)) {
                  seenFolders.add(folderName);
                  // Create a fake folder entry if it doesn't strictly exist in the list (Borg usually lists dirs explicitly though)
                  // Check if we already have the explicit folder entry
                  const existingDir = directChildren.find(c => c.path === prefix + folderName);
                  if (!existingDir) {
                      // Implicit folder
                      directChildren.push({
                          path: prefix + folderName,
                          type: 'd',
                          mode: 'drwxr-xr-x',
                          user: 'root',
                          group: 'root',
                          uid: 0, 
                          gid: 0,
                          healthy: true
                      });
                  }
              }
          }
      }
      
      // Sort folders first
      return directChildren.sort((a, b) => {
          if (a.type === 'd' && b.type !== 'd') return -1;
          if (a.type !== 'd' && b.type === 'd') return 1;
          return a.path.localeCompare(b.path);
      });
  }, [fileList, currentPath, search]);

  const handleNavigate = (folderName: string) => {
      setCurrentPath([...currentPath, folderName]);
      setSelectedPaths([]); // Clear selection on nav
  };

  const handleUp = () => {
      if (currentPath.length > 0) {
          setCurrentPath(currentPath.slice(0, -1));
          setSelectedPaths([]);
      }
  };

  const toggleSelection = (path: string) => {
      if (selectedPaths.includes(path)) {
          setSelectedPaths(selectedPaths.filter(p => p !== path));
      } else {
          setSelectedPaths([...selectedPaths, path]);
      }
  };

  const performExtraction = async (targetPath: string) => {
      setExtracting(true);
      try {
          const logCollector: string[] = [];

          // 1. Create directory first (Windows side) - ensures it exists
          const dirCreated = await borgService.createDirectory(targetPath);
          if (!dirCreated) {
              logCollector.push(`Error: Could not ensure local directory ${targetPath}`);
              onLog(`Extraction Error`, logCollector);
              setExtracting(false);
              return;
          }
          
          // 2. Extract into that directory
          const success = await borgService.extractFiles(
              repo.url,
              archive.name,
              selectedPaths,
              targetPath,
              (log) => logCollector.push(log),
              { repoId: repo.id, disableHostCheck: repo.trustHost }
          );

          if (success) {
              if (onExtractSuccess) {
                  onExtractSuccess(targetPath);
              } else {
                  // Fallback
                  const msg = `Files extracted to: ${targetPath}`;
                  logCollector.push(msg);
                  onLog(`Extraction Complete`, logCollector);
                  borgService.openPath(targetPath);
              }
              onClose();
          } else {
              onLog(`Extraction Failed`, logCollector);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setExtracting(false);
      }
  };

  const handleDownload = async () => {
      if (selectedPaths.length === 0) return;
      const downloadPath = await borgService.getDownloadsPath();
      const restoreFolder = `${downloadPath}\\WinBorg Restores\\${archive.name}_${Date.now()}`;
      await performExtraction(restoreFolder);
  };

  const handleRestoreTo = async () => {
      if (selectedPaths.length === 0) return;
      const result = await borgService.selectDirectory();
      if (result && result.length > 0) {
          await performExtraction(result[0]);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
           
           {/* Header */}
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
               <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       <Folder className="w-5 h-5 text-blue-500" />
                       Archive Browser
                   </h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">{archive.name} • {fileList.length} items loaded</p>
               </div>
               <button onClick={onClose} disabled={extracting} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X size={20} />
               </button>
           </div>

           {/* Toolbar */}
           <div className="px-4 py-2 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-4">
               
               {/* Breadcrumbs / Path */}
               <div className="flex items-center gap-2 flex-1 overflow-hidden">
                   <button 
                        onClick={() => setCurrentPath([])}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 ${currentPath.length === 0 ? 'text-blue-600' : 'text-slate-500'}`}
                   >
                       <Home className="w-4 h-4" />
                   </button>
                   {currentPath.map((folder, idx) => (
                       <React.Fragment key={folder + idx}>
                           <ChevronRight className="w-4 h-4 text-slate-300" />
                           <button 
                                onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
                                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 whitespace-nowrap"
                            >
                               {folder}
                           </button>
                       </React.Fragment>
                   ))}
               </div>

               {/* Search */}
               <div className="relative w-64">
                   <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <input 
                        type="text" 
                        placeholder="Search files..." 
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                   />
               </div>
           </div>

           {/* File List */}
           <div className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-slate-900/30 p-2">
               {loading ? (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400">
                       <Loader2 className="w-8 h-8 animate-spin mb-2" />
                       <p>Loading file list...</p>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 gap-1">
                       {/* Up Button */}
                       {currentPath.length > 0 && !search && (
                           <div 
                                className="flex items-center gap-3 p-2 rounded hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer text-slate-500 select-none"
                                onClick={handleUp}
                           >
                               <ArrowLeft className="w-4 h-4" />
                               <span className="text-sm">.. (Parent Directory)</span>
                           </div>
                       )}

                       {currentFolderContents.map((item) => {
                           const itemName = item.path.split('/').pop() || item.path;
                           const isSelected = selectedPaths.includes(item.path);

                           return (
                               <div 
                                    key={item.path}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer group transition-colors ${
                                        isSelected 
                                            ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800' 
                                            : 'hover:bg-white dark:hover:bg-slate-700 border border-transparent'
                                    }`}
                                    onClick={(e) => {
                                        // If clicking the row of a folder, navigate
                                        if (item.type === 'd' && !e.ctrlKey) {
                                            handleNavigate(itemName);
                                        } else {
                                            toggleSelection(item.path);
                                        }
                                    }}
                               >
                                   <div className="flex items-center gap-3 flex-1 min-w-0">
                                       <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSelection(item.path);
                                            }}
                                            className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${
                                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white dark:bg-slate-800'
                                            }`}
                                       >
                                           {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                       </div>
                                       
                                       {item.type === 'd' ? (
                                           <Folder className="w-5 h-5 text-yellow-500" />
                                       ) : (
                                           <File className="w-5 h-5 text-slate-400" />
                                       )}
                                       
                                       <span className="text-sm text-slate-700 dark:text-slate-200 truncate font-medium">
                                           {itemName}
                                       </span>
                                   </div>

                                   <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                       {item.type !== 'd' && item.size !== undefined && (
                                           <span>{formatBytes(item.size)}</span>
                                       )}
                                       <span className="w-24 text-right">{item.mtime?.split('T')[0] || '-'}</span>
                                   </div>
                               </div>
                           );
                       })}
                       
                       {currentFolderContents.length === 0 && (
                           <div className="text-center py-12 text-slate-400 italic">Folder is empty</div>
                       )}
                   </div>
               )}
           </div>

           {/* Footer */}
           <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
               <div className="text-xs text-slate-500">
                   {selectedPaths.length} items selected
               </div>
               <div className="flex gap-3">
                   <Button variant="secondary" onClick={onClose} disabled={extracting}>Cancel</Button>
                   <Button variant="secondary" onClick={handleRestoreTo} disabled={selectedPaths.length === 0 || extracting} title="Restore to a specific folder">
                       <FolderInput className="w-4 h-4 mr-2" />
                       Restore To...
                   </Button>
                   <Button onClick={handleDownload} disabled={selectedPaths.length === 0 || extracting} loading={extracting}>
                       <Download className="w-4 h-4 mr-2" />
                       Download Selection
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
};

export default ArchiveBrowserModal;