import React, { useEffect, useState } from 'react';

import { Archive, MountPoint, Repository } from '../types';
import ArchivesView from './ArchivesView';
import MountsView from './MountsView';
import { Archive as ArchiveIcon, HardDrive } from 'lucide-react';

export type RestoreTab = 'archives' | 'mounts';

interface RestoreViewProps {
  tab: RestoreTab;
  onTabChange: (tab: RestoreTab) => void;

  // Archives
  archives: Archive[];
  archivesRepoId?: string | null;
  repos: Repository[];
  onArchiveMount: (repo: Repository, archiveName: string) => void;
  onRefreshArchives: () => void;
  onGetInfo?: (archiveName: string) => Promise<void>;

  // Mounts
  mounts: MountPoint[];
  onUnmount: (id: string) => void;
  onMount: (repoId: string, archiveName: string, path: string) => void;
  preselectedRepoId?: string | null;
}

const RestoreView: React.FC<RestoreViewProps> = ({
  tab,
  onTabChange,
  archives,
  archivesRepoId,
  repos,
  onArchiveMount,
  onRefreshArchives,
  onGetInfo,
  mounts,
  onUnmount,
  onMount,
  preselectedRepoId,
}) => {
  const [localTab, setLocalTab] = useState<RestoreTab>(tab);

  useEffect(() => {
    setLocalTab(tab);
  }, [tab]);

  const setTab = (next: RestoreTab) => {
    setLocalTab(next);
    onTabChange(next);
  };

  return (
    <div className="space-y-4">
      <div
        className="inline-flex items-center gap-1 rounded-xl border border-gray-200/75 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-1 shadow-sm"
        role="tablist"
        aria-label="Restore tabs"
      >
        <button
          type="button"
          onClick={() => setTab('archives')}
          className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 min-w-[140px] justify-center ${
            localTab === 'archives'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
          role="tab"
          aria-selected={localTab === 'archives'}
          aria-label="Archives"
          title="Archives"
        >
          <ArchiveIcon className="w-4 h-4" />
          Archives
        </button>

        <button
          type="button"
          onClick={() => setTab('mounts')}
          className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 min-w-[140px] justify-center ${
            localTab === 'mounts'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
          role="tab"
          aria-selected={localTab === 'mounts'}
          aria-label="Mounts"
          title="Mounts"
        >
          <HardDrive className="w-4 h-4" />
          Mounts
        </button>
      </div>

      {localTab === 'archives' ? (
        <ArchivesView
          archives={archives}
          archivesRepoId={archivesRepoId}
          repos={repos}
          onMount={onArchiveMount}
          onRefresh={onRefreshArchives}
          onGetInfo={onGetInfo}
        />
      ) : (
        <MountsView
          mounts={mounts}
          repos={repos}
          archives={archives}
          archivesRepoId={archivesRepoId}
          onUnmount={onUnmount}
          onMount={onMount}
          preselectedRepoId={preselectedRepoId}
        />
      )}
    </div>
  );
};

export default RestoreView;
