import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { addMockElectronInitScript } from './helpers/mockElectron';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

test.describe('@screenshots Marketing screenshots', () => {
  test('capture main screens to public/', async () => {
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../electron-main.js'), '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1400, height: 900 });

    const now = new Date('2026-01-22T10:00:00.000Z').toISOString();

    await addMockElectronInitScript(page.context(), {
      initialDb: {
        settings: {
          darkMode: true,
          hideConnectionCreatedModal: true,
        },
        repos: [
          {
            id: 'repo_1',
            name: 'BorgBase (Primary)',
            url: 'ssh://borg@repo.borgbase.com:22/./repo1',
            connectionId: 'conn_aaaaaaaa',
            lastBackup: now,
            encryption: 'repokey',
            status: 'connected',
            size: '120 GB',
            fileCount: 512345,
            stats: { originalSize: 320 * 1024 * 1024 * 1024, deduplicatedSize: 120 * 1024 * 1024 * 1024 },
          },
          {
            id: 'repo_2',
            name: 'Hetzner StorageBox',
            url: 'ssh://u12345@u12345.your-storagebox.de:23/./borg',
            connectionId: 'conn_bbbbbbbb',
            lastBackup: new Date('2026-01-21T22:20:00.000Z').toISOString(),
            encryption: 'repokey',
            status: 'disconnected',
            size: '45 GB',
            fileCount: 123456,
            stats: { originalSize: 90 * 1024 * 1024 * 1024, deduplicatedSize: 45 * 1024 * 1024 * 1024 },
          },
        ],
        connections: [
          {
            id: 'conn_aaaaaaaa',
            name: 'BorgBase',
            serverUrl: 'ssh://borg@repo.borgbase.com:22',
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'conn_bbbbbbbb',
            name: 'Hetzner StorageBox',
            serverUrl: 'ssh://u12345@u12345.your-storagebox.de:23',
            createdAt: now,
            updatedAt: now,
          },
        ],
        jobs: [
          {
            id: 'job_1',
            repoId: 'repo_1',
            name: 'Daily Documents',
            sourcePath: 'C:\\Users\\tobia\\Documents',
            sourcePaths: ['C:\\Users\\tobia\\Documents', 'C:\\Users\\tobia\\Pictures'],
            excludePatterns: ['**\\node_modules\\**', '**\\.git\\**'],
            archivePrefix: 'daily',
            lastRun: now,
            status: 'success',
            compression: 'auto',
            pruneEnabled: true,
            keepDaily: 7,
            keepWeekly: 4,
            keepMonthly: 6,
            keepYearly: 2,
            scheduleEnabled: true,
            scheduleType: 'daily',
            scheduleTime: '22:00',
          },
        ],
        archives: [
          {
            id: 'a1',
            name: 'daily-2026-01-22',
            time: now,
            size: '2.1 GB',
            duration: '01:12',
          },
          {
            id: 'a2',
            name: 'daily-2026-01-21',
            time: new Date('2026-01-21T22:20:00.000Z').toISOString(),
            size: '2.0 GB',
            duration: '01:09',
          },
          {
            id: 'a3',
            name: 'daily-2026-01-20',
            time: new Date('2026-01-20T22:20:00.000Z').toISOString(),
            size: '1.9 GB',
            duration: '01:05',
          },
        ],
        activityLogs: [
          {
            id: 'log_1',
            title: 'Backup completed',
            detail: 'BorgBase (Primary) — daily-2026-01-22',
            time: now,
            status: 'success',
          },
          {
            id: 'log_2',
            title: 'Prune completed',
            detail: 'Applied retention policy to BorgBase (Primary)',
            time: new Date('2026-01-21T22:25:00.000Z').toISOString(),
            status: 'info',
          },
        ],
      } as any,
      system: { wslInstalled: true, borgInstalled: true },
      updates: { available: false },
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });

    const outDir = path.join(__dirname, '../public');
    ensureDir(outDir);

    const clip = { x: 0, y: 0, width: 1400, height: 900 };

    // Dashboard
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'dashboard.png'), clip });

    // Repositories
    await page.getByRole('button', { name: 'Repositories' }).click();
    await expect(page.getByRole('heading', { name: 'Repositories' })).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'repos.png'), clip });

    // Jobs
    await page.getByRole('button', { name: 'Jobs' }).click();
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'jobs.png'), clip });

    // Restore / Archives
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByRole('tab', { name: 'Archives' })).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'archives.png'), clip });

    // Restore / Mounts
    await page.getByRole('tab', { name: 'Mounts' }).click();
    await expect(page.getByRole('tab', { name: 'Mounts' })).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'mounts.png'), clip });

    // Connections
    await page.getByRole('button', { name: 'Connections' }).click();
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(outDir, 'connections.png'), clip });

    await electronApp.close().catch(() => {});
  });
});
