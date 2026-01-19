// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';

describe('E2E mock IPC contract', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const mockPath = path.join(repoRoot, 'e2e', 'helpers', 'mockElectron.ts');

  const channels = [
    // smoke flows rely on these being mockable
    'get-db',
    'save-db',
    'system-check-wsl',
    'system-check-borg',
    'ssh-test-connection',
    'ssh-check-borg',
    'borg-spawn',
    'borg-mount',
    'borg-unmount',
    'select-directory',

    // settings flow
    'get-app-version',
    'get-notification-config',
    'save-notification-config',
    'test-notification',
    'check-for-updates',
    'export-app-data',
    'import-app-data',
  ] as const;

  it('mockElectron.ts implements required IPC channels', () => {
    const text = fs.readFileSync(mockPath, 'utf8');

    for (const channel of channels) {
      const casePattern = new RegExp(`case\\s+['\"]${channel}['\"]\\s*:`, 'm');
      expect(casePattern.test(text), `Expected mockElectron to handle channel: ${channel}`).toBe(true);
    }
  });
});
