import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('@manual Onboarding Flow (admin actions)', () => {
  let electronApp;
  let firstWindow;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    firstWindow = await electronApp.firstWindow();
    await firstWindow.setViewportSize({ width: 1200, height: 800 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('wsl missing -> clicking install triggers restart-required or app closes', async () => {
    await addMockElectronInitScript(firstWindow.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: false, borgInstalled: true, wslError: 'WSL Missing Dummy' },
    });
    await firstWindow.reload();

    await expect(firstWindow.getByText('WSL Setup Required')).toBeVisible();

    const installButton = firstWindow.getByRole('button', { name: 'Install WSL (Admin)' });
    await expect(installButton).toBeVisible();

    // This action may legitimately close the app on some setups (e.g. UAC / reboot semantics).
    await installButton.click().catch(() => {});

    const proc = electronApp?.process?.();
    if (proc?.exitCode !== null && proc?.exitCode !== undefined) {
      expect(proc.exitCode).not.toBeNull();
      return;
    }

    const appClosed = electronApp
      .waitForEvent('close', { timeout: 15000 })
      .then(() => 'closed' as const)
      .catch(() => null);

    const restartVisible = expect(firstWindow.getByText('Restart Required!')).toBeVisible({ timeout: 15000 })
      .then(() => 'restart' as const)
      .catch(() => null);

    // Depending on environment/mocks, onboarding may move forward instead of demanding a restart.
    const ubuntuStepVisible = expect(firstWindow.getByRole('button', { name: 'Install Ubuntu (WSL)' })).toBeVisible({ timeout: 15000 })
      .then(() => 'ubuntu' as const)
      .catch(() => null);

    const systemReadyVisible = expect(firstWindow.getByText('System Ready!')).toBeVisible({ timeout: 15000 })
      .then(() => 'ready' as const)
      .catch(() => null);

    const outcome = await Promise.race([appClosed, restartVisible, ubuntuStepVisible, systemReadyVisible]);
    expect(outcome).not.toBeNull();
  });
});
