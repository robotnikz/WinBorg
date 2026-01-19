
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Repository, BackupJob } from '../types';
import Button from './Button';
import { Folder, Play, Trash2, X, Plus, Clock, Briefcase, Loader2, Settings, Calendar, ShieldAlert, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Copy, Pencil, Sparkles } from 'lucide-react';
import { borgService } from '../services/borgService';

interface JobsModalProps {
  repo: Repository;
  jobs: BackupJob[];
  isOpen: boolean;
  onClose: () => void;
  onAddJob: (job: BackupJob) => void;
    onUpdateJob: (job: BackupJob) => void;
  onDeleteJob: (jobId: string) => void;
  onRunJob: (jobId: string) => void;
}

const JobsModal: React.FC<JobsModalProps> = ({ repo, jobs, isOpen, onClose, onAddJob, onUpdateJob, onDeleteJob, onRunJob }) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'retention'>('general');
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [editingJob, setEditingJob] = useState<BackupJob | null>(null);

    const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Job Form State
  const [jobName, setJobName] = useState('');
    const [sourcePaths, setSourcePaths] = useState<string[]>([]);
    const [sourcePathInput, setSourcePathInput] = useState('');
    const [excludePatternsText, setExcludePatternsText] = useState('');
  const [archivePrefix, setArchivePrefix] = useState('');
  const [compression, setCompression] = useState<BackupJob['compression']>('zstd');

  // Quick presets
  type PresetId = 'userFolders' | 'userProfile' | 'documentsOnly' | '';
  const [presetId, setPresetId] = useState<PresetId>('');
  const [includeAppData, setIncludeAppData] = useState(false);

  const windowsHome = useMemo(() => {
      try {
          const w = window as any;
          const envHome = w?.process?.env?.USERPROFILE;
          if (typeof envHome === 'string' && envHome.trim()) return envHome.trim();
          if (typeof w?.require === 'function') {
              const os = w.require('os');
              const home = os?.homedir?.();
              if (typeof home === 'string' && home.trim()) return home.trim();
          }
      } catch {
          // ignore
      }
      return null;
  }, []);

  const applyPreset = (id: PresetId) => {
      if (!id) return;

      // If we can't determine the user's home directory (e.g. browser mode),
      // keep the preset selection but avoid writing broken paths.
      if (!windowsHome) {
          setPresetId(id);
          return;
      }

      const home = windowsHome.replace(/[\\/]+$/, '');

      const defaultExcludes = () => {
          const patterns: string[] = [
              '**/node_modules',
              '**/.git',
              '**/.cache',
              '**/Cache',
              '**/Temp',
              `${home}\\AppData\\Local\\Temp`,
          ];
          if (!includeAppData) {
              patterns.push(`${home}\\AppData`);
          }
          return patterns;
      };

      if (id === 'userFolders') {
          setJobName('My Documents');
          setArchivePrefix('docs');
          setSourcePaths([
              `${home}\\Documents`,
              `${home}\\Desktop`,
              `${home}\\Pictures`,
          ]);
          setExcludePatternsText(defaultExcludes().join('\n'));
      }

      if (id === 'documentsOnly') {
          setJobName('Documents');
          setArchivePrefix('documents');
          setSourcePaths([`${home}\\Documents`]);
          setExcludePatternsText(defaultExcludes().join('\n'));
      }

      if (id === 'userProfile') {
          setJobName('User Profile');
          setArchivePrefix('home');
          setSourcePaths([home]);
          setExcludePatternsText(defaultExcludes().join('\n'));
      }
  };
  
  // Prune State
  const [pruneEnabled, setPruneEnabled] = useState(true);
  const [keepDaily, setKeepDaily] = useState(7);
  const [keepWeekly, setKeepWeekly] = useState(4);
  const [keepMonthly, setKeepMonthly] = useState(6);
  const [keepYearly, setKeepYearly] = useState(1);

  // Schedule State
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState<'daily' | 'hourly' | 'manual'>('daily');
  const [scheduleTime, setScheduleTime] = useState('14:00');

    useEffect(() => {
        if (!isOpen) return;
        closeButtonRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCreate = () => {
      if (!jobName || sourcePaths.length === 0 || !archivePrefix) return;

      const excludePatterns = excludePatternsText
          .split(/\r?\n/)
          .map(p => p.trim())
          .filter(Boolean);

      const uniqueSourcePaths = Array.from(new Set(sourcePaths.map(p => p.trim()).filter(Boolean)));
      if (uniqueSourcePaths.length === 0) return;
      
      const baseJob: BackupJob = editingJob
          ? editingJob
          : {
              id: Math.random().toString(36).substr(2, 9),
              repoId: repo.id,
              name: jobName,
              sourcePath: uniqueSourcePaths[0],
              sourcePaths: uniqueSourcePaths,
              archivePrefix,
              lastRun: 'Never',
              status: 'idle',
              compression,
              pruneEnabled,
              keepDaily,
              keepWeekly,
              keepMonthly,
              keepYearly,
              scheduleEnabled,
              scheduleType,
              scheduleTime
          };

      const updatedJob: BackupJob = {
          ...baseJob,
          repoId: repo.id,
          name: jobName,
          // legacy compatibility
          sourcePath: uniqueSourcePaths[0],
          sourcePaths: uniqueSourcePaths,
          excludePatterns: excludePatterns.length ? excludePatterns : undefined,
          archivePrefix,
          compression,
          pruneEnabled,
          keepDaily,
          keepWeekly,
          keepMonthly,
          keepYearly,
          scheduleEnabled,
          scheduleType,
          scheduleTime
      };

      if (editingJob) {
          onUpdateJob(updatedJob);
      } else {
          onAddJob(updatedJob);
      }
      resetForm();
      setView('list');
  };

  const resetForm = () => {
      setEditingJob(null);
      setJobName('');
      setSourcePaths([]);
      setSourcePathInput('');
      setExcludePatternsText('');
      setArchivePrefix('');
      setCompression('zstd');
      setPresetId('');
      setIncludeAppData(false);
      setPruneEnabled(true);
      setKeepDaily(7);
      setKeepWeekly(4);
      setKeepMonthly(6);
      setKeepYearly(1);
      setScheduleEnabled(false);
      setScheduleType('daily');
      setScheduleTime('14:00');
      setActiveTab('general');
  };

  const handleEdit = (job: BackupJob) => {
      setEditingJob(job);
      setView('create');
      setActiveTab('general');
      setJobName(job.name || '');
      setPresetId('');
      setIncludeAppData(false);
      const initialSources = (job.sourcePaths && job.sourcePaths.length)
          ? job.sourcePaths
          : (job.sourcePath ? [job.sourcePath] : []);
      setSourcePaths(initialSources);
      setSourcePathInput('');
      setExcludePatternsText(job.excludePatterns?.join('\n') || '');
      setArchivePrefix(job.archivePrefix || '');
      setCompression(job.compression || 'zstd');
      setPruneEnabled(!!job.pruneEnabled);
      setKeepDaily(job.keepDaily ?? 7);
      setKeepWeekly(job.keepWeekly ?? 4);
      setKeepMonthly(job.keepMonthly ?? 6);
      setKeepYearly(job.keepYearly ?? 1);
      setScheduleEnabled(!!job.scheduleEnabled);
      setScheduleType(job.scheduleType || 'daily');
      setScheduleTime(job.scheduleTime || '14:00');
  };

  const handleSelectFolder = async () => {
      const paths = await borgService.selectDirectory();
      if (paths && paths.length > 0) {
          const cleaned = paths.map(p => p.trim()).filter(Boolean);
          if (cleaned.length === 0) return;
          setSourcePaths(prev => Array.from(new Set([...prev, ...cleaned])));
      }
  };

  const addSourcePathFromInput = () => {
      const raw = sourcePathInput.trim();
      if (!raw) return;

      // allow users to paste multiple lines
      const toAdd = raw
          .split(/\r?\n/)
          .map(p => p.trim())
          .filter(Boolean);

      if (toAdd.length === 0) return;
      setSourcePaths(prev => Array.from(new Set([...prev, ...toAdd])));
      setSourcePathInput('');
  };

  const moveSourcePath = (index: number, direction: -1 | 1) => {
      setSourcePaths(prev => {
          const nextIndex = index + direction;
          if (nextIndex < 0 || nextIndex >= prev.length) return prev;
          const copy = [...prev];
          const tmp = copy[index];
          copy[index] = copy[nextIndex];
          copy[nextIndex] = tmp;
          return copy;
      });
  };

  const copyToClipboard = async (text: string) => {
      try {
          await navigator.clipboard.writeText(text);
      } catch {
          // ignore (clipboard may be unavailable in some contexts)
      }
  };

  const repoJobs = jobs.filter(j => j.repoId === repo.id);

  return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                onClose();
            }}
        >
             <div
                 className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                 role="dialog"
                 aria-modal="true"
                 aria-label={`Backup Jobs for ${repo.name}`}
             >
           
           {/* HEADER */}
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
               <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                       Backup Jobs
                   </h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Manage persistent tasks for {repo.name}</p>
               </div>
                             <button
                                 ref={closeButtonRef}
                                 onClick={onClose}
                                 className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                 aria-label="Close"
                             >
                 <X size={20} />
               </button>
           </div>

           {view === 'list' ? (
               <div className="p-6 flex-1 overflow-y-auto">
                   {repoJobs.length === 0 ? (
                       <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                           <Briefcase className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                           <p className="text-slate-500 dark:text-slate-400 mb-4">No jobs configured yet.</p>
                           <Button onClick={() => setView('create')}>Create First Job</Button>
                       </div>
                   ) : (
                       <div className="space-y-3">
                           {repoJobs.map(job => (
                               <div key={job.id} className="bg-white dark:bg-slate-700/30 border border-gray-200 dark:border-slate-700 rounded-lg p-4 flex items-center justify-between group hover:border-purple-200 dark:hover:border-purple-800 transition-colors shadow-sm">
                                   <div className="min-w-0 flex-1 mr-4">
                                       <div className="flex items-center gap-2 mb-1">
                                           <h4 className="font-semibold text-slate-800 dark:text-slate-200">{job.name}</h4>
                                           {job.status === 'running' && (
                                               <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded animate-pulse">
                                                   <Loader2 className="w-3 h-3 animate-spin" /> Running
                                               </span>
                                           )}
                                           {job.pruneEnabled && (
                                               <span className="text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800/50">Auto-Prune</span>
                                           )}
                                           {!!job.excludePatterns?.length && (
                                               <span className="text-[10px] text-slate-600 bg-slate-50 dark:bg-slate-900/30 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                   Excludes: {job.excludePatterns.length}
                                               </span>
                                           )}
                                       </div>
                                       <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                                           <Folder className="w-3 h-3" /> {(job.sourcePaths && job.sourcePaths.length ? job.sourcePaths[0] : job.sourcePath)}
                                           {job.sourcePaths && job.sourcePaths.length > 1 && (
                                               <button
                                                   type="button"
                                                   onClick={() => setExpandedJobId(prev => prev === job.id ? null : job.id)}
                                                   className="text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
                                                   title="Show all source folders"
                                               >
                                                   Sources: {job.sourcePaths.length}
                                                   {expandedJobId === job.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                               </button>
                                           )}
                                       </div>

                                       {expandedJobId === job.id && job.sourcePaths && job.sourcePaths.length > 1 && (
                                           <div className="mt-2 space-y-1">
                                               {job.sourcePaths.map((p) => (
                                                   <div key={p} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-md">
                                                       <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300 font-mono truncate">{p}</div>
                                                       <button
                                                           type="button"
                                                           onClick={() => copyToClipboard(p)}
                                                           className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                           title="Copy path"
                                                       >
                                                           <Copy className="w-4 h-4" />
                                                       </button>
                                                   </div>
                                               ))}
                                           </div>
                                       )}
                                       <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                           <Clock className="w-3 h-3" /> Last run: {job.lastRun === 'Never' ? 'Never' : new Date(job.lastRun).toLocaleString()}
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-2">
                                       <button 
                                            onClick={() => onRunJob(job.id)}
                                            disabled={job.status === 'running'}
                                            className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors"
                                            title="Run Job Now"
                                        >
                                           <Play className="w-4 h-4 fill-current" />
                                       </button>
                                       <button 
                                            onClick={() => handleEdit(job)}
                                            disabled={job.status === 'running'}
                                            className="p-2 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-900/50 disabled:opacity-50 transition-colors"
                                            title="Edit Job"
                                        >
                                           <Pencil className="w-4 h-4" />
                                       </button>
                                       <button 
                                            onClick={() => onDeleteJob(job.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete Job"
                                        >
                                           <Trash2 className="w-4 h-4" />
                                       </button>
                                   </div>
                               </div>
                           ))}
                           
                           <div className="pt-4">
                               <Button variant="secondary" onClick={() => setView('create')} className="w-full border-dashed dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                                   <Plus className="w-4 h-4 mr-2" /> Add Another Job
                               </Button>
                           </div>
                       </div>
                   )}
               </div>
           ) : (
               <>
                   {/* TABS HEADER */}
                   <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                       <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'general' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50 dark:bg-purple-900/20 dark:text-purple-400' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                           <Settings className="w-4 h-4" /> General
                       </button>
                       <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'schedule' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                           <Calendar className="w-4 h-4" /> Schedule
                       </button>
                       <button onClick={() => setActiveTab('retention')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'retention' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50 dark:bg-orange-900/20 dark:text-orange-400' : 'text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                           <ShieldAlert className="w-4 h-4" /> Retention
                       </button>
                   </div>

                   <div className="p-6 flex-1 overflow-y-auto space-y-6">
                       
                       {/* --- GENERAL TAB --- */}
                       {activeTab === 'general' && (
                           <>
                               <div className="p-4 bg-purple-50/60 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                   <div className="flex items-start justify-between gap-3">
                                       <div>
                                           <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                               <Sparkles className="w-4 h-4" /> Quick Presets
                                           </h4>
                                           <p className="text-xs text-purple-900/80 dark:text-purple-200/80 mt-1">
                                               One-click job templates to get your first backup running fast.
                                           </p>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <select
                                               className="px-3 py-2 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-md text-sm text-slate-900 dark:text-white"
                                               value={presetId}
                                               onChange={(e) => setPresetId(e.target.value as PresetId)}
                                               aria-label="Job preset"
                                           >
                                               <option value="">Select a preset…</option>
                                               <option value="userFolders">Documents + Desktop + Pictures (Recommended)</option>
                                               <option value="documentsOnly">Documents only</option>
                                               <option value="userProfile">Entire user profile (advanced)</option>
                                           </select>
                                           <Button
                                               variant="secondary"
                                               className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                                               onClick={() => applyPreset(presetId)}
                                               disabled={!presetId}
                                           >
                                               Apply
                                           </Button>
                                       </div>
                                   </div>

                                   {presetId === 'userProfile' && (
                                       <div className="mt-3 flex items-center justify-between gap-3">
                                           <div className="text-xs text-slate-600 dark:text-slate-300">
                                               Include AppData (Roaming/Local). Disabling keeps backups smaller.
                                           </div>
                                           <input
                                               type="checkbox"
                                               className="w-4 h-4 text-purple-600 rounded"
                                               checked={includeAppData}
                                               onChange={(e) => setIncludeAppData(e.target.checked)}
                                           />
                                       </div>
                                   )}

                                   {!windowsHome && (
                                       <p className="text-[10px] text-purple-900/70 dark:text-purple-200/70 mt-2">
                                           Presets need access to your Windows profile path. If you’re running in browser/mock mode, use “Add Folder…” instead.
                                       </p>
                                   )}
                               </div>

                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Job Name</label>
                                   <input 
                                       type="text" 
                                       className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                       placeholder="e.g. My Documents"
                                       value={jobName}
                                       onChange={e => setJobName(e.target.value)}
                                   />
                               </div>

                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Source Folders</label>

                                   <div className="flex gap-2">
                                       <Button variant="secondary" onClick={handleSelectFolder} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                                           <Folder className="w-4 h-4 mr-2" /> Add Folder…
                                       </Button>
                                       <Button
                                           variant="secondary"
                                           onClick={() => setSourcePaths([])}
                                           className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
                                           disabled={sourcePaths.length === 0}
                                       >
                                           Clear
                                       </Button>
                                   </div>

                                   <div className="mt-3">
                                       <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Paste a path (optional)</label>
                                       <div className="flex gap-2">
                                           <input
                                               type="text"
                                               className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                               placeholder="e.g. C:\\Users\\tobia\\Documents"
                                               value={sourcePathInput}
                                               onChange={(e) => setSourcePathInput(e.target.value)}
                                               onKeyDown={(e) => {
                                                   if (e.key === 'Enter') {
                                                       e.preventDefault();
                                                       addSourcePathFromInput();
                                                   }
                                               }}
                                           />
                                           <Button variant="secondary" onClick={addSourcePathFromInput} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Add</Button>
                                       </div>
                                       <p className="text-[10px] text-slate-400 mt-1">
                                           Tip: You can add multiple folders. The first one is shown on the job card.
                                       </p>
                                   </div>

                                   {sourcePaths.length > 0 && (
                                       <div className="mt-3 space-y-1">
                                           {sourcePaths.map((p, idx) => (
                                               <div key={p} className="flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
                                                   <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300 font-mono truncate">{p}</div>
                                                   <div className="flex items-center gap-1">
                                                       <button
                                                           type="button"
                                                           onClick={() => copyToClipboard(p)}
                                                           className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                           title="Copy"
                                                       >
                                                           <Copy className="w-4 h-4" />
                                                       </button>
                                                       <button
                                                           type="button"
                                                           onClick={() => moveSourcePath(idx, -1)}
                                                           className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
                                                           title="Move up"
                                                           disabled={idx === 0}
                                                       >
                                                           <ArrowUp className="w-4 h-4" />
                                                       </button>
                                                       <button
                                                           type="button"
                                                           onClick={() => moveSourcePath(idx, 1)}
                                                           className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
                                                           title="Move down"
                                                           disabled={idx === sourcePaths.length - 1}
                                                       >
                                                           <ArrowDown className="w-4 h-4" />
                                                       </button>
                                                       <button
                                                           type="button"
                                                           onClick={() => setSourcePaths(prev => prev.filter(x => x !== p))}
                                                           className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                           title="Remove"
                                                       >
                                                           <X size={14} />
                                                       </button>
                                                   </div>
                                               </div>
                                           ))}
                                       </div>
                                   )}
                               </div>

                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Archive Prefix</label>
                                   <input 
                                       type="text" 
                                       className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                       placeholder="e.g. docs"
                                       value={archivePrefix}
                                       onChange={e => setArchivePrefix(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                                   />
                                   <p className="text-[10px] text-slate-400 mt-1">
                                       Archives will be named like: <code>{archivePrefix || 'prefix'}-YYYY-MM-DD-HHMM</code>
                                   </p>
                               </div>

                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Compression</label>
                                   <select
                                       className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white"
                                       value={compression}
                                       onChange={(e) => setCompression(e.target.value as any)}
                                   >
                                       <option value="zstd">ZSTD (Recommended, Balanced)</option>
                                       <option value="lz4">LZ4 (Fastest, Larger files)</option>
                                       <option value="zlib">ZLIB (Compatibility)</option>
                                       <option value="none">None</option>
                                       <option value="auto">Auto (Legacy)</option>
                                   </select>
                                   <p className="text-[10px] text-slate-400 mt-1">
                                       ZSTD provides the best balance between speed and compression ratio.
                                   </p>
                               </div>

                               <div>
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Exclude Patterns (Optional)</label>
                                   <textarea
                                       className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 min-h-[96px]"
                                       placeholder={[
                                           "node_modules",
                                           ".git",
                                           "**/Cache",
                                           "C:\\Temp"
                                       ].join("\n")}
                                       value={excludePatternsText}
                                       onChange={e => setExcludePatternsText(e.target.value)}
                                   />
                                   <p className="text-[10px] text-slate-400 mt-1">
                                       One pattern per line. Passed to borg as <code>--exclude &lt;pattern&gt;</code>.
                                   </p>
                               </div>
                           </>
                       )}

                       {/* --- SCHEDULE TAB --- */}
                       {activeTab === 'schedule' && (
                           <>
                               <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                                   <div className="flex items-center justify-between">
                                       <div>
                                           <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Enable Schedule</h4>
                                           <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">Run this job automatically when the app is open (or minimized).</p>
                                       </div>
                                       <input 
                                           type="checkbox" 
                                           className="w-5 h-5 text-blue-600 rounded"
                                           checked={scheduleEnabled}
                                           onChange={(e) => setScheduleEnabled(e.target.checked)}
                                       />
                                   </div>
                               </div>

                               <div className={scheduleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}>
                                   <div className="grid grid-cols-2 gap-4">
                                       <div>
                                           <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Frequency</label>
                                           <select
                                               className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white"
                                               value={scheduleType}
                                               onChange={(e) => setScheduleType(e.target.value as any)}
                                           >
                                               <option value="daily">Daily</option>
                                               <option value="hourly">Hourly</option>
                                           </select>
                                       </div>
                                       {scheduleType === 'daily' && (
                                           <div>
                                               <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Time</label>
                                               <input 
                                                   type="time" 
                                                   className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white"
                                                   value={scheduleTime}
                                                   onChange={(e) => setScheduleTime(e.target.value)}
                                               />
                                           </div>
                                       )}
                                   </div>
                               </div>
                           </>
                       )}

                       {/* --- RETENTION TAB --- */}
                       {activeTab === 'retention' && (
                           <>
                               <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-4">
                                   <div className="flex items-center justify-between">
                                       <div>
                                           <h4 className="text-sm font-bold text-orange-900 dark:text-orange-200">Prune after Backup</h4>
                                           <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">Automatically delete old archives to save space.</p>
                                       </div>
                                       <input 
                                           type="checkbox" 
                                           className="w-5 h-5 text-orange-600 rounded"
                                           checked={pruneEnabled}
                                           onChange={(e) => setPruneEnabled(e.target.checked)}
                                       />
                                   </div>
                               </div>

                               <div className={`grid grid-cols-2 gap-4 ${pruneEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Daily</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-900 dark:text-white"
                                           value={keepDaily}
                                           onChange={e => setKeepDaily(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Weekly</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-900 dark:text-white"
                                           value={keepWeekly}
                                           onChange={e => setKeepWeekly(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Monthly</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-900 dark:text-white"
                                           value={keepMonthly}
                                           onChange={e => setKeepMonthly(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div>
                                       <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Keep Yearly</label>
                                       <input 
                                           type="number" 
                                           className="w-full border border-gray-300 dark:border-slate-600 rounded p-2 text-sm bg-white dark:bg-slate-900 dark:text-white"
                                           value={keepYearly}
                                           onChange={e => setKeepYearly(parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                               </div>
                           </>
                       )}

                   </div>
               </>
           )}

           <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 shrink-0">
               {view === 'create' ? (
                   <>
                       <Button variant="secondary" onClick={() => { setView('list'); resetForm(); }}>Cancel</Button>
                       <Button onClick={handleCreate} disabled={!jobName || sourcePaths.length === 0 || !archivePrefix}>{editingJob ? 'Save Changes' : 'Save Job'}</Button>
                   </>
               ) : (
                   <Button variant="secondary" onClick={onClose}>Close</Button>
               )}
           </div>
       </div>
    </div>
  );
};

export default JobsModal;
