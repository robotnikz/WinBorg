// @vitest-environment node


import fs from 'node:fs';
import path from 'node:path';

/**
 * Minimal IPC contract test.
 *
 * Goal: Protect against accidental renames of security-critical IPC channels.
 * This is intentionally simple (string presence checks) so it keeps working
 * even if Electron code is not directly importable in unit tests.
 */

describe('IPC contract (renderer <-> main)', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const electronMainPath = path.join(repoRoot, 'electron-main.js');
  const borgServicePath = path.join(repoRoot, 'src', 'services', 'borgService.ts');
  const settingsViewPath = path.join(repoRoot, 'src', 'views', 'SettingsView.tsx');
  const appVersionPath = path.join(repoRoot, 'src', 'utils', 'appVersion.ts');

  const channels = [
    // Onboarding / system checks & installs
    'system-check-wsl',
    'system-install-wsl',
    'system-install-ubuntu',
    'system-check-borg',
    'system-install-borg',
    'system-fix-wsl-fuse',
    'system-reboot',

    // SSH / remote operations (key selling points)
    'ssh-key-manage',
    'ssh-key-install',
    'ssh-install-borg',
    'ssh-test-connection',
    'ssh-check-borg',

    // Borg command execution
    'borg-spawn',
    'borg-stop',

    // Filesystem helpers (used by archive extraction + job folder picking)
    'get-downloads-path',
    'create-directory',
    'select-directory',

    // Mounting
    'borg-mount',
    'borg-unmount',

    // Secrets
    'save-secret',
    'delete-secret',
    'has-secret',

    // App + settings transfer
    'get-app-version',
    'get-db',
    'save-db',
    'export-app-data',
    'import-app-data',

    // Updates
    'check-for-updates',

    // Notifications
    'get-notification-config',
    'save-notification-config',
    'test-notification',
  ] as const;

  it('electron-main.js registers required ipcMain.handle channels', () => {
    const text = fs.readFileSync(electronMainPath, 'utf8');

    for (const channel of channels) {
      const handlePattern = new RegExp(`ipcMain\\.handle\\(\\s*['\"]${channel}['\"]`, 'm');
      expect(
        handlePattern.test(text),
        `Expected ipcMain.handle("${channel}") to exist in electron-main.js`
      ).toBe(true);
    }
  });

  it('borgService invokes the expected IPC channels', () => {
    const text = fs.readFileSync(borgServicePath, 'utf8');

    // Only channels that should be called from borgService (renderer)
    const rendererChannels: ReadonlyArray<(typeof channels)[number]> = [
      'ssh-key-manage',
      'ssh-key-install',
      'ssh-install-borg',
      'ssh-test-connection',
      'ssh-check-borg',
      'borg-spawn',
      'borg-stop',
      'get-downloads-path',
      'create-directory',
      'select-directory',
      'borg-mount',
      'borg-unmount',
      'system-fix-wsl-fuse',
      'save-secret',
      'delete-secret',
      'has-secret',
    ];

    for (const channel of rendererChannels) {
      const invokePattern = new RegExp(`ipcRenderer\\.invoke\\(\\s*['\"]${channel}['\"]`, 'm');
      expect(
        invokePattern.test(text),
        `Expected borgService to call ipcRenderer.invoke("${channel}")`
      ).toBe(true);
    }
  });

  it('renderer invokes required settings/update channels (drift protection)', () => {
    const settingsText = fs.readFileSync(settingsViewPath, 'utf8');
    const appVersionText = fs.readFileSync(appVersionPath, 'utf8');

    const mustBeReferencedSomewhere: ReadonlyArray<(typeof channels)[number]> = [
      'get-app-version',
      'get-db',
      'save-db',
      'export-app-data',
      'import-app-data',
      'check-for-updates',
      'get-notification-config',
      'save-notification-config',
      'test-notification',
    ];

    const haystacks = [settingsText, appVersionText];

    for (const channel of mustBeReferencedSomewhere) {
      const invokeLike = new RegExp(`\\.invoke\\(\\s*['\"]${channel}['\"]`, 'm');
      const found = haystacks.some((t) => invokeLike.test(t));
      expect(found, `Expected renderer code to reference invoke("${channel}")`).toBe(true);
    }
  });
});
