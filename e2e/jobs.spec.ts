import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Jobs flow', () => {
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

  test('connect repo -> create scheduled job -> job appears in list', async () => {
    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo so action buttons (including Jobs) become available.
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    // Open Jobs modal (icon-only button).
    await page.getByTitle('Manage Backup Jobs & Schedules').click();
    await expect(page.getByText('Backup Jobs')).toBeVisible();

    // Create first job.
    await page.getByRole('button', { name: 'Create First Job' }).click();

    await page.getByPlaceholder('e.g. My Documents').fill('Docs');

    // Add folder via OS picker mock (select-directory returns C:\Temp).
    await page.getByRole('button', { name: /Add Folder/i }).click();
    await expect(page.getByText('C:\\Temp')).toBeVisible();

    await page.getByPlaceholder('e.g. docs').fill('docs');

    // Enable schedule.
    await page.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByText('Enable Schedule')).toBeVisible();
    await page.locator('div', { has: page.getByText('Enable Schedule') }).locator('input[type="checkbox"]').check();

    // Save job.
    await page.getByRole('button', { name: 'Save Job' }).click();

    // Back on list view, job should be visible.
    await expect(page.getByText('Docs')).toBeVisible();
  });
});
