// @vitest-environment node

import { describe, it, expect } from 'vitest';
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

  const channels = [
    // Onboarding / system checks & installs
    'system-check-wsl',
    'system-install-wsl',
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

    // Secrets
    'save-secret',
    'delete-secret',
    'has-secret',
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

      // WSL repair helper (called from borgService when mount prerequisites are missing)
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
});
