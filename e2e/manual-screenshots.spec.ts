import { test, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { addMockElectronInitScript } from './helpers/mockElectron';

// Manual screenshot capture.
// Run locally:
//   npm run build
//   $env:CAPTURE_SCREENSHOTS=1; npx playwright test e2e/manual-screenshots.spec.ts

test.describe('manual screenshots', () => {
  test.skip(process.env.CAPTURE_SCREENSHOTS !== '1', 'Set CAPTURE_SCREENSHOTS=1 to run this suite');

  test('queued borg toast', async () => {
    const repoRoot = path.join(__dirname, '..');
    const outDir = path.join(repoRoot, 'docs', 'screenshots');
    const outFile = path.join(outDir, 'borg-queue-toast.png');

    fs.mkdirSync(outDir, { recursive: true });

    const electronApp = await electron.launch({
      args: [path.join(repoRoot, 'electron-main.js'), '--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    try {
      const firstWindow = await electronApp.firstWindow();

      await addMockElectronInitScript(firstWindow.context(), {
        initialDb: { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} },
        system: { wslInstalled: true, borgInstalled: true }
      });

      await firstWindow.reload();
      await firstWindow.waitForLoadState('domcontentloaded');

      await firstWindow.evaluate(() => {
        window.dispatchEvent(new CustomEvent('winborg:borg-queued', { detail: { commandId: 'screenshot' } }));
      });

      const toast = firstWindow.locator('div.pointer-events-auto', {
        hasText: 'Warte auf laufende Repo-Operation'
      });

      await toast.waitFor({ state: 'visible', timeout: 10_000 });
      await toast.screenshot({ path: outFile });
    } finally {
      await electronApp.close();
    }
  });
});
