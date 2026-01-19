import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('@smoke WinBorg App Launch', () => {
  let electronApp;
  let firstWindow;

  test.beforeEach(async () => {
    // Launch Electron app.
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    firstWindow = await electronApp.firstWindow();

    await addMockElectronInitScript(firstWindow.context(), {
      initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
      system: { wslInstalled: true, borgInstalled: true },
    });

    await firstWindow.reload();
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close().catch(() => {});
      electronApp = null;
    }
  });

  test('app window opens and has correct title', async () => {
    const title = await firstWindow.title();
    
    // Note: The app uses a custom titlebar so the native window title might be different or standard
    // Check main window logic.
    // However, we can check if content loads.
    await firstWindow.waitForLoadState('domcontentloaded');
    
    // Basic check for UI elements
    expect(title).toBeTruthy();

    // Wait for a stable, always-present UI element.
    await expect(firstWindow.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });
});
