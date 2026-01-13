import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('@smoke Onboarding Flow', () => {
  let electronApp;
  let firstWindow;

  test.beforeEach(async () => {
    // Launch app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    firstWindow = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('full onboarding walkthrough: wsl missing -> restart -> borg missing -> success', async () => {
    // --- STEP 1: INJECT MOCKS PERSISTENTLY ---
    // We use addInitScript so the mock survives the reload() and applies before App.tsx mounts
    await firstWindow.context().addInitScript(() => {
        // Clear state on first run of the session
        if (!sessionStorage.getItem('test-initialized')) {
            console.log('[INIT] First run detected, clearing state.');
            localStorage.removeItem('mock-backend-state');
            sessionStorage.setItem('test-initialized', 'true');
        }

        // Load state from localStorage to persist across reloads
        const stored = localStorage.getItem('mock-backend-state');
        console.log('[INIT] Stored state:', stored);
        const state = stored ? JSON.parse(stored) : {
            wslInstalled: false,
            borgInstalled: false
        };
        (window as any).mockState = state;
        
        const saveState = () => localStorage.setItem('mock-backend-state', JSON.stringify((window as any).mockState));

        // Mock window.require
        (window as any).require = (module: string) => {
            if (module === 'electron') {
                return {
                    ipcRenderer: {
                        invoke: async (channel: string, ...args: any[]) => {
                            const currentState = (window as any).mockState;

                            if (channel === 'get-db') return { repos: [], settings: {} };
                            
                            if (channel === 'system-check-wsl') {
                                console.log('[MOCK] Checking WSL:', currentState.wslInstalled);
                                return { installed: currentState.wslInstalled, error: currentState.wslInstalled ? null : 'WSL Missing Dummy' };
                            }
                            if (channel === 'system-check-borg') {
                                console.log('[MOCK] Checking Borg:', currentState.borgInstalled);
                                return { installed: currentState.borgInstalled };
                            }
                            if (channel === 'system-install-wsl') {
                                // Simulate that WSL is "staged" for install. The real install requires reboot.
                                // We update state so that AFTER reboot (reload) it appears installed.
                                currentState.wslInstalled = true;
                                saveState();
                                return { success: true };
                            }
                            if (channel === 'system-install-borg') {
                                await new Promise(r => setTimeout(r, 2000)); // Delay to verify loading state
                                currentState.borgInstalled = true; // Update state for next check
                                saveState();
                                return { success: true };
                            }
                            if (channel === 'system-reboot') {
                                return true;
                            }
                            // Return dummy for others to prevent crashes
                            return {}; 
                        },
                        on: () => {},
                        send: () => {},
                        removeListener: () => {},
                        removeAllListeners: () => {}
                    }
                };
            }
            throw new Error('Unknown module: ' + module);
        };
    });

    // Reload page to apply init script
    await firstWindow.reload();

    // 1. Verify "WSL Not Found" screen
    await expect(firstWindow.locator('text=WSL Not Found')).toBeVisible();
    await expect(firstWindow.locator('text=WinBorg requires Windows Subsystem for Linux')).toBeVisible();

    // 2. Click "Install WSL"
    await firstWindow.click('text=Install WSL (Admin)');

    // 3. Verify transition to "Restart Required"
    await expect(firstWindow.locator('text=Restart Required!')).toBeVisible({ timeout: 10000 });
    
    // 4. Click "Restart Computer Now"
    // Use regex for case/whitespace insensitivity
    const restartBtn = firstWindow.locator('button', { hasText: /restart computer/i });
    await expect(restartBtn).toBeVisible({ timeout: 5000 });
    await restartBtn.click();

    // --- CRITICAL: SIMULATE REBOOT ---
    // Since we mocked `system-reboot`, the app won't actually close.
    // We must manually reload the page to simulate the user opening the app again after reboot.
    // The `state.wslInstalled` was set to true in the `system-install-wsl` handler above (persisted in window.mockState).
    await firstWindow.reload();

    // 5. Verify "BorgBackup Not Found" screen (Skipped WSL check successfully)
    await expect(firstWindow.locator('text=BorgBackup Not Found')).toBeVisible();

    // 6. Click "Install Borg"
    await firstWindow.click('text=Install Borg (Auto)');

    // 7. Verify Success
    await expect(firstWindow.locator('text=Installing BorgBackup...')).toBeVisible();
    await expect(firstWindow.locator('text=System Ready!')).toBeVisible({ timeout: 15000 });
  });
});
