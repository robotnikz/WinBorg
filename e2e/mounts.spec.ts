import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Mounts flow', () => {
  let electronApp: any;
  let page: any;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    page = await electronApp.firstWindow();

    // Ensure responsive sidebars are visible during tests.
    await page.setViewportSize({ width: 1200, height: 800 });

    await addMockElectronInitScript(page.context(), {
      initialDb: {
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
      },
      system: { wslInstalled: true, borgInstalled: true },
    });

    await page.reload();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('mount archive then unmount', async () => {
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

    await page.getByRole('button', { name: 'Unmount' }).click();

    await expect(page.getByText('No active mounts')).toBeVisible();
  });
});
