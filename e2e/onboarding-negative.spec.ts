import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Onboarding negative flows', () => {
  let electronApp: any;
  let page: any;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('shows Ubuntu install when WSL enabled but no distro', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: false, wslReason: 'no-distro', borgInstalled: true },
    });

    await page.reload();

    await expect(page.getByText('WSL Setup Required')).toBeVisible();
    await expect(page.getByText(/Ubuntu\/Debian is not installed yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install Ubuntu (WSL)' })).toBeVisible();
  });

  test('can install Ubuntu (WSL) and reach System Ready', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: false, wslReason: 'no-distro', borgInstalled: true },
    });

    await page.reload();

    await expect(page.getByText('WSL Setup Required')).toBeVisible();
    await page.getByRole('button', { name: 'Install Ubuntu (WSL)' }).click();

    await expect(page.getByText('System Ready!')).toBeVisible();
  });

  test('shows Borg install when Borg is missing', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: true, borgInstalled: false },
    });

    await page.reload();

    await expect(page.getByText('BorgBackup Not Found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install Borg (Auto)' })).toBeVisible();
  });
});
