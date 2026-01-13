import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Repositories flow', () => {
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
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: true, borgInstalled: true },
    });

    await page.reload();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('add repo -> test connection -> connect', async () => {
    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('ssh://user@example.com:22');
    await page.getByPlaceholder(/my-backups/i).fill('/./repo');

    // Required by modal validation unless encryption is set to "none".
    await page
      .locator('label', { hasText: 'Passphrase' })
      .locator('..')
      .locator('input')
      .fill('correct horse battery staple');

    await page.getByRole('button', { name: 'Test SSH & Remote Connection' }).click();
    await expect(page.getByText('Connection successful')).toBeVisible();

    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    // Wait for modal close so there's only one visible "Connect" button.
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeHidden();

    // Repo card shows up
    await expect(page.getByRole('heading', { name: 'My Repo' })).toBeVisible();

    // Connect (or Refresh if the app already auto-connected).
    const repoCard = page.locator('div', { has: page.getByRole('heading', { name: 'My Repo' }) }).first();
    await repoCard.getByRole('button', { name: /^(Connect|Refresh)$/ }).click();

    // Connected status flips to Online (repo card shows Online)
    await expect(repoCard.getByText('Online')).toBeVisible();
  });
});
