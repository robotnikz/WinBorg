
import React, { useState } from 'react';
import { Repository, BackupJob } from '../types';
import Button from './Button';
import { Folder, Play, Trash2, X, Plus, Clock, Briefcase, Loader2, Settings, Calendar, ShieldAlert } from 'lucide-react';
import { borgService } from '../services/borgService';

interface JobsModalProps {
  repo: Repository;
  jobs: BackupJob[];
  isOpen: boolean;
  onClose: () => void;
  onAddJob: (job: BackupJob) => void;
  onDeleteJob: (jobId: string) => void;
  onRunJob: (jobId: string) => void;
}

const JobsModal: React.FC<JobsModalProps> = ({ repo, jobs, isOpen, onClose, onAddJob, onDeleteJob, onRunJob }) => {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'retention'>('general');
  
  // Job Form State
  const [jobName, setJobName] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [archivePrefix, setArchivePrefix] = useState('');
  const [compression, setCompression] = useState<BackupJob['compression']>('zstd');
  
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

  if (!isOpen) return null;

  const handleCreate = () => {
      if (!jobName || !sourcePath || !archivePrefix) return;
      
      const newJob: BackupJob = {
          id: Math.random().toString(36).substr(2, 9),
          repoId: repo.id,
          name: jobName,
          sourcePath,
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
      
      onAddJob(newJob);
      resetForm();
      setView('list');
  };

  const resetForm = () => {
      setJobName('');
      setSourcePath('');
      setArchivePrefix('');
      setCompression('zstd');
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

  const handleSelectFolder = async () => {
      const paths = await borgService.selectDirectory();
      if (paths && paths.length > 0) {
          setSourcePath(paths[0]);
      }
  };

  const repoJobs = jobs.filter(j => j.repoId === repo.id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
       <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
           
           {/* HEADER */}
           <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 shrink-0">
               <div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                       <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                       Backup Jobs
                   </h3>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Manage persistent tasks for {repo.name}</p>
               </div>
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
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
                                       </div>
                                       <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono mb-1">
                                           <Folder className="w-3 h-3" /> {job.sourcePath}
                                       </div>
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
                                   <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Source Folder</label>
                                   <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            readOnly
                                            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-300 cursor-not-allowed"
                                            value={sourcePath}
                                            placeholder="Select folder..."
                                        />
                                        <Button variant="secondary" onClick={handleSelectFolder} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Browse</Button>
                                   </div>
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
                       <Button onClick={handleCreate} disabled={!jobName || !sourcePath || !archivePrefix}>Save Job</Button>
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
