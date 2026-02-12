import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Jobs flow', () => {
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

  test('connect repo -> create scheduled job -> job appears in list @smoke', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo so action buttons (including Jobs) become available.
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    // Open Jobs modal (repo has 0 jobs -> CTA is "Create First Job").
    await page.getByRole('button', { name: 'Create First Job', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Jobs for My Repo/i })).toBeVisible();
    // Repo CTA opens modal directly in create view.
    await expect(page.getByRole('button', { name: 'Save Job', exact: true })).toBeVisible();

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

  test('run job now -> shows success toast', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo so action buttons (including Jobs) become available.
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    // Open Jobs modal (repo has 0 jobs -> CTA is "Create First Job").
    await page.getByRole('button', { name: 'Create First Job', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Jobs for My Repo/i })).toBeVisible();

    // Create a job.
    await page.getByPlaceholder('e.g. My Documents').fill('Docs');
    await page.getByRole('button', { name: /Add Folder/i }).click();
    await expect(page.getByText('C:\\Temp')).toBeVisible();
    await page.getByPlaceholder('e.g. docs').fill('docs');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByText('Docs')).toBeVisible();

    // Run job.
    await page.getByTitle('Run Job Now').click();

    // Toast from App.handleRunJob
    await expect(page.getByText(/finished successfully/i)).toBeVisible();
  });

  test('run job now -> borg create failure shows error toast', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      borg: { createSuccess: false, createError: 'Simulated borg create failure' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo so action buttons (including Jobs) become available.
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    // Open Jobs modal (repo has 0 jobs -> CTA is "Create First Job").
    await page.getByRole('button', { name: 'Create First Job', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /Jobs for My Repo/i })).toBeVisible();

    // Create a job.
    await page.getByPlaceholder('e.g. My Documents').fill('Docs');
    await page.getByRole('button', { name: /Add Folder/i }).click();
    await expect(page.getByText('C:\\Temp')).toBeVisible();
    await page.getByPlaceholder('e.g. docs').fill('docs');
    await page.getByRole('button', { name: 'Save Job' }).click();

    await expect(page.getByText('Docs')).toBeVisible();

    // Run job.
    await page.getByTitle('Run Job Now').click();

    // Error toast from App.handleRunJob
    await expect(page.getByText(/failed\. Check activity log/i)).toBeVisible();
    await expect(page.getByText(/finished successfully/i)).toBeHidden();
  });
});
