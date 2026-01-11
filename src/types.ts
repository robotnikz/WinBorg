
export enum View {
  DASHBOARD = 'DASHBOARD',
  REPOSITORIES = 'REPOSITORIES',
  MOUNTS = 'MOUNTS',
  ARCHIVES = 'ARCHIVES',
  SETTINGS = 'SETTINGS',
  ACTIVITY = 'ACTIVITY',
  REPO_DETAILS = 'REPO_DETAILS'
}

export interface ArchiveStats {
  archiveName: string;
  time: string;
  originalSize: number;
  compressedSize: number;
  deduplicatedSize: number;
}


export interface Repository {
  id: string;
  name: string;
  url: string; // ssh://user@host:port/path
  lastBackup: string;
  encryption: 'repokey' | 'keyfile' | 'none';
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  size: string;
  fileCount: number;
  // Security / Config Persistence
  passphrase?: string;
  trustHost?: boolean;
  
  // Integrity Check State
  checkStatus?: 'idle' | 'running' | 'ok' | 'error' | 'aborted';
  checkProgress?: number; // 0-100
  checkStartTime?: number; // Timestamp in ms
  lastCheckTime?: string;
  
  // Lock State
  isLocked?: boolean;
  
  // To allow aborting
  activeCommandId?: string;
}

export interface BackupJob {
    id: string;
    repoId: string;
    name: string;          
    sourcePath: string;    
    archivePrefix: string; 
    lastRun: string;       
    status: 'idle' | 'running' | 'success' | 'error';
    
    // Advanced Settings
    compression: 'auto' | 'lz4' | 'zstd' | 'zlib' | 'none';
    
    // Retention (Pruning)
    pruneEnabled: boolean;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepYearly: number;

    // Schedule (Metadata for future background service)
    scheduleEnabled: boolean;
    scheduleType: 'daily' | 'hourly' | 'manual';
    scheduleTime: string; // "14:00"
}

export interface Archive {
  id: string;
  name: string;
  time: string;
  size: string;
  duration: string;
}

export interface MountPoint {
  id: string;
  repoId: string;
  archiveName: string;
  localPath: string; // e.g., "Z:\" or "C:\Mounts\Borg"
  status: 'mounted' | 'unmounting' | 'error';
  processId?: number;
}

export interface ActivityLogEntry {
  id: string;
  title: string;
  detail: string;
  time: string; // ISO string
  status: 'success' | 'warning' | 'error' | 'info';
  cmd?: string;
}
