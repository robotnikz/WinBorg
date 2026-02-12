import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Dashboard Jobs deep-link', () => {
  let electronApp: any;
  let page: any;

  const baseDb = {
    repos: [
      {
        id: 'repo-a',
        name: 'Repo A',
        url: 'ssh://user@example.com:22/./repo-a',
        encryption: 'repokey',
        trustHost: true,
        status: 'connected',
        lastBackup: 'Never',
        size: 'Unknown',
        fileCount: 0,
      },
      {
        id: 'repo-b',
        name: 'Repo B',
        url: 'ssh://user@example.com:22/./repo-b',
        encryption: 'repokey',
        trustHost: true,
        status: 'connected',
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
    await page.setViewportSize({ width: 1200, height: 800 });

    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
    });

    await page.reload();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('dashboard repo Jobs button opens Jobs view + correct repo modal', async () => {
    await page.locator('nav').getByRole('button', { name: 'Dashboard', exact: true }).click();

    // Ensure we're on Dashboard (and not just the sidebar Jobs tab).
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    // Scope to main content to avoid matching sidebar navigation buttons.
    // Select the actual Dashboard card container for Repo B (not a parent container that also contains Repo A).
    const repoCard = page
      .locator('main')
      .getByRole('heading', { name: 'Repo B', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await expect(repoCard).toBeVisible();

    // Dashboard only shows the per-repo Jobs button when connected.
    await repoCard.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(repoCard.getByText('Online', { exact: true })).toBeVisible();

    const jobsButton = repoCard.getByRole('button', { name: 'Jobs', exact: true });
    await expect(jobsButton).toBeVisible();
    await jobsButton.click();

    // Should navigate to the Jobs view.
    await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();

    // And open the Jobs modal for the clicked repo.
    await expect(page.getByRole('dialog', { name: 'Jobs for Repo B' })).toBeVisible();
  });
});
