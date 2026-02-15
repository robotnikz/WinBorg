// Shared IPC mock for Playwright Electron E2E.
// Runs in the renderer via `context.addInitScript`.

export type MockRepo = {
  id: string;
  name: string;
  url: string;
  lastBackup: string;
  encryption: 'repokey' | 'keyfile' | 'none';
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  size: string;
  fileCount: number;
  remotePath?: string;
  trustHost?: boolean;
};

export type MockDb = {
  repos?: any[];
  jobs?: any[];
  archives?: any[];
  activityLogs?: any[];
  settings?: Record<string, any>;
};

export type MockOptions = {
  initialDb?: MockDb;
  system?: {
    wslInstalled?: boolean;
    borgInstalled?: boolean;
    // When WSL is enabled but no distro is installed, Onboarding expects a reason.
    wslReason?: 'no-distro' | 'docker-default' | 'no-supported-distro' | string;
    wslError?: string;
    distro?: string;
    borgVersion?: string;
    borgPath?: string;
  };
  ssh?: {
    testConnectionSuccess?: boolean;
    testConnectionError?: string;
    borgInstalled?: boolean;
    borgError?: string;
    borgVersion?: string;
    borgPath?: string;
  };
  filesystem?: {
    createDirectorySuccess?: boolean;
    selectDirectoryCanceled?: boolean;
    selectDirectoryPaths?: string[];
  };
  borg?: {
    createSuccess?: boolean;
    createError?: string;
    extractSuccess?: boolean;
    extractError?: string;
  };
  mounts?: {
    mountSuccess?: boolean;
    mountError?: string;
    unmountSuccess?: boolean;
  };
  notifications?: Record<string, any>;
  updates?: {
    available?: boolean;
  };
};

function randomId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeArchiveListJson(repoUrl: string) {
  // Borg's list --json shape (minimal).
  const now = Date.now();
  const archives = [
    {
      id: 'a1',
      name: 'daily-2026-01-01',
      time: new Date(now - 3 * 86400_000).toISOString(),
    },
    {
      id: 'a2',
      name: 'daily-2026-01-02',
      time: new Date(now - 2 * 86400_000).toISOString(),
    },
    {
      id: 'a3',
      name: 'daily-2026-01-03',
      time: new Date(now - 1 * 86400_000).toISOString(),
    },
  ];
  return JSON.stringify({ repository: { location: repoUrl }, archives });
}

function makeRepoInfoJson() {
  return JSON.stringify({
    repository: {
      stats: {
        total_size: 123 * 1024 * 1024 * 1024,
        unique_csize: 45 * 1024 * 1024 * 1024,
      },
    },
  });
}

function makeArchiveInfoJson(archiveName: string) {
  return JSON.stringify({
    archive: {
      name: archiveName,
      stats: {
        original_size: 10 * 1024 * 1024,
        compressed_size: 4 * 1024 * 1024,
        deduplicated_size: 2 * 1024 * 1024,
      },
    },
  });
}

