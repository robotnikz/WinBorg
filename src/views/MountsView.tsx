import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, MountPoint, Repository } from '../types';
import Button from '../components/Button';
import { CheckCircle2, ChevronUp, FolderOpen, HardDrive, Info, Loader2, Plus, Terminal, XCircle } from 'lucide-react';
import { getIpcRendererOrNull } from '../services/electron';

interface MountsViewProps {
  mounts: MountPoint[];
  repos: Repository[];
  archives: Archive[];
  archivesRepoId?: string | null;
  onUnmount: (id: string) => void;
  onMount: (repoId: string, archiveName: string, path: string) => void;
  preselectedRepoId?: string | null;
}

const MountsView: React.FC<MountsViewProps> = ({
  mounts,
  repos,
  archives,
  archivesRepoId,
  onUnmount,
  onMount,
  preselectedRepoId,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(repos[0]?.id || '');
  const [selectedArchive, setSelectedArchive] = useState(archives[0]?.name || '');
  const [commandPreview, setCommandPreview] = useState('');
  const lastAppliedPreselectedRepoId = useRef<string | null>(null);

  const repoById = useMemo(() => new Map(repos.map((r) => [r.id, r] as const)), [repos]);

  const [useWsl, setUseWsl] = useState(true);
  const currentRepoStatus = repoById.get(selectedRepo)?.status;
  const canUseArchivesForSelectedRepo =
    currentRepoStatus === 'connected' && String(archivesRepoId || '') === String(selectedRepo || '');
  const availableArchives = canUseArchivesForSelectedRepo ? archives : [];

  useEffect(() => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    setUseWsl(storedWsl === null ? true : storedWsl === 'true');

    if (preselectedRepoId && preselectedRepoId !== lastAppliedPreselectedRepoId.current) {
      setIsCreating(true);
      setSelectedRepo(preselectedRepoId);
      lastAppliedPreselectedRepoId.current = preselectedRepoId;
    } else if (!selectedRepo && repos.length > 0) {
      setSelectedRepo(repos[0].id);
    } else if (!preselectedRepoId && lastAppliedPreselectedRepoId.current) {
      lastAppliedPreselectedRepoId.current = null;
    }

    if (!selectedArchive && availableArchives.length > 0) {
      setSelectedArchive(availableArchives[0].name);
    } else if (availableArchives.length > 0 && !availableArchives.find((a) => a.name === selectedArchive)) {
      setSelectedArchive(availableArchives[0].name);
    } else if (availableArchives.length === 0 && selectedArchive) {
      setSelectedArchive('');
    }
  }, [repos, availableArchives, selectedRepo, selectedArchive, preselectedRepoId]);

  useEffect(() => {
    if (!isCreating) return;
    const repo = repoById.get(selectedRepo);
    if (!repo) return;

    if (!selectedArchive) {
      setCommandPreview('');
      return;
    }

    const archiveNameClean = selectedArchive.replace(/[^a-zA-Z0-9._-]/g, '_');
    const internalPath = `/mnt/wsl/winborg/${archiveNameClean}`;
    const cmd = `borg mount -o allow_other ${repo.url}::${selectedArchive} ${internalPath}`;
    setCommandPreview(cmd);
  }, [isCreating, selectedRepo, selectedArchive, repoById]);

  const handleMount = () => {
    let finalPath = 'Z:';
    if (useWsl) {
      const archiveNameClean = selectedArchive.replace(/[^a-zA-Z0-9._-]/g, '_');
      finalPath = `/mnt/wsl/winborg/${archiveNameClean}`;
    }
    onMount(selectedRepo, selectedArchive, finalPath);
    setIsCreating(false);
  };

  const handleOpenFolder = (path: string) => {
    const ipcRenderer = getIpcRendererOrNull();
    if (!ipcRenderer) {
      alert(`Could not open path: ${path}`);
      return;
    }

    let pathToSend = path;
    if (path.startsWith('/')) {
      const windowsStyle = path.replace(/\//g, '\\');
      // Determine the actual WSL distro name from the backend instead of hardcoding
      ipcRenderer.invoke('get-preferred-wsl-distro').then((distro: string) => {
        const distroName = distro || 'Ubuntu';
        ipcRenderer.send('open-path', `\\\\wsl.localhost\\${distroName}${windowsStyle}`);
      }).catch(() => {
        // Fallback to Ubuntu if we can't determine the distro
        ipcRenderer.send('open-path', `\\\\wsl.localhost\\Ubuntu${windowsStyle}`);
      });
      return;
    }
    ipcRenderer.send('open-path', pathToSend);
  };

  const internalPath = useWsl ? `/mnt/wsl/winborg/${selectedArchive || '...'}` : 'Z:';
  const explorerPathHint = useWsl ? `\\\\wsl.localhost\\Ubuntu${internalPath.replace(/\//g, '\\')}` : internalPath;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><HardDrive className="w-6 h-6 text-blue-400" />Active Mounts</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Access your archives directly in {useWsl ? 'WSL / Windows' : 'File Explorer'}.
          </p>
        </div>
        {(mounts.length > 0 || isCreating) && (
          <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? 'secondary' : 'primary'}>
            {isCreating ? <ChevronUp className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isCreating ? 'Cancel' : 'New mount'}
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-slate-700 pb-3">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Mount Configuration</h3>
            {useWsl && (
              <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2.5 py-1 rounded-full font-medium border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                <Terminal className="w-3 h-3" /> WSL Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Source Repository
              </label>
              <select
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
              >
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex justify-between">
                Target Archive
                {currentRepoStatus === 'connecting' && (
                  <span className="text-blue-500 flex items-center gap-1 normal-case font-normal">
                    <Loader2 className="w-3 h-3 animate-spin" /> Updating...
                  </span>
                )}
              </label>
              <select
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-all font-mono"
                value={selectedArchive}
                onChange={(e) => setSelectedArchive(e.target.value)}
                disabled={currentRepoStatus === 'connecting' || availableArchives.length === 0}
              >
                {availableArchives.length === 0 ? (
                  <option>No archives found (Connect repository first)</option>
                ) : (
                  availableArchives.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.time})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 mb-2 font-semibold">
                <Info className="w-4 h-4 text-blue-500" /> Mount Point Details
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-y-1 gap-x-2 text-xs font-mono">
                <span className="text-slate-500 dark:text-slate-500">WSL Path:</span>
                <span className="text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700">
                  {internalPath}
                </span>
                <span className="text-slate-500 dark:text-slate-500">Explorer URI:</span>
                <span className="text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-800 px-1 rounded border border-slate-200 dark:border-slate-700">
                  {explorerPathHint}
                </span>
              </div>
            </div>

            <div className="flex-1 bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-hidden flex flex-col border border-slate-700">
              <div className="flex items-center gap-2 mb-2 text-slate-500 border-b border-slate-800 pb-1">
                <Terminal className="w-3 h-3" />
                <span>Preview Command</span>
              </div>
              <div className="break-all whitespace-pre-wrap flex-1 text-green-400 opacity-90">
                {commandPreview || '# Select repo and archive...'}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-700">
            <Button
              onClick={handleMount}
              disabled={!selectedArchive || currentRepoStatus !== 'connected' || availableArchives.length === 0}
              className="w-full sm:w-auto"
            >
              {currentRepoStatus === 'connecting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading Repository...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Mount Archive
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {mounts.length === 0 && !isCreating && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 text-center">
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-full mb-4">
              <HardDrive className="w-8 h-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-lg">No active mounts</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs mx-auto">
              Mount an existing archive to browse its contents like a normal folder.
            </p>
            <Button onClick={() => setIsCreating(true)} className="mt-6">
              <Plus className="w-4 h-4 mr-2" />
              New mount
            </Button>
          </div>
        )}

        {mounts.map((mount) => {
          const repo = repoById.get(mount.repoId);
          const isLinuxPath = mount.localPath.startsWith('/');

          return (
            <div
              key={mount.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-center justify-between group gap-4"
            >
              <div className="flex items-center gap-5 w-full sm:w-auto">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex-shrink-0 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                  {isLinuxPath ? (
                    <Terminal className="text-indigo-600 dark:text-indigo-400 w-7 h-7" />
                  ) : (
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-2xl">
                      {mount.localPath.replace(':', '')}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800 dark:text-white truncate text-lg" title={mount.archiveName}>
                    {mount.archiveName}
                  </h4>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 flex-shrink-0" />
                      <span className="font-mono bg-gray-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600">
                        {mount.localPath}
                      </span>
                    </p>
                    {repo && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block"></span>
                        {repo.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-gray-100 dark:border-slate-700">
                <Button
                  variant="secondary"
                  onClick={() => handleOpenFolder(mount.localPath)}
                  className="flex-1 sm:flex-none justify-center dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Open Folder
                </Button>
                <Button variant="danger" onClick={() => onUnmount(mount.id)} className="flex-1 sm:flex-none justify-center">
                  <XCircle className="w-4 h-4 mr-2" />
                  Unmount
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MountsView;
