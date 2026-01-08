
import { BackupJob } from '../types';

export const parseSizeString = (sizeStr: string): number => {
  if (!sizeStr || sizeStr === 'Unknown') return 0;
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };
  
  const regex = /(\d+(\.\d+)?)\s*(B|KB|MB|GB|TB)/i;
  const match = sizeStr.match(regex);
  
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();
    return value * (units[unit as keyof typeof units] || 1);
  }
  return 0;
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatDate = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        // Returns format like: "Dec 28, 2025 04:00"
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
};

export const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
};

export const getNextRunForRepo = (jobs: BackupJob[], repoId: string): string | null => {
    const activeJobs = jobs.filter(j => j.repoId === repoId && j.scheduleEnabled);
    if (activeJobs.length === 0) return null;

    let soonest: Date | null = null;
    const now = new Date();

    activeJobs.forEach(job => {
        let nextDate = new Date();
        
        if (job.scheduleType === 'hourly') {
            // Next top of the hour
            nextDate.setHours(now.getHours() + 1, 0, 0, 0);
        } else if (job.scheduleType === 'daily' && job.scheduleTime) {
            const [h, m] = job.scheduleTime.split(':').map(Number);
            nextDate.setHours(h, m, 0, 0);
            if (nextDate <= now) {
                nextDate.setDate(now.getDate() + 1); // Tomorrow
            }
        } else {
            return;
        }

        if (!soonest || nextDate < soonest) {
            soonest = nextDate;
        }
    });

    if (!soonest) return null;

    // Formatting
    const dayDiff = soonest.getDate() - now.getDate();
    const timeStr = soonest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (soonest.toDateString() === now.toDateString()) {
        return `Today ${timeStr}`;
    } else if (dayDiff === 1 || (dayDiff === -30)) { // Simple check for tomorrow (ignoring exact month wrap edge cases for UI simplicity)
        return `Tomorrow ${timeStr}`;
    } else {
        return `${soonest.toLocaleDateString()} ${timeStr}`;
    }
};
