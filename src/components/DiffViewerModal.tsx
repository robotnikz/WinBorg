
import React, { useState, useMemo } from 'react';
import { X, FilePlus, FileMinus, FileDiff, File, Search, AlertCircle, ArrowRight } from 'lucide-react';
import Button from './Button';

interface DiffViewerModalProps {
  isOpen: boolean;
  archiveOld: string;
  archiveNew: string;
  logs: string[];
  onClose: () => void;
  isProcessing: boolean;
}

interface DiffEntry {
  type: 'added' | 'removed' | 'modified' | 'unknown';
  path: string;
  size?: string;
  raw: string;
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({ isOpen, archiveOld, archiveNew, logs, onClose, isProcessing }) => {
  const [search, setSearch] = useState('');

  // Parser logic to transform raw borg diff text into structured data
  const parsedEntries = useMemo(() => {
    return logs.map((line): DiffEntry => {
      // Remove timestamp prefixes if present e.g., "[18:41:02] "
      const cleanLine = line.replace(/^\[.*?\]\s*/, '').trim();

      // Regex strategies for different borg output formats
      // 1. "added 1.5 MB path/to/file"
      // 2. "removed 17 B path/to/file"
      // 3. "modified 12 KB path/to/file"
      const match = cleanLine.match(/^(added|removed|modified|changed)\s+([\d\.]+\s+[kMGTP]?B)?\s*(.*)$/i);

      if (match) {
        const action = match[1].toLowerCase();
        return {
          type: action === 'added' ? 'added' : action === 'removed' ? 'removed' : 'modified',
          size: match[2]?.trim(),
          path: match[3]?.trim() || '',
          raw: cleanLine
        };
      }

      // Fallback for header lines or unknown formats
      return { type: 'unknown', path: '', raw: cleanLine };
    }).filter(e => e.raw.length > 0); // Remove empty lines
  }, [logs]);

  const filteredEntries = parsedEntries.filter(entry => 
    entry.path.toLowerCase().includes(search.toLowerCase()) || 
    entry.raw.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
      return {
          added: parsedEntries.filter(e => e.type === 'added').length,
          removed: parsedEntries.filter(e => e.type === 'removed').length,
          modified: parsedEntries.filter(e => e.type === 'modified').length,
      };
  }, [parsedEntries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
               Diff Report
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                <span>{archiveOld}</span>
                <ArrowRight className="w-3 h-3" />
                <span>{archiveNew}</span>
            </div>
          </div>
          {!isProcessing && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Toolbar / Stats */}
        <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                    <FilePlus className="w-4 h-4" /> {stats.added} Added
                </span>
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                    <FileMinus className="w-4 h-4" /> {stats.removed} Removed
                </span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                    <FileDiff className="w-4 h-4" /> {stats.modified} Modified
                </span>
            </div>

            <div className="relative w-64">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                    type="text" 
                    placeholder="Filter changes..." 
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
               />
           </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-slate-900/50">
            {isProcessing && parsedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="animate-spin mb-3">
                        <FileDiff className="w-8 h-8 opacity-50" />
                    </div>
                    <p>Comparing archives...</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                        <AlertCircle className="w-8 h-8 opacity-50" />
                    </div>
                    <p>{search ? 'No matching changes found.' : 'No differences found between these archives.'}</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {filteredEntries.map((entry, idx) => (
                        <div 
                            key={idx} 
                            className={`flex items-start gap-3 p-2.5 rounded text-sm group transition-colors border border-transparent ${
                                entry.type === 'added' ? 'bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-100 dark:hover:border-green-900/30' :
                                entry.type === 'removed' ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-100 dark:hover:border-red-900/30' :
                                entry.type === 'modified' ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-100 dark:hover:border-blue-900/30' :
                                'hover:bg-white dark:hover:bg-slate-700'
                            }`}
                        >
                            {/* Icon Column */}
                            <div className="mt-0.5 shrink-0">
                                {entry.type === 'added' && <FilePlus className="w-4 h-4 text-green-600 dark:text-green-400" />}
                                {entry.type === 'removed' && <FileMinus className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                {entry.type === 'modified' && <FileDiff className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                {entry.type === 'unknown' && <File className="w-4 h-4 text-slate-400" />}
                            </div>

                            {/* Content Column */}
                            <div className="flex-1 min-w-0">
                                {entry.type === 'unknown' ? (
                                    <span className="font-mono text-xs text-slate-500 break-all">{entry.raw}</span>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className={`font-medium break-all ${
                                            entry.type === 'added' ? 'text-green-900 dark:text-green-200' :
                                            entry.type === 'removed' ? 'text-red-900 dark:text-red-200 decoration-red-900/30 line-through' :
                                            entry.type === 'modified' ? 'text-blue-900 dark:text-blue-200' : 
                                            'text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {entry.path}
                                        </span>
                                        {entry.size && (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                                {entry.size}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
                Close
            </Button>
        </div>
      </div>
    </div>
  );
};

export default DiffViewerModal;