function makeArchiveLsJsonLines() {
  // borg list --json-lines repo::archive
  const entries = [
    // Use paths without trailing slashes so UI folder names render correctly.
    { path: 'Users', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
    { path: 'Users/tobia', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
    { path: 'Users/tobia/Documents', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
    { path: 'Users/tobia/Documents/report.txt', type: 'f', healthy: true, mode: '-rw-r--r--', user: 'u', group: 'g', uid: 1000, gid: 1000, size: 1337, mtime: '2026-01-03T10:00:00Z' },
  ];
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

export function addMockElectronInitScript(context: any, options: MockOptions = {}) {
  const opts = {
    initialDb: options.initialDb ?? { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
    system: {
      wslInstalled: options.system?.wslInstalled ?? true,
      borgInstalled: options.system?.borgInstalled ?? true,
      wslReason: options.system?.wslReason ?? null,
      wslError: options.system?.wslError ?? null,
      distro: options.system?.distro ?? 'Ubuntu',
      borgVersion: options.system?.borgVersion ?? '1.2.3',
      borgPath: options.system?.borgPath ?? '/usr/bin/borg',
    },
    ssh: {
      testConnectionSuccess: options.ssh?.testConnectionSuccess ?? true,
      testConnectionError: options.ssh?.testConnectionError ?? 'Permission denied (publickey).',
      borgInstalled: options.ssh?.borgInstalled ?? true,
      borgError: options.ssh?.borgError ?? 'borg: command not found',
      borgVersion: options.ssh?.borgVersion ?? '1.2.7',
      borgPath: options.ssh?.borgPath ?? '/usr/bin/borg',
    },
    filesystem: {
      createDirectorySuccess: options.filesystem?.createDirectorySuccess ?? true,
      selectDirectoryCanceled: options.filesystem?.selectDirectoryCanceled ?? false,
      selectDirectoryPaths: options.filesystem?.selectDirectoryPaths ?? ['C:\\Temp'],
    },
    borg: {
      createSuccess: options.borg?.createSuccess ?? true,
      createError: options.borg?.createError ?? 'borg create failed',
      extractSuccess: options.borg?.extractSuccess ?? true,
      extractError: options.borg?.extractError ?? 'borg extract failed',
    },
    mounts: {
      mountSuccess: options.mounts?.mountSuccess ?? true,
      mountError: options.mounts?.mountError ?? 'Mount failed',
      unmountSuccess: options.mounts?.unmountSuccess ?? true,
    },
    notifications: options.notifications ?? {
      notifyOnUpdate: false,
      discordWebhookUrl: '',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpTo: '',
      smtpFrom: '',
      emailEnabled: false,
      discordEnabled: false,
    },
    updates: {
      available: options.updates?.available ?? false,
    },
  };

  return context.addInitScript((initOpts: any) => {
    const listeners = new Map<string, Set<Function>>();

    (window as any).__winborgIpcSends = [];

    const state = {
      db: structuredClone(initOpts.initialDb),
      notifyConfig: structuredClone(initOpts.notifications),
      system: structuredClone(initOpts.system),
      ssh: structuredClone(initOpts.ssh),
      filesystem: structuredClone(initOpts.filesystem),
      borg: structuredClone(initOpts.borg),
      mountBehavior: structuredClone(initOpts.mounts),
      updates: initOpts.updates,
      secrets: new Map<string, string>(),
      mounts: new Map<string, { mountId: string; localPath: string }>(),
    };

    function emit(channel: string, ...args: any[]) {
      const cbs = listeners.get(channel);
      if (!cbs) return;
      for (const cb of Array.from(cbs)) {
        try {
          cb({}, ...args);
        } catch (e) {
          // swallow
        }
      }
    }

    function sendTerminalLog(id: string, text: string) {
      emit('terminal-log', { id, text });
    }

    function ensureRepoDefaults(repo: any) {
      return {
        lastBackup: 'Never',
        encryption: 'repokey',
        status: 'disconnected',
        size: 'Unknown',
        fileCount: 0,
        ...repo,
      };
    }

    async function handleBorgSpawn(payload: any) {
      const { args = [], commandId = randomId('cmd'), forceBinary } = payload ?? {};

      // SSH or helper binaries are routed through borg-spawn with forceBinary.
      if (forceBinary === 'ssh') {
        // Used for connection test + lock checks. Return success.
        return { success: true };
      }
      if (forceBinary === 'powershell' || forceBinary === 'wsl' || forceBinary === 'bash' || forceBinary === 'mkdir' || forceBinary === 'rm') {
        return { success: true };
      }

      // Borg commands (args begin with command or common options).
      const normalized = Array.isArray(args) ? args : [];
      const cmd = normalized[0];

      // Common option --remote-path may shift actual command.
      const effectiveCmd = cmd === '--remote-path' ? normalized[2] : cmd;
      const effectiveArgs = cmd === '--remote-path' ? normalized.slice(2) : normalized;

      if (effectiveCmd === 'list' && effectiveArgs.includes('--json')) {
        const repoUrl = effectiveArgs[effectiveArgs.length - 1];
        sendTerminalLog(commandId, makeArchiveListJson(repoUrl));
        return { success: true };
      }

      if (effectiveCmd === 'list' && effectiveArgs.includes('--json-lines')) {
        sendTerminalLog(commandId, makeArchiveLsJsonLines());
        return { success: true };
      }

      if (effectiveCmd === 'info' && effectiveArgs.includes('--json')) {
        const last = effectiveArgs[effectiveArgs.length - 1];
        // last could be repoUrl OR repoUrl::archive
        if (String(last).includes('::')) {
          const archiveName = String(last).split('::')[1] ?? 'unknown';
          sendTerminalLog(commandId, makeArchiveInfoJson(archiveName));
        } else {
          sendTerminalLog(commandId, makeRepoInfoJson());
        }
        return { success: true };
      }

      if (effectiveCmd === 'diff') {
        sendTerminalLog(commandId, '[diff] + Users/tobia/Documents/new.txt\n');
        sendTerminalLog(commandId, '[diff] - Users/tobia/Documents/old.txt\n');
        return { success: true };
      }

      if (effectiveCmd === 'extract') {
        if (state.borg?.extractSuccess === false) {
          sendTerminalLog(commandId, `Error: ${state.borg?.extractError || 'borg extract failed'}\n`);
          return { success: false, error: state.borg?.extractError || 'borg extract failed' };
        }
        sendTerminalLog(commandId, '[extract] done\n');
        return { success: true };
      }

      if (effectiveCmd === 'create') {
        // backup job create
        if (state.borg?.createSuccess === false) {
          sendTerminalLog(commandId, state.borg?.createError || 'borg create failed');
          return { success: false, error: state.borg?.createError || 'borg create failed' };
        }
        sendTerminalLog(commandId, '10%\n');
        sendTerminalLog(commandId, '50%\n');
        sendTerminalLog(commandId, '100%\n');
        return { success: true };
      }

      if (effectiveCmd === 'check') {
        sendTerminalLog(commandId, '10%\n');
        sendTerminalLog(commandId, '100%\n');
        return { success: true };
      }

      if (effectiveCmd === 'break-lock' || effectiveCmd === 'delete' || effectiveCmd === 'compact' || effectiveCmd === 'prune' || effectiveCmd === 'key') {
        sendTerminalLog(commandId, '[ok]\n');
        return { success: true };
      }

      // Default: succeed silently.
      return { success: true };
    }

    const ipcRenderer = {
      invoke: async (channel: string, payload?: any) => {
        switch (channel) {
          case 'get-db':
            return structuredClone(state.db);
          case 'save-db':
            state.db = { ...(state.db || {}), ...(payload || {}) };
            // ensure defaults for repos when saved
            if (Array.isArray(state.db.repos)) state.db.repos = state.db.repos.map(ensureRepoDefaults);
            return { ok: true };

          case 'system-check-wsl':
            return {
              installed: !!state.system.wslInstalled,
              reason: state.system.wslReason ?? undefined,
              error: state.system.wslError ?? undefined,
              distro: state.system.distro ?? undefined,
            };
          case 'system-check-borg':
            return {
              installed: !!state.system.borgInstalled,
              version: state.system.borgVersion ?? undefined,
              path: state.system.borgPath ?? undefined,
            };
          case 'system-install-wsl':
            // In real life this often requires a reboot; for tests we flip the state so a relaunch can start "post install".
            state.system.wslInstalled = true;
            state.system.wslReason = null;
            state.system.wslError = null;
            return { success: true };
          case 'system-install-ubuntu':
            state.system.wslInstalled = true;
            state.system.wslReason = null;
            state.system.wslError = null;
            return { success: true };
          case 'system-install-borg':
            state.system.borgInstalled = true;
            return { success: true };
          case 'system-fix-wsl-fuse':
            return { success: true };
          case 'system-reboot':
            return { success: true };

          case 'get-app-version':
            return '0.0.0-test';

          case 'get-notification-config':
            return structuredClone(state.notifyConfig);
          case 'save-notification-config':
            state.notifyConfig = { ...(state.notifyConfig || {}), ...(payload || {}) };
            return { ok: true };
          case 'test-notification':
            return { ok: true };

          case 'check-for-updates':
            return { updateAvailable: !!state.updates.available };

          case 'export-app-data':
            return { canceled: false, filePath: 'C:\\Temp\\winborg-export.json' };
          case 'import-app-data':
            // Simulate import then emit event that SettingsView listens for.
            setTimeout(() => emit('app-data-imported'), 50);
            return { ok: true, imported: { repos: 1, jobs: 0, secrets: !!payload?.includeSecrets } };

          // Secrets
          case 'save-secret':
            if (payload?.repoId && payload?.passphrase) state.secrets.set(payload.repoId, payload.passphrase);
            return { ok: true };
          case 'delete-secret':
            if (payload?.repoId) state.secrets.delete(payload.repoId);
            return { ok: true };
          case 'has-secret':
            return { hasSecret: !!(payload?.repoId && state.secrets.has(payload.repoId)) };

          // SSH helpers
          case 'ssh-key-manage':
            if (payload?.action === 'check') return { success: true, exists: true, path: '~/.ssh/id_ed25519' };
            if (payload?.action === 'read') return { success: true, key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockKey winborg@mock' };
            if (payload?.action === 'generate') return { success: true, exists: true };
            return { success: true };
          case 'ssh-test-connection':
            if (state.ssh?.testConnectionSuccess) return { success: true };
            return { success: false, error: state.ssh?.testConnectionError || 'Connection failed' };
          case 'ssh-check-borg':
            if (state.ssh?.borgInstalled) {
              return { success: true, version: state.ssh?.borgVersion || 'unknown', path: state.ssh?.borgPath || 'borg' };
            }
            return { success: false, error: state.ssh?.borgError || 'borg not found' };
          case 'ssh-install-borg':
            state.ssh.borgInstalled = true;
            return { success: true };
          case 'ssh-key-install':
            // After deploying a key, subsequent SSH connectivity checks should pass.
            state.ssh.testConnectionSuccess = true;
            return { success: true };

          // Borg execution
          case 'borg-spawn':
            return handleBorgSpawn(payload);
          case 'borg-stop':
            return { success: true };

          // Mounting
          case 'borg-mount': {
            if (state.mountBehavior?.mountSuccess === false) {
              return { success: false, error: state.mountBehavior?.mountError || 'Mount failed' };
            }
            const mountId = payload?.mountId || randomId('mount');
            state.mounts.set(mountId, { mountId, localPath: payload?.args?.[payload?.args?.length - 1] ?? 'Z:\\WinBorgMount' });
            // borgService.mount listens for id === 'mount'
            setTimeout(() => sendTerminalLog('mount', 'Mounting...\n'), 10);
            setTimeout(() => sendTerminalLog('mount', 'Mounted.\n'), 30);
            return { success: true };
          }
          case 'borg-unmount':
            if (state.mountBehavior?.unmountSuccess === false) return { success: false };
            if (payload?.mountId) state.mounts.delete(payload.mountId);
            return { success: true };

          case 'select-directory':
            return {
              canceled: !!state.filesystem?.selectDirectoryCanceled,
              filePaths: Array.isArray(state.filesystem?.selectDirectoryPaths)
                ? state.filesystem.selectDirectoryPaths
                : ['C:\\Temp'],
            };
          case 'get-preferred-wsl-distro':
            return state.system.distro || 'Ubuntu';
          case 'get-downloads-path':
            // borgService.getDownloadsPath() expects a string.
            return 'C:\\Users\\mock\\Downloads';
          case 'create-directory':
            // borgService.createDirectory() expects a boolean.
            return state.filesystem?.createDirectorySuccess !== false;

          default:
            // Default succeed so unknown calls don't explode the app.
            return { ok: true, success: true };
        }
      },
      on: (channel: string, cb: Function) => {
        const existing = listeners.get(channel) ?? new Set<Function>();
        existing.add(cb);
        listeners.set(channel, existing);
      },
      removeListener: (channel: string, cb: Function) => {
        const set = listeners.get(channel);
        if (!set) return;
        set.delete(cb);
      },
      send: (channel: string, payload?: any) => {
        try {
          (window as any).__winborgIpcSends.push({ channel, payload });
        } catch {
          // ignore
        }
        // Window controls / progress / open-path etc. No-op.
        // We keep this to avoid renderer crashes.
        if (channel === 'download-update') {
          // could emit progress here if needed
        }
        if (channel === 'install-update') {
          // no-op
        }
      },
    };

    const shell = {
      openExternal: async (_url: string) => true,
    };

    // Electron require shim used by renderer.
    (window as any).require = (moduleName: string) => {
      if (moduleName === 'electron') return { ipcRenderer, shell };
      return {};
    };

    // Provide structuredClone polyfill fallback (Playwright is usually modern, but be safe).
    function structuredClone<T>(obj: T): T {
      return obj === undefined ? (obj as any) : JSON.parse(JSON.stringify(obj));
    }

    function randomId(prefix = 'id') {
      return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
    }

    function makeArchiveListJson(repoUrl: string) {
      const now = Date.now();
      const archives = [
        { id: 'a1', name: 'daily-2026-01-01', time: new Date(now - 3 * 86400_000).toISOString() },
        { id: 'a2', name: 'daily-2026-01-02', time: new Date(now - 2 * 86400_000).toISOString() },
        { id: 'a3', name: 'daily-2026-01-03', time: new Date(now - 1 * 86400_000).toISOString() },
      ];
      return JSON.stringify({ repository: { location: repoUrl }, archives });
    }

    function makeRepoInfoJson() {
      return JSON.stringify({
        repository: {
          stats: {
            total_size: 123 * 1024 * 1024 * 1024,
            unique_csize: 45 * 1024 * 1024 * 1024,
          },
        },
      });
    }

    function makeArchiveInfoJson(archiveName: string) {
      return JSON.stringify({
        archive: {
          name: archiveName,
          stats: {
            original_size: 10 * 1024 * 1024,
            compressed_size: 4 * 1024 * 1024,
            deduplicated_size: 2 * 1024 * 1024,
          },
        },
      });
    }

    function makeArchiveLsJsonLines() {
      const entries = [
        { path: 'Users', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
        { path: 'Users/tobia', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
        { path: 'Users/tobia/Documents', type: 'd', healthy: true, mode: 'drwxr-xr-x', user: 'u', group: 'g', uid: 1000, gid: 1000, mtime: '2026-01-03T10:00:00Z' },
        { path: 'Users/tobia/Documents/report.txt', type: 'f', healthy: true, mode: '-rw-r--r--', user: 'u', group: 'g', uid: 1000, gid: 1000, size: 1337, mtime: '2026-01-03T10:00:00Z' },
      ];
      return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    }
  }, opts);
}
