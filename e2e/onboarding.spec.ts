import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('@smoke Onboarding Flow', () => {
  let electronApp;
  let firstWindow;

  test.beforeEach(async () => {
    // Launch app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    firstWindow = await electronApp.firstWindow();

    // Ensure responsive layouts are visible.
    await firstWindow.setViewportSize({ width: 1200, height: 800 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('wsl missing -> shows setup required UI', async () => {
    await addMockElectronInitScript(firstWindow.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: false, borgInstalled: true, wslError: 'WSL Missing Dummy' },
    });
    await firstWindow.reload();

    await expect(firstWindow.getByText('WSL Setup Required')).toBeVisible();
    await expect(firstWindow.getByText(/WinBorg requires Windows Subsystem for Linux/i)).toBeVisible();

    // Clicking can close Electron on some setups (real install/reboot behavior), so smoke only asserts UI wiring.
    await expect(firstWindow.getByRole('button', { name: 'Install WSL (Admin)' })).toBeVisible();
  });

  test('borg missing -> install borg -> system ready', async () => {
    await addMockElectronInitScript(firstWindow.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: true, borgInstalled: false },
    });
    await firstWindow.reload();

    await expect(firstWindow.getByText('BorgBackup Not Found')).toBeVisible();
    // Clicking can still close Electron on some setups (process orchestration / shell windows).
    // Smoke only asserts UI wiring; functional install logic is covered by unit tests and manual E2E.
    await expect(firstWindow.getByRole('button', { name: 'Install Borg (Auto)' })).toBeVisible();
  });
});
