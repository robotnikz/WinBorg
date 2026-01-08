import { Repository, Archive, MountPoint } from './types';

export const MOCK_REPOS: Repository[] = [
  {
    id: '1',
    name: 'Hetzner StorageBox (Example)',
    url: 'ssh://user@u12345.your-storagebox.de:23/./backups/main',
    lastBackup: '2 hours ago',
    encryption: 'repokey',
    status: 'connected',
    size: '1.2 TB',
    fileCount: 450023,
    checkStatus: 'ok',
    checkProgress: 100,
    lastCheckTime: 'Yesterday'
  },
  {
    id: '2',
    name: 'Local NAS (Example)',
    url: 'ssh://admin@192.168.1.50/volume1/borg-repo',
    lastBackup: '1 day ago',
    encryption: 'none',
    status: 'disconnected',
    size: '450 GB',
    fileCount: 12000,
    checkStatus: 'idle',
    checkProgress: 0,
    lastCheckTime: 'Never'
  }
];

export const MOCK_ARCHIVES: Archive[] = [
  { id: 'a1', name: 'files-2023-10-27-1400', time: '2023-10-27 14:00', size: '120 GB', duration: '14m' },
  { id: 'a2', name: 'files-2023-10-26-1400', time: '2023-10-26 14:00', size: '119 GB', duration: '12m' },
  { id: 'a3', name: 'system-2023-10-27-0200', time: '2023-10-27 02:00', size: '45 GB', duration: '45m' },
];

export const MOCK_MOUNTS: MountPoint[] = [
  {
    id: 'm1',
    repoId: '1',
    archiveName: 'files-2023-10-27-1400',
    localPath: 'Z:\\',
    status: 'mounted',
    processId: 4521
  }
];