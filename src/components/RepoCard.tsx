
import React from 'react';
import { Repository, BackupJob } from '../types';
import { Server, Shield, Clock, HardDrive, Trash2, Loader2, Edit2, ShieldCheck, Unlock, Lock, Wrench, Key, UploadCloud, Briefcase, CalendarClock } from 'lucide-react';
import { getNextRunForRepo, formatDate } from '../utils/formatters';

interface RepoCardProps {
  repo: Repository;
  jobs?: BackupJob[];
  onMount?: (repo: Repository) => void;
  onConnect?: (repo: Repository) => void;
  onDelete?: (repo: Repository) => void;
  onEdit?: (repo: Repository) => void;
  onCheck?: (repo: Repository) => void;
  onBreakLock?: (repo: Repository) => void;
  onMaintenance?: (repo: Repository) => void;
  onExportKey?: (repo: Repository) => void;
  onBackup?: (repo: Repository) => void;
  onManageJobs?: (repo: Repository) => void;
}

const RepoCard: React.FC<RepoCardProps> = ({ repo, jobs, onMount, onConnect, onDelete, onEdit, onCheck, onBreakLock, onMaintenance, onExportKey, onBackup, onManageJobs }) => {
  
  const nextRun = jobs ? getNextRunForRepo(jobs, repo.id) : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/75 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden flex flex-col h-full">
      
      {/* Header Row: Icon + Name (Full Width) */}
      <div className="flex items-start gap-4 mb-4">
          <div 
            className={`p-3 rounded-xl transition-colors shrink-0 ${
              repo.status === 'connected' ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
            }`}
            title={repo.status === 'connected' ? 'Repository Connected' : 'Repository Offline'}
          >
            <Server className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate leading-tight" title={repo.name}>{repo.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono opacity-80 mt-1" title={`Repository URL: ${repo.url}`}>{repo.url}</p>
          </div>
          
          {/* Status Indicator (Compact) */}
          <div className="shrink-0 flex flex-col items-end gap-1">
             <div 
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  repo.status === 'connected' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 
                  repo.status === 'connecting' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                  'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600'
                }`}
                title={`Current Connection Status: ${repo.status.toUpperCase()}`}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${
                     repo.status === 'connected' ? 'bg-green-500' : 
                     repo.status === 'connecting' ? 'bg-blue-500 animate-pulse' :
                     'bg-gray-400'
                }`} />
                {repo.status === 'connected' ? 'Online' : repo.status === 'connecting' ? '...' : 'Offline'}
            </div>
            {repo.isLocked && (
                 <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800" title="Repo is Locked (lock.roster detected). Operations blocked.">
                     <Lock className="w-3 h-3" /> Locked
                 </div>
            )}
          </div>
      </div>

      {/* Toolbar Row (Full Width underneath header) */}
      <div className="flex items-center bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700/50 rounded-lg p-1.5 gap-1 mb-5">
            {/* Main Operational Buttons */}
            <div className="flex-1 flex gap-2">
                 {onCheck && repo.status === 'connected' && (
                    <button 
                       onClick={() => onCheck(repo)}
                       className="px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center gap-1"
                       title="Run Integrity Check (borg check) to verify data consistency"
                    >
                       <ShieldCheck className="w-3.5 h-3.5" /> Verify
                    </button>
                 )}
                 {onBreakLock && (
                     <button 
                       onClick={() => onBreakLock(repo)}
                       className="px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors flex items-center gap-1"
                       title="Force remove lock files (Use only if no other backup is running)"
                    >
                       <Unlock className="w-3.5 h-3.5" /> Unlock
                    </button>
                 )}
            </div>

            {/* Config Icons */}
            <div className="flex items-center gap-0.5 border-l border-gray-200 dark:border-slate-700 pl-1">
                {onMaintenance && repo.status === 'connected' && (
                  <button onClick={() => onMaintenance(repo)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded" title="Maintenance: Prune old archives & Compact space" aria-label="Maintenance">
                        <Wrench className="w-3.5 h-3.5" />
                    </button>
                )}
                {onExportKey && repo.encryption !== 'none' && (
                  <button onClick={() => onExportKey(repo)} className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/20 rounded" title="Export / Backup Encryption Key" aria-label="Export Encryption Key">
                        <Key className="w-3.5 h-3.5" />
                    </button>
                )}
                {onEdit && (
                  <button onClick={() => onEdit(repo)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded" title="Edit Connection Settings" aria-label="Edit Repository">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                )}
                {onDelete && (
                  <button onClick={() => onDelete(repo)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded" title="Remove Repository or Destroy Data" aria-label="Remove Repository">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-5 px-1 mt-auto">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400" title="Date of last successful backup found in this repo">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="truncate">{repo.lastBackup === 'Never' ? 'Never' : formatDate(repo.lastBackup)}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400" title="Total deduplicated size of repository">
          <HardDrive className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="font-medium truncate">{repo.size}</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400" title={`Encryption Mode: ${repo.encryption}`}>
          <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="capitalize truncate">{repo.encryption === 'none' ? 'No Encryption' : `${repo.encryption} encryption`}</span>
        </div>
        {/* Next Backup Indicator */}
        {nextRun && (
            <div className="flex items-center gap-2.5 text-xs text-purple-600 dark:text-purple-400 font-medium" title="Next scheduled backup">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{nextRun}</span>
            </div>
        )}
      </div>

      {/* Primary Actions */}
      <div className="flex flex-col gap-2">
         <div className="flex gap-2">
            <button 
              onClick={() => onConnect?.(repo)}
              disabled={repo.status === 'connecting'}
              title={repo.status === 'connected' ? "Refresh repository information" : "Connect via SSH/Local Path"}
              className={`flex-1 h-9 px-3 py-2 text-xs font-semibold rounded-lg transition-all border flex items-center justify-center gap-2 ${
                  repo.status === 'connected' 
                  ? 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600' 
                  : 'bg-slate-800 dark:bg-blue-600 text-white border-transparent hover:bg-slate-700 dark:hover:bg-blue-700 shadow-sm'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {repo.status === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {repo.status === 'connected' ? 'Refresh' : 'Connect'}
            </button>
            
            {repo.status === 'connected' && (
                <>
                <button 
                  onClick={() => onMount?.(repo)}
                  title="Browse and Mount existing archives to Windows/WSL"
                  className="flex-1 h-9 px-3 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-400 transition-colors shadow-sm"
                >
                  Mount
                </button>
                {onManageJobs && (
                    <button 
                        onClick={() => onManageJobs(repo)}
                        title="Manage Backup Jobs & Schedules"
                        aria-label="Manage Backup Jobs & Schedules"
                        className="h-9 px-3 py-2 text-xs font-semibold bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 rounded-lg text-purple-700 dark:text-purple-400 transition-colors shadow-sm"
                    >
                        <Briefcase className="w-4 h-4" />
                    </button>
                )}
                {onBackup && (
                    <button 
                        onClick={() => onBackup(repo)}
                        title="Create a One-off Snapshot now"
                    aria-label="Create a One-off Snapshot now"
                        className="px-3 py-2 text-xs font-semibold bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 transition-colors shadow-sm"
                    >
                        <UploadCloud className="w-4 h-4" />
                    </button>
                )}
                </>
            )}
         </div>
      </div>
    </div>
  );
};

export default RepoCard;
