import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Archives flow', () => {
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

  test('connect -> refresh archives -> diff -> browse @smoke', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo (populates archives via borg list --json)
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Archives' })).toBeVisible();

    // Refresh (idempotent; re-runs borg list --json)
    const refresh = page.getByTitle('Refresh Archives List');
    if (await refresh.isVisible()) {
      await refresh.click();
    }

    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    // Select two archives (checkboxes are not labelled, so click by row)
    const rowOld = page.locator('tr', { hasText: 'daily-2026-01-02' });
    const rowNew = page.locator('tr', { hasText: 'daily-2026-01-03' });

    await rowOld.locator('input[type="checkbox"]').click();
    await rowNew.locator('input[type="checkbox"]').click();

    await page.getByRole('button', { name: 'Diff' }).click();
    await expect(page.getByText('Diff Report')).toBeVisible();
    await expect(page.getByText('Users/tobia/Documents/new.txt')).toBeVisible();

    // Close diff modal before interacting with the underlying table.
    // Scope to the modal to avoid the app titlebar "Close" window control.
    const diffOverlay = page.locator('div.fixed', { has: page.getByText('Diff Report') }).first();
    await diffOverlay.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Diff Report')).toBeHidden();

    // Browse files (icon-only button; appears on hover)
    await rowNew.hover();
    await rowNew.getByTitle('Browse Files').click({ force: true });

    // Archive browser modal should appear
    await expect(page.getByText(/Browse/i)).toBeVisible();
  });

  test('browse archive -> download selection -> success modal', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo (populates archives via borg list --json)
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Archives' })).toBeVisible();

    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    // Open browser modal
    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });

    await expect(page.getByText('Archive Browser')).toBeVisible();

    // File list is served via borg list --json-lines in the mock.
    await expect(page.getByText('Users', { exact: true })).toBeVisible();
    await page.getByText('Users', { exact: true }).click();
    await expect(page.getByText('tobia', { exact: true })).toBeVisible();
    await page.getByText('tobia', { exact: true }).click();
    await expect(page.getByText('Documents', { exact: true })).toBeVisible();
    await page.getByText('Documents', { exact: true }).click();

    await expect(page.getByText('report.txt', { exact: true })).toBeVisible();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Download Selection', exact: true }).click();

    // Success modal from ArchivesView
    const successOverlay = page.locator('div.fixed', { has: page.getByText('Download Successful') }).first();
    await expect(successOverlay.getByText('Download Successful')).toBeVisible();
    await expect(successOverlay.getByText(/WinBorg Restores/i)).toBeVisible();
    await expect(successOverlay.getByText(/daily-2026-01-03/i)).toBeVisible();

    await successOverlay.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByText('Download Successful')).toBeHidden();
  });

  test('download selection shows Extraction Error when directory creation fails', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      filesystem: { createDirectorySuccess: false },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });
    await expect(page.getByText('Archive Browser')).toBeVisible();

    await page.getByText('Users', { exact: true }).click();
    await page.getByText('tobia', { exact: true }).click();
    await page.getByText('Documents', { exact: true }).click();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Download Selection', exact: true }).click();

    await expect(page.getByText('Extraction Error')).toBeVisible();
    await expect(page.getByText(/Could not ensure local directory/i)).toBeVisible();
    await expect(page.getByText('Download Successful')).toBeHidden();
  });

  test('download selection shows Extraction Failed when borg extract fails', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      borg: { extractSuccess: false, extractError: 'Simulated borg extract failure' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });
    await expect(page.getByText('Archive Browser')).toBeVisible();

    await page.getByText('Users', { exact: true }).click();
    await page.getByText('tobia', { exact: true }).click();
    await page.getByText('Documents', { exact: true }).click();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Download Selection', exact: true }).click();

    await expect(page.getByText('Extraction Failed')).toBeVisible();
    await expect(page.getByText(/Simulated borg extract failure/i)).toBeVisible();
    await expect(page.getByText('Download Successful')).toBeHidden();
  });

  test('restore to folder -> success modal shows selected folder', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      filesystem: { selectDirectoryPaths: ['C:\\Temp\\RestoreHere'] },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });
    await expect(page.getByText('Archive Browser')).toBeVisible();

    await page.getByText('Users', { exact: true }).click();
    await page.getByText('tobia', { exact: true }).click();
    await page.getByText('Documents', { exact: true }).click();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Restore To...', exact: true }).click();

    const successOverlay = page.locator('div.fixed', { has: page.getByText('Download Successful') }).first();
    await expect(successOverlay.getByText('Download Successful')).toBeVisible();
    await expect(successOverlay.getByText('C:\\Temp\\RestoreHere')).toBeVisible();
  });

  test('restore to folder -> cancel picker does nothing', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      filesystem: { selectDirectoryCanceled: true },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });
    await expect(page.getByText('Archive Browser')).toBeVisible();

    await page.getByText('Users', { exact: true }).click();
    await page.getByText('tobia', { exact: true }).click();
    await page.getByText('Documents', { exact: true }).click();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Restore To...', exact: true }).click();

    // Picker canceled => no extraction attempt, no success/failure modal.
    await expect(page.getByText('Download Successful')).toBeHidden();
    await expect(page.getByText('Extraction Error')).toBeHidden();
    await expect(page.getByText('Archive Browser')).toBeVisible();
  });

  test('restore to folder -> extract failure shows Extraction Failed log modal', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      filesystem: { selectDirectoryPaths: ['C:\\Temp\\RestoreHere'] },
      borg: { extractSuccess: false, extractError: 'Simulated borg extract failure' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Browse Files').click({ force: true });
    await expect(page.getByText('Archive Browser')).toBeVisible();

    await page.getByText('Users', { exact: true }).click();
    await page.getByText('tobia', { exact: true }).click();
    await page.getByText('Documents', { exact: true }).click();
    await page.getByText('report.txt', { exact: true }).click();

    await page.getByRole('button', { name: 'Restore To...', exact: true }).click();

    await expect(page.getByText('Extraction Failed')).toBeVisible();
    await expect(page.getByText(/Simulated borg extract failure/i)).toBeVisible();
  });
});
