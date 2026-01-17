import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Mounts flow', () => {
  let electronApp: any;
  let page: any;

  const baseDb = {
    repos: [
      {
        id: 'repo1',
        name: 'My Repo',
        url: 'ssh://user@example.com:22/./repo',
        encryption: 'repokey',
        trustHost: true,
        status: 'disconnected',
        lastBackup: 'Never',
        size: 'Unknown',
        fileCount: 0,
      },
    ],
    jobs: [],
    archives: [],
    activityLogs: [],
    settings: {},
  };

  const baseSystem = { wslInstalled: true, borgInstalled: true };

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    page = await electronApp.firstWindow();

    // Ensure responsive sidebars are visible during tests.
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('mount archive then unmount', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Archives', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });

    // Should land in Mounts view with configuration open
    await expect(page.getByText('Mount Configuration')).toBeVisible();

    // Choose archive (labels are not wired via htmlFor, so locate the select by nearby text)
    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    await archiveSelect.selectOption({ value: 'daily-2026-01-03' });

    await page.getByRole('button', { name: 'Mount Archive' }).click();

    // Mounted card appears
    await expect(page.getByRole('heading', { name: 'daily-2026-01-03' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unmount' })).toBeVisible();

    // Open Folder should translate the WSL path to a Windows UNC path.
    await page.getByRole('button', { name: 'Open Folder' }).click();
    const sends = await page.evaluate(() => (window as any).__winborgIpcSends);
    expect(sends[sends.length - 1]).toEqual({
      channel: 'open-path',
      payload: '\\\\wsl.localhost\\Ubuntu\\mnt\\wsl\\winborg\\daily-2026-01-03',
    });

    await page.getByRole('button', { name: 'Unmount' }).click();

    await expect(page.getByText('No active mounts')).toBeVisible();
  });

  test('mount failure with FUSE_MISSING shows WSL configuration help', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      mounts: { mountSuccess: false, mountError: 'FUSE_MISSING' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Archives', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });

    await expect(page.getByText('Mount Configuration')).toBeVisible();
    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    await archiveSelect.selectOption({ value: 'daily-2026-01-03' });

    await page.getByRole('button', { name: 'Mount Archive' }).click();

    // App reacts to the magic error code by showing FuseSetupModal.
    await expect(page.getByText('WSL Configuration Required')).toBeVisible();
  });
});
