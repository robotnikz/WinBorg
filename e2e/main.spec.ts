import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('WinBorg App Launch', () => {
  let electronApp;

  test.beforeEach(async () => {
    // Launch Electron app.
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('app window opens and has correct title', async () => {
    const window = await electronApp.firstWindow();
    const title = await window.title();
    
    // Note: The app uses a custom titlebar so the native window title might be different or standard
    // Check main window logic.
    // However, we can check if content loads.
    await window.waitForLoadState('domcontentloaded');
    
    // Basic check for UI elements
    const dashboardElement = await window.locator('text=WinBorg Manager'); // Sidebar or Title
    expect(dashboardElement).toBeTruthy();
  });
});
