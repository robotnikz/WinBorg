import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Recovery drill flow', () => {
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
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('configure and run a recovery drill successfully', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
    });
    await page.reload();

    const repoCard = page.locator('div', { has: page.getByRole('heading', { name: 'My Repo' }) }).first();

    await repoCard.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(repoCard.getByText('Online')).toBeVisible();

    await repoCard.getByRole('button', { name: 'View Details & History', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'My Repo' })).toBeVisible();
    await expect(page.getByText('Recovery Drill', { exact: true })).toBeVisible();

    await page.getByLabel('Enable recovery drill').check();
    await page.getByLabel('Auto-run recovery drill after backup').check();
    await page.getByLabel('Recovery drill sample paths').fill('Documents/important.docx\nPhotos/family.jpg');
    await page.getByRole('button', { name: 'Save Drill Settings', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Run Recovery Drill', exact: true }).click();

    await expect(page.getByText('Recovery verified (2 paths)', { exact: true })).toBeVisible();
    await expect(page.getByText(/Last archive:\s*daily-2026-01-03/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Last Drill Folder', exact: true })).toBeVisible();
  });

  test('shows recovery drill failure details when extract fails', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      borg: { extractSuccess: false, extractError: 'Simulated recovery drill failure' },
    });
    await page.reload();

    const repoCard = page.locator('div', { has: page.getByRole('heading', { name: 'My Repo' }) }).first();

    await repoCard.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(repoCard.getByText('Online')).toBeVisible();

    await repoCard.getByRole('button', { name: 'View Details & History', exact: true }).click();

    await page.getByLabel('Enable recovery drill').check();
    await page.getByLabel('Recovery drill sample paths').fill('Documents/important.docx');
    await page.getByRole('button', { name: 'Save Drill Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Run Recovery Drill', exact: true }).click();

    await expect(page.getByText('Last recovery drill failed', { exact: true })).toBeVisible();
    await expect(page.getByText(/Simulated recovery drill failure/i)).toBeVisible();
  });
});