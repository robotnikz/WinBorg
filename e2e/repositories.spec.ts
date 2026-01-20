import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { addMockElectronInitScript } from './helpers/mockElectron';

test.describe('Repositories flow', () => {
  let electronApp: any;
  let page: any;

  const baseDb = { repos: [], jobs: [], archives: [], activityLogs: [], settings: {} };
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

  test('add repo -> test connection -> connect @smoke', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('ssh://user@example.com:22');
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

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

  test('rejects non-SSH repository URLs (SSH-only)', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('Bad Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('C:\\Backups');
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

    // Hint should indicate SSH-only.
    await expect(page.getByText(/SSH-only: please enter a valid ssh:\/\//i)).toBeVisible();

    // No test button if URL is not ssh://
    await expect(page.getByRole('button', { name: 'Test SSH & Remote Connection' })).toHaveCount(0);

    // Connect should remain disabled
    await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeDisabled();
  });

  test('ssh test connection failure shows actionable error', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      ssh: { testConnectionSuccess: false, testConnectionError: 'Permission denied (publickey).' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('ssh://user@example.com:22');
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

    await page
      .locator('label', { hasText: 'Passphrase' })
      .locator('..')
      .locator('input')
      .fill('correct horse battery staple');

    await page.getByRole('button', { name: 'Test SSH & Remote Connection' }).click();
    await expect(page.getByText('Connection Failed', { exact: true })).toBeVisible();
    await expect(page.getByText(/Deploy your SSH key via the Connections menu/i)).toBeVisible();
  });

  test('ssh failure can be fixed via Connections -> Deploy Key flow', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      ssh: { testConnectionSuccess: false, testConnectionError: 'Permission denied (publickey).' },
    });
    await page.reload();

    // First, create a connection and deploy the SSH key via Connections.
    await page.locator('nav').getByRole('button', { name: 'Connections', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByPlaceholder('e.g. Hetzner StorageBox').fill('Test Server');
    await page.getByPlaceholder('ssh://user@host:22').fill('ssh://user@example.com:22');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    const postCreateDialog = page.getByRole('dialog', { name: 'Connection created' });
    await expect(postCreateDialog).toBeVisible();
    await expect(postCreateDialog.getByText('Test Server', { exact: true })).toBeVisible();
    await postCreateDialog.getByRole('button', { name: 'Deploy Key', exact: true }).click();
    const deployDialog = page.getByRole('dialog', { name: 'Deploy SSH Key' });
    await expect(deployDialog.getByRole('heading', { name: 'Deploy SSH Key' })).toBeVisible();
    await deployDialog.getByPlaceholder('Server Password').fill('pw');
    await deployDialog.getByRole('button', { name: 'Deploy Key', exact: true }).click();
    await expect(deployDialog.getByRole('heading', { name: 'Deploy SSH Key' })).toBeHidden();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    // With a saved connection, the modal defaults to selecting it.
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

    await page
      .locator('label', { hasText: 'Passphrase' })
      .locator('..')
      .locator('input')
      .fill('correct horse battery staple');

    await page.getByRole('button', { name: 'Test SSH & Remote Connection' }).click();
    await expect(page.getByText('Connection successful')).toBeVisible();
  });

  test('remote borg missing shows BorgBackup Missing state', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      ssh: { testConnectionSuccess: true, borgInstalled: false, borgError: 'borg: command not found' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('ssh://user@example.com:22');
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

    await page
      .locator('label', { hasText: 'Passphrase' })
      .locator('..')
      .locator('input')
      .fill('correct horse battery staple');

    await page.getByRole('button', { name: 'Test SSH & Remote Connection' }).click();
    await expect(page.getByText('BorgBackup Missing')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Install Borg automatically' })).toBeVisible();
  });

  test('remote borg missing can be fixed via Install Borg automatically', async () => {
    await addMockElectronInitScript(page.context(), {
      initialDb: baseDb,
      system: baseSystem,
      ssh: { testConnectionSuccess: true, borgInstalled: false, borgError: 'borg: command not found' },
    });
    await page.reload();

    await page.locator('nav').getByRole('button', { name: 'Repositories', exact: true }).click();

    await page.getByRole('button', { name: 'Add Repository' }).click();
    await expect(page.getByRole('heading', { name: 'Add Repository' })).toBeVisible();

    await page.getByPlaceholder('e.g. Work Backups').fill('My Repo');
    await page.getByPlaceholder('ssh://user@example.com:22').fill('ssh://user@example.com:22');
    await page.getByPlaceholder('e.g. /home/user/backups/repo1').fill('/./repo');

    await page
      .locator('label', { hasText: 'Passphrase' })
      .locator('..')
      .locator('input')
      .fill('correct horse battery staple');

    await page.getByRole('button', { name: 'Test SSH & Remote Connection' }).click();
    await expect(page.getByText('BorgBackup Missing')).toBeVisible();

    await page.getByRole('button', { name: 'Install Borg automatically' }).click();

    await expect(page.getByRole('heading', { name: 'Install BorgBackup' })).toBeVisible();
    await page.getByPlaceholder('Sudo/Root Password').fill('pw');
    await page.getByRole('button', { name: 'Install Borg', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Install BorgBackup' })).toBeHidden();
    await expect(page.getByText('Connection successful')).toBeVisible();
  });
});
