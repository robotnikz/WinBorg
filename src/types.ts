
export enum View {
  DASHBOARD = 'DASHBOARD',
  REPOSITORIES = 'REPOSITORIES',
  JOBS = 'JOBS',
  MOUNTS = 'MOUNTS',
  ARCHIVES = 'ARCHIVES',
  CONNECTIONS = 'CONNECTIONS',
  SETTINGS = 'SETTINGS',
  ACTIVITY = 'ACTIVITY',
  REPO_DETAILS = 'REPO_DETAILS'
}

export interface SshConnection {
  id: string;
  name: string;
  serverUrl: string; // e.g. ssh://user@host:22
  createdAt?: string;
  updatedAt?: string;
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
  connectionId?: string; // Optional reference to a stored SSH connection
  lastBackup: string;
  encryption: 'repokey' | 'keyfile' | 'none';
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  size: string;
  fileCount: number;
  remotePath?: string; // Custom path to borg executable on remote
  // Security / Config Persistence
  passphrase?: string;
  trustHost?: boolean;
  
  // Integrity Check State
  checkStatus?: 'idle' | 'running' | 'ok' | 'error' | 'aborted';
  checkProgress?: number; // 0-100
  checkStartTime?: number; // Timestamp in ms
  lastCheckTime?: string;
  
  // Stats
  stats?: {
    originalSize: number; // Bytes
    deduplicatedSize: number; // Bytes (Actual size on disk)
  };

  // Lock State
  isLocked?: boolean;
  
  // To allow aborting
  activeCommandId?: string;

  // Backup Run State (One-off or Job)
  backupStatus?: 'idle' | 'running' | 'success' | 'error' | 'aborted';
  backupStartTime?: number; // Timestamp in ms
  backupEstimatedDurationMs?: number; // Used for ETA/progress bar (heuristic)
  activeBackupCommandId?: string; // For cancelling a running backup
  activeBackupJobId?: string; // If the running backup was triggered by a job
}

export interface BackupJob {
    id: string;
    repoId: string;
    name: string;          
  // Legacy single-path field (kept for backwards compatibility)
  sourcePath: string;
  // Preferred multi-source field
  sourcePaths?: string[];
  excludePatterns?: string[];
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
