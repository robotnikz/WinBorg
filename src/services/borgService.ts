

// This service communicates with the Electron Main process

import { formatBytes, formatDuration } from '../utils/formatters';
import { ArchiveStats } from '../types';

// Helper to safely get ipcRenderer without crashing in Browser mode
const getIpcRenderer = () => {
    try {
        if ((window as any).require) {
            const electron = (window as any).require('electron');
            return electron.ipcRenderer;
        }
    } catch (e) {
        console.warn("Electron require failed", e);
    }
    
    // Fallback for Browser/Dev mode (Prevents White Screen crash)
    console.warn("WinBorg: Running in browser/mock mode. Electron features disabled.");
    return {
        invoke: async () => ({ success: false, error: "Running in browser mode (Mock)" }),
        send: () => {},
        on: () => {},
        removeListener: () => {}
    };
};

// Initialize lazily
const ipcRenderer = getIpcRenderer();

const getBorgConfig = () => {
    const storedWsl = localStorage.getItem('winborg_use_wsl');
    const useWsl = storedWsl === null ? true : storedWsl === 'true';

    return {
        useWsl: useWsl,
        path: localStorage.getItem('winborg_executable_path') || 'borg',
        disableHostCheck: localStorage.getItem('winborg_disable_host_check') === 'true'
    };
};

const getEnvVars = (config: any, overrides?: { disableHostCheck?: boolean }) => {
    const finalDisableHostCheck = overrides?.disableHostCheck !== undefined ? overrides.disableHostCheck : config.disableHostCheck;

    const env: any = {
        // BORG_PASSPHRASE is now injected by the MAIN process securely
        BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
        BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
        BORG_DISPLAY_PASSPHRASE: 'no' 
    };
    
    let sshCmd = 'ssh -o BatchMode=yes';
    if (finalDisableHostCheck) {
        sshCmd += ' -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null';
    }
    env.BORG_RSH = sshCmd;
    
    if (config.useWsl) {
        env.WSLENV = 'BORG_PASSPHRASE:BORG_DISPLAY_PASSPHRASE:BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK:BORG_RELOCATED_REPO_ACCESS_IS_OK:BORG_RSH';
    }
    
    return env;
};

// Helper to extract JSON from mixed output (stdout + stderr)
const extractJson = (text: string) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start > -1 && end > start) {
        return text.substring(start, end + 1);
    }
    return null;
};

// Helper to parse URL
const parseBorgUrl = (url: string) => {
    const sshRegex = /^ssh:\/\/(?:([^@]+)@)?([^:/]+)(?::(\d+))?(.*)$/;
    const sshMatch = url.match(sshRegex);
    
    if (sshMatch) {
        return {
            isSsh: true,
            user: sshMatch[1], 
            host: sshMatch[2],
            port: sshMatch[3] || '22',
            path: sshMatch[4] 
        };
    }
    
    const scpMatch = url.match(/^([^@]+)@([^:]+):(.*)$/);
    if (scpMatch) {
        return {
            isSsh: true,
            user: scpMatch[1],
            host: scpMatch[2],
            port: '22',
            path: scpMatch[3]
        };
    }
    return { isSsh: false, path: url };
};

export interface FileEntry {
    type: 'd' | 'f' | '-';
    mode: string;
    user: string;
    group: string;
    uid: number;
    gid: number;
    path: string;
    healthy: boolean;
    size?: number;
    mtime?: string;
}

