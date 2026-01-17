import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Settings flow', () => {
  let electronApp: any;
  let page: any;

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    page = await electronApp.firstWindow();

    // SettingsView uses a sidebar that is `hidden md:block`; force desktop viewport.
    await page.setViewportSize({ width: 1200, height: 800 });

    await addMockElectronInitScript(page.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: true, borgInstalled: true },
    });

    await page.reload();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('notifications test + export/import settings', async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const settingsSidebar = page.locator('div', { has: page.getByText('Preferences') }).first();

    // Switch to notifications tab inside Settings view
    await settingsSidebar.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('Notify on Updates')).toBeVisible();

    // Enable Discord notifications (ToggleSwitch has an empty label; click by htmlFor)
    await page.locator('label[for="discord-toggle"]').click();
    await page.getByPlaceholder('https://discord.com/api/webhooks/...').fill('https://discord.com/api/webhooks/mock');

    await page.getByRole('button', { name: 'Test Integration' }).click();

    // Backup & Restore section lives under the System tab
    await settingsSidebar.getByRole('button', { name: 'System & Backend' }).click();
    await expect(page.getByText('Backend Environment')).toBeVisible();
    const exportBtn = page.getByRole('button', { name: 'Export Settings' });
    await exportBtn.scrollIntoViewIfNeeded();

    await exportBtn.click();
    await expect(page.getByText(/Exported to:/)).toBeVisible();

    page.once('dialog', (d: any) => d.accept());
    await page.getByRole('button', { name: 'Import Settings' }).click();

    // Import triggers an app reload via app-data-imported event; after reload we should still have a healthy UI
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('WinBorg', { exact: true })).toBeVisible();
  });
});
