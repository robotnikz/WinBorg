import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Archives flow', () => {
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

  test('connect -> refresh archives -> diff -> browse', async () => {
    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    // Connect repo (populates archives via borg list --json)
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Archives', exact: true }).click();
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
});