export const borgService = {

  // --- SSH KEY MANAGEMENT ---
  manageSSHKey: async (action: 'check' | 'generate' | 'read', type: 'ed25519' | 'rsa' = 'ed25519'): Promise<{success: boolean, exists?: boolean, key?: string, path?: string, error?: string}> => {
      return ipcRenderer.invoke('ssh-key-manage', { action, type });
  },

  installSSHKey: async (target: string, password: string, port?: string): Promise<{success: boolean, error?: string}> => {
      return ipcRenderer.invoke('ssh-key-install', { target, password, port });
  },

  installBorg: async (target: string, password: string, port?: string): Promise<{success: boolean, error?: string, details?: string}> => {
      return ipcRenderer.invoke('ssh-install-borg', { target, password, port });
  },
  
  // --- SECRETS MANAGEMENT ---
  savePassphrase: async (repoId: string, passphrase: string) => {
      return await ipcRenderer.invoke('save-secret', { repoId, passphrase });
  },

  deletePassphrase: async (repoId: string) => {
      return await ipcRenderer.invoke('delete-secret', { repoId });
  },

  hasPassphrase: async (repoId: string): Promise<boolean> => {
      const res = await ipcRenderer.invoke('has-secret', { repoId });
      return res.hasSecret;
  },

  // --- COMMANDS ---

  /**
   * Run a one-off borg command
   * Pass repoId in overrides to inject the secure password from backend
   */
  runCommand: async (
    args: string[], 
    onLog: (text: string) => void,
    overrides?: { repoId?: string, disableHostCheck?: boolean, commandId?: string, forceBinary?: string, cwd?: string, env?: Record<string, string> }
  ): Promise<boolean> => {
    const commandId = overrides?.commandId || Math.random().toString(36).substring(7);
    const config = getBorgConfig();

    // Prepare Environment Variables
    let baseEnv = getEnvVars(config, overrides);
    const customEnv = overrides?.env || {};
    const finalEnv = { ...baseEnv, ...customEnv };

    // If using WSL, we must add custom keys to WSLENV so they are passed to the Linux instance
    if (config.useWsl && Object.keys(customEnv).length > 0) {
        const extraKeys = Object.keys(customEnv).join(':');
        if (finalEnv.WSLENV) {
            finalEnv.WSLENV = `${finalEnv.WSLENV}:${extraKeys}`;
        } else {
            finalEnv.WSLENV = extraKeys;
        }
    }

    const logListener = (_: any, msg: { id: string, text: string }) => {
      if (msg.id === commandId) onLog(msg.text);
    };

    ipcRenderer.on('terminal-log', logListener);

    try {
      const result = await ipcRenderer.invoke('borg-spawn', { 
          args, 
          commandId, 
          useWsl: config.useWsl,
          executablePath: config.path,
          envVars: finalEnv,
          forceBinary: overrides?.forceBinary,
          repoId: overrides?.repoId, // SECURE INJECTION TRIGGER
          cwd: overrides?.cwd
      });
      return result.success;
    } finally {
      ipcRenderer.removeListener('terminal-log', logListener);
    }
  },

  initRepo: async (
      repoUrl: string, 
      encryption: 'repokey' | 'keyfile' | 'none', 
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      // Argument Mapping: repokey -> repokey-blake2 (modern default), keyfile -> keyfile-blake2
      let encMode: string = encryption;
      if (encryption === 'repokey') encMode = 'repokey-blake2';
      if (encryption === 'keyfile') encMode = 'keyfile-blake2';

      const args = ['init', '--encryption', encMode, repoUrl];
      return await borgService.runCommand(args, onLog, overrides);
  },

  testConnection: async (repoUrl: string, onLog: (text: string) => void, overrides?: { disableHostCheck?: boolean }) => {
      onLog("Testing connection (Borg Version Check)...\n");
      const args = ['--version'];
      
      const parsed = parseBorgUrl(repoUrl);
      if (parsed.isSsh) {
          const userHost = `${parsed.user ? parsed.user + '@' : ''}${parsed.host}`;
          onLog(`Dialing ${userHost} on port ${parsed.port}...\n`);
          // Just try to execute 'borg --version' via SSH
          const sshArgs = [
               '-p', parsed.port,
               ...(overrides?.disableHostCheck ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'] : []),
               '-o', 'BatchMode=yes',
               userHost,
               'borg --version'
          ];
          return await borgService.runCommand(sshArgs, onLog, { forceBinary: 'ssh' });
      } else {
          // Local path check
          onLog(`Checking local path: ${parsed.path}`);
          return true; // Trivial for local
      }
  },

  deleteArchive: async (repoUrl: string, archiveName: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      const args = ['delete', '--progress', '--stats', `${repoUrl}::${archiveName}`];
      return await borgService.runCommand(args, onLog, overrides);
  },

  /**
   * Deletes all archives in the repo, but keeps the repo structure/keys.
   * Equivalent to: borg delete -a '*' repo
   */
  emptyRepo: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      // --force to avoid interactive confirmation
      const args = ['delete', '--force', '--progress', '--stats', '-a', '*', repoUrl];
      return await borgService.runCommand(args, onLog, overrides);
  },

  /**
   * Deletes the entire repository structure.
   * Equivalent to: borg delete repo
   * REQUIRES SPECIAL ENV VAR to avoid interactive prompt
   */
  destroyRepo: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      const args = ['delete', repoUrl];
      // FIX: BORG_DELETE_I_KNOW_WHAT_I_AM_DOING must be 'YES' (uppercase) for some Borg versions
      return await borgService.runCommand(args, onLog, { 
          ...overrides, 
          env: { 'BORG_DELETE_I_KNOW_WHAT_I_AM_DOING': 'YES' } 
      });
  },

  compact: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      return await borgService.runCommand(['compact', '-v', repoUrl], onLog, overrides);
  },

  prune: async (
      repoUrl: string,
      rules: { daily?: number, weekly?: number, monthly?: number, yearly?: number, keepWithin?: string },
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      const args = ['prune', '-v', '--list', repoUrl];
      if (rules.keepWithin) args.push('--keep-within', rules.keepWithin);
      if (rules.daily) args.push('--keep-daily', rules.daily.toString());
      if (rules.weekly) args.push('--keep-weekly', rules.weekly.toString());
      if (rules.monthly) args.push('--keep-monthly', rules.monthly.toString());
      if (rules.yearly) args.push('--keep-yearly', rules.yearly.toString());
      return await borgService.runCommand(args, onLog, overrides);
  },

  diffArchives: async (repoUrl: string, archive1: string, archive2: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      const args = ['diff', `${repoUrl}::${archive1}`, `${archive2}`];
      return await borgService.runCommand(args, onLog, overrides);
  },

  exportKey: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      // export to stdout
      return await borgService.runCommand(['key', 'export', repoUrl], onLog, overrides);
  },

  ensureFuseConfig: async (onLog: (text: string) => void): Promise<boolean> => {
      const config = getBorgConfig();
      if (!config.useWsl) return true;

      onLog("[Auto-Setup] Checking FUSE permissions in WSL...");
      const fixCmd = `
        touch /etc/fuse.conf && 
        sed -i 's/^#\\s*user_allow_other/user_allow_other/' /etc/fuse.conf &&
        if ! grep -q "^user_allow_other" /etc/fuse.conf; then 
            echo "user_allow_other" >> /etc/fuse.conf; 
        fi && 
        chmod 666 /dev/fuse &&
        echo "FUSE permissions verified."
      `;
      const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'fuse-setup') onLog(`[Setup] ${msg.text}`);
      };
      ipcRenderer.on('terminal-log', logListener);

      try {
        return await ipcRenderer.invoke('borg-spawn', { 
            commandId: 'fuse-setup', 
            useWsl: true,
            envVars: {},
            forceBinary: 'bash',
            wslUser: 'root', 
            args: ['-c', fixCmd]
        }).then((res: any) => res.success);
      } catch (e: any) {
          onLog(`[Setup Error] ${e.message}`);
          return false;
      } finally {
          ipcRenderer.removeListener('terminal-log', logListener);
      }
  },

  checkLockStatus: async (repoUrl: string, overrides?: { disableHostCheck?: boolean }) => {
      const parsed = parseBorgUrl(repoUrl);
      if (!parsed) return false;
      
      const config = getBorgConfig();
      const basePath = parsed.path?.replace(/\/$/, '') || '';
      const lockFile = `${basePath}/lock.roster`;
      const testCmd = `test -e "${lockFile}"`;
      
      let success = false;
      const noOpLog = () => {};

      if (parsed.isSsh) {
           const userHost = `${parsed.user ? parsed.user + '@' : ''}${parsed.host}`;
           const args = [
              '-p', parsed.port!,
              ...(overrides?.disableHostCheck || config.disableHostCheck ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'] : []),
              '-o', 'BatchMode=yes',
              userHost,
              testCmd
           ];
           success = await borgService.runCommand(args, noOpLog, { forceBinary: 'ssh', commandId: `lock-check-${Date.now()}` });
      } else {
           if (config.useWsl) {
               success = await borgService.runCommand([testCmd], noOpLog, { forceBinary: 'wsl', commandId: `lock-check-${Date.now()}` });
           } else {
               const psCmd = `Test-Path "${lockFile}"`;
               success = await borgService.runCommand(['-Command', psCmd], noOpLog, { forceBinary: 'powershell', commandId: `lock-check-${Date.now()}` });
           }
      }
      return success;
  },

  breakLock: async (repoUrl: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      return await borgService.runCommand(['break-lock', repoUrl], onLog, overrides);
  },
  
  forceDeleteLockFiles: async (repoUrl: string, onLog: (text: string) => void, overrides?: { disableHostCheck?: boolean }) => {
      const parsed = parseBorgUrl(repoUrl);
      if (!parsed) return false;
      const config = getBorgConfig();

      if (parsed.isSsh) {
          const userHost = `${parsed.user ? parsed.user + '@' : ''}${parsed.host}`;
          if (!parsed.host) return false;
          const basePath = parsed.path!;
          const removeCmd = `rm -rf "${basePath}/lock.roster" "${basePath}/lock.exclusive"`;
          
          onLog(`Connecting to ${userHost} (Port ${parsed.port}) via SSH...`);
          const args = [
              '-p', parsed.port!,
              ...(overrides?.disableHostCheck || config.disableHostCheck ? ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null'] : []),
              '-o', 'BatchMode=yes',
              userHost,
              removeCmd
          ];
          return await borgService.runCommand(args, onLog, { ...overrides, forceBinary: 'ssh' });
      } else {
          const basePath = parsed.path!;
          const rosterPath = `${basePath}/lock.roster`;
          const exclusivePath = `${basePath}/lock.exclusive`;
          onLog(`Deleting local lock files in: ${basePath}`);
          
          if (config.useWsl) {
               return await borgService.runCommand(['-rf', rosterPath, exclusivePath], onLog, { ...overrides, forceBinary: 'rm' });
          } else {
              onLog("Manual local deletion on Native Windows not fully supported via UI.");
              return false;
          }
      }
  },

  /**
   * Returns generic list of archives (fast)
   */
  listArchives: async (repoUrl: string, overrides?: { repoId?: string, disableHostCheck?: boolean }): Promise<{id: string, name: string, time: string}[]> => {
    let listOutput = "";
    const success = await borgService.runCommand(
        ['list', '--json', repoUrl],
        (chunk) => listOutput += chunk,
        overrides
    );
    if (!success) return [];
    try {
        const json = extractJson(listOutput);
        const data = JSON.parse(json);
        return (data.archives || []).map((a: any) => ({
             id: a.id || a.name,
             name: a.name,
             time: a.time
        }));
    } catch(e) { return []; }
  },

  getArchiveInfo: async (repoUrl: string, archiveName: string, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
      let outputBuffer = "";
      const success = await borgService.runCommand(
          ['info', '--json', `${repoUrl}::${archiveName}`],
          (log) => { outputBuffer += log; },
          overrides
      );

      if (success) {
          const jsonStr = extractJson(outputBuffer);
          if (jsonStr) {
              try {
                  const data = JSON.parse(jsonStr);
                  const stats = data.archives?.[0]?.stats || data.archive?.stats;
                  const duration = data.archives?.[0]?.duration || data.archive?.duration || 0;
                  if (stats) {
                      return {
                          size: formatBytes(stats.deduplicated_size || stats.compressed_size),
                          duration: formatDuration(duration),
                          originalSize: stats.original_size,
                          compressedSize: stats.compressed_size,
                          deduplicatedSize: stats.deduplicated_size
                      };
                  }
              } catch (e) {
                  console.error("Failed to parse archive info", e);
              }
          }
      }
      return null;
  },

  // --- RESTORE / EXTRACT ---

  getDownloadsPath: async (): Promise<string> => {
      return await ipcRenderer.invoke('get-downloads-path');
  },
  
  createDirectory: async (path: string): Promise<boolean> => {
      return await ipcRenderer.invoke('create-directory', path);
  },

  getArchiveHistory: async (repoUrl: string, options?: { repoId?: string, disableHostCheck?: boolean }): Promise<ArchiveStats[]> => {
    let listOutput = "";
    const success = await borgService.runCommand(
        ['list', '--json', repoUrl],
        (chunk) => listOutput += chunk,
        { repoId: options?.repoId, disableHostCheck: options?.disableHostCheck }
    );
    
    if (!success) return [];

    try {
        const start = listOutput.indexOf('{');
        const end = listOutput.lastIndexOf('}');
        if (start === -1 || end === -1) return [];
        const cleanJson = listOutput.substring(start, end + 1);
        
        const listJson = JSON.parse(cleanJson);
        const archives = listJson.archives || [];
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recent = archives.filter((a: any) => new Date(a.time) >= thirtyDaysAgo);
        
        // Sort by time ascending
        recent.sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

        const history: ArchiveStats[] = [];
        
        for (const arch of recent) {
            let infoOutput = "";
             await borgService.runCommand(
                ['info', '--json', `${repoUrl}::${arch.name}`],
                (c) => infoOutput += c,
                { repoId: options?.repoId, disableHostCheck: options?.disableHostCheck }
            );
            try {
                const iStart = infoOutput.indexOf('{');
                const iEnd = infoOutput.lastIndexOf('}');
                if (iStart > -1 && iEnd > iStart) {
                    const infoJson = infoOutput.substring(iStart, iEnd + 1);
                    const info = JSON.parse(infoJson);
                    const stats = info.archives?.[0]?.stats || info.archive?.stats;
                    if (stats) {
                        history.push({
                            archiveName: arch.name,
                            time: arch.time,
                            originalSize: stats.original_size,
                            compressedSize: stats.compressed_size,
                            deduplicatedSize: stats.deduplicated_size
                        });
                    }
                }
            } catch(e) {}
        }
        
        return history;
        
    } catch (e) {
        console.error("Failed to fetch history", e);
        return [];
    }
  },

  listArchiveFiles: async (repoUrl: string, archiveName: string, overrides?: { repoId?: string, disableHostCheck?: boolean }): Promise<FileEntry[]> => {
      const entries: FileEntry[] = [];
      let buffer = "";
      
      // We use --json-lines to stream output
      const success = await borgService.runCommand(
          ['list', '--json-lines', `${repoUrl}::${archiveName}`],
          (chunk) => {
              buffer += chunk;
              // Split by newline and try to parse complete JSON objects
              const lines = buffer.split('\n');
              // Keep the last partial line in buffer
              buffer = lines.pop() || ""; 
              
              for (const line of lines) {
                  if (line.trim()) {
                      try {
                          const entry = JSON.parse(line);
                          if(entry.path) entries.push(entry);
                      } catch (e) { /* ignore partials */ }
                  }
              }
          },
          overrides
      );
      
      return success ? entries : [];
  },

  extractFiles: async (
      repoUrl: string, 
      archiveName: string, 
      paths: string[], // Paths INSIDE the archive
      destinationPath: string, // Local path (Windows format usually)
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      // borg extract repo::archive path/to/file
      const args = ['extract', '--progress', `${repoUrl}::${archiveName}`, ...paths];
      
      // The destinationPath will be handled by the main process (cwd)
      return await borgService.runCommand(args, onLog, {
          ...overrides,
          cwd: destinationPath
      });
  },

  openPath: (path: string) => {
      ipcRenderer.send('open-path', path);
  },

  // --- MOUNTING ---

  stopCommand: async (commandId: string): Promise<boolean> => {
      const result = await ipcRenderer.invoke('borg-stop', { commandId });
      return result.success;
  },

  mount: async (repoUrl: string, archiveName: string, mountPoint: string, onLog: (text: string) => void, overrides?: { repoId?: string, disableHostCheck?: boolean }) => {
    const mountId = `mount-${Date.now()}`;
    const config = getBorgConfig();
    const logListener = (_: any, msg: { id: string, text: string }) => {
        if (msg.id === 'mount') onLog(msg.text);
    };
    ipcRenderer.on('terminal-log', logListener);

    try {
        if (config.useWsl) {
            await borgService.ensureFuseConfig(onLog);
            
            // FIX: Ensure the mountpoint directory exists in WSL before mounting
            onLog(`[Setup] Creating mount point: ${mountPoint}`);
            await ipcRenderer.invoke('borg-spawn', { 
                commandId: `mkdir-${mountId}`,
                useWsl: true,
                forceBinary: 'mkdir',
                args: ['-p', mountPoint]
            });
        }
        
        const args = ['mount', '--foreground', '-o', 'allow_other', `${repoUrl}::${archiveName}`, mountPoint];
        const result = await ipcRenderer.invoke('borg-mount', { 
            args, 
            mountId, 
            useWsl: config.useWsl,
            executablePath: config.path,
            envVars: getEnvVars(config, overrides),
            repoId: overrides?.repoId
        });
        
        return { success: result.success, mountId: result.success ? mountId : undefined, error: result.error };
    } finally {
        ipcRenderer.removeListener('terminal-log', logListener);
    }
  },

  unmount: async (mountId: string, localPath: string) => {
    const config = getBorgConfig();
    return await ipcRenderer.invoke('borg-unmount', { 
        mountId, 
        localPath, 
        useWsl: config.useWsl,
        executablePath: config.path 
    });
  },

  selectDirectory: async (): Promise<string[] | null> => {
      try {
        const result = await ipcRenderer.invoke('select-directory');
        return !result.canceled ? result.filePaths : null;
      } catch (e) {
          console.error("Failed to select directory", e);
          return null;
      }
  },

  createArchive: async (
      repoUrl: string, 
      archiveName: string, 
      sourcePaths: string[], 
      onLog: (text: string) => void,
      overrides?: { repoId?: string, disableHostCheck?: boolean }
  ): Promise<boolean> => {
      const config = getBorgConfig();
      
      // Convert paths for WSL if needed
      let paths = sourcePaths;
      if (config.useWsl) {
          paths = sourcePaths.map(p => {
              // Convert C:\Path to /mnt/c/Path
              if (/^[a-zA-Z]:[\\/]/.test(p)) {
                  const drive = p.charAt(0).toLowerCase();
                  const rest = p.slice(3).replace(/\\/g, '/');
                  return `/mnt/${drive}/${rest}`;
              }
              return p.replace(/\\/g, '/');
          });
      }

      // Create command: borg create --progress --stats REPO::ARCHIVE PATHS...
      const args = ['create', '--progress', '--stats', `${repoUrl}::${archiveName}`, ...paths];
      
      return await borgService.runCommand(args, onLog, overrides);
  },

  notify: (title: string, body: string) => {
      if (!('Notification' in window)) return;
      
      if (Notification.permission === 'granted') {
          new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                  new Notification(title, { body });
              }
          });
      }
  }
};
