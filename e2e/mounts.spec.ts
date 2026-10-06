import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Mounts flow', () => {
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

  test('mount archive then unmount @smoke', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });

    // Should land in Mounts view with configuration open
    await expect(page.getByText('Mount Configuration')).toBeVisible();

    // Choose archive (labels are not wired via htmlFor, so locate the select by nearby text)
    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    await archiveSelect.selectOption({ value: 'daily-2026-01-03' });

    await page.getByRole('button', { name: 'Mount Archive' }).click();

    // Mounted card appears
    await expect(page.getByRole('heading', { name: 'daily-2026-01-03' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unmount' })).toBeVisible();

    // Open Folder should translate the WSL path to a Windows UNC path.
    await page.getByRole('button', { name: 'Open Folder' }).click();
    const sends = await page.evaluate(() => (window as any).__winborgIpcSends);
    expect(sends[sends.length - 1]).toEqual({
      channel: 'open-path',
      payload: '\\\\wsl.localhost\\Ubuntu\\mnt\\wsl\\winborg\\daily-2026-01-03',
    });

    await page.getByRole('button', { name: 'Unmount' }).click();

    await expect(page.getByText('No active mounts')).toBeVisible();
  });

  test('mount all archives of a repository then unmount @smoke', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });
    await expect(page.getByText('Mount Configuration')).toBeVisible();

    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    // Default stays on a single archive; "All archives" is offered as the first option.
    await expect(archiveSelect.locator('option').first()).toHaveText(/All archives \(\d+\), one folder per archive/);
    await expect(archiveSelect).not.toHaveValue('__winborg_all_archives__');

    await archiveSelect.selectOption({ value: '__winborg_all_archives__' });
    await expect(page.getByText('Every archive appears as its own folder')).toBeVisible();
    await expect(page.getByText('borg mount -o allow_other ssh://user@example.com:22/./repo /mnt/wsl/winborg/all-archives-My_Repo')).toBeVisible();

    await page.getByRole('button', { name: 'Mount All Archives' }).click();

    await expect(page.getByRole('heading', { name: 'All archives' })).toBeVisible();
    await expect(page.getByText('/mnt/wsl/winborg/all-archives-My_Repo')).toBeVisible();

    // Exactly one borg mount of the whole repository: no ::archive, mount point last.
    const mountCalls = await page.evaluate(() => (window as any).__winborgMountCalls);
    expect(mountCalls).toHaveLength(1);
    expect(mountCalls[0].args).toEqual([
      'mount', '--foreground', '-o', 'allow_other',
      'ssh://user@example.com:22/./repo',
      '/mnt/wsl/winborg/all-archives-My_Repo',
    ]);
    expect(mountCalls[0].repoId).toBe('repo1');

    await page.getByRole('button', { name: 'Open Folder' }).click();
    const sends = await page.evaluate(() => (window as any).__winborgIpcSends);
    expect(sends[sends.length - 1]).toEqual({
      channel: 'open-path',
      payload: '\\\\wsl.localhost\\Ubuntu\\mnt\\wsl\\winborg\\all-archives-My_Repo',
    });

    // Mounting the same repository again is blocked until it is unmounted.
    await page.getByRole('button', { name: 'New mount' }).click();
    await archiveSelect.selectOption({ value: '__winborg_all_archives__' });
    await expect(page.getByRole('button', { name: 'Mount All Archives' })).toBeDisabled();
    await expect(page.getByText('Already mounted at /mnt/wsl/winborg/all-archives-My_Repo')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Unmount' }).click();
    await expect(page.getByText('No active mounts')).toBeVisible();
  });

  test('mount a single archive next to an all-archives mount', async () => {
    await addMockElectronInitScript(page.context(), { initialDb: baseDb, system: baseSystem });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });

    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    await archiveSelect.selectOption({ value: '__winborg_all_archives__' });
    await page.getByRole('button', { name: 'Mount All Archives' }).click();
    await expect(page.getByRole('heading', { name: 'All archives' })).toBeVisible();

    await page.getByRole('button', { name: 'New mount' }).click();
    await archiveSelect.selectOption({ value: 'daily-2026-01-03' });
    await page.getByRole('button', { name: 'Mount Archive' }).click();

    await expect(page.getByRole('heading', { name: 'daily-2026-01-03' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unmount' })).toHaveCount(2);

    const mountCalls = await page.evaluate(() => (window as any).__winborgMountCalls);
    expect(mountCalls.map((c: any) => c.args.slice(-2))).toEqual([
      ['ssh://user@example.com:22/./repo', '/mnt/wsl/winborg/all-archives-My_Repo'],
      ['ssh://user@example.com:22/./repo::daily-2026-01-03', '/mnt/wsl/winborg/daily-2026-01-03'],
    ]);
  });

  test('mount failure with FUSE_MISSING shows WSL configuration help', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      mounts: { mountSuccess: false, mountError: 'FUSE_MISSING' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText('Online')).toBeVisible();

    await page.locator('nav').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByText('daily-2026-01-03')).toBeVisible();

    const row = page.locator('tr', { hasText: 'daily-2026-01-03' });
    await row.hover();
    await row.getByTitle('Mount Archive').click({ force: true });

    await expect(page.getByText('Mount Configuration')).toBeVisible();
    const archiveSelect = page.locator('label', { hasText: 'Target Archive' }).locator('..').locator('select');
    await archiveSelect.selectOption({ value: 'daily-2026-01-03' });

    await page.getByRole('button', { name: 'Mount Archive' }).click();

    // App reacts to the magic error code by showing FuseSetupModal.
    await expect(page.getByText('WSL Configuration Required')).toBeVisible();
  });
});
