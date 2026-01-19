import { getAppVersion } from './appVersion';

describe('getAppVersion', () => {
  const originalEnv = { ...(process.env as any) };

  afterEach(() => {
    // reset any env changes
    process.env = { ...(originalEnv as any) };

    // reset any window.require changes
    try {
      delete (window as any).require;
    } catch {
      // ignore
    }
  });

  it('prefers main-process version via ipcRenderer.invoke', async () => {
    (process.env as any).APP_VERSION = '1.0.0';

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        invoke: vi.fn(async () => ' 2.3.4 \n'),
      },
    }));

    await expect(getAppVersion()).resolves.toBe('2.3.4');
  });

  it('falls back to APP_VERSION when ipc is unavailable', async () => {
    (process.env as any).APP_VERSION = '9.9.9';
    await expect(getAppVersion()).resolves.toBe('9.9.9');
  });

  it('falls back to APP_VERSION when ipc invoke throws', async () => {
    (process.env as any).APP_VERSION = '3.3.3';

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        invoke: vi.fn(async () => {
          throw new Error('boom');
        }),
      },
    }));

    await expect(getAppVersion()).resolves.toBe('3.3.3');
  });

  it('returns null when no ipc and no APP_VERSION', async () => {
    delete (process.env as any).APP_VERSION;
    await expect(getAppVersion()).resolves.toBeNull();
  });

  it('returns null when ipc returns an empty/non-string version', async () => {
    (process.env as any).APP_VERSION = '';

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        invoke: vi.fn(async () => ({ version: 'nope' })),
      },
    }));

    await expect(getAppVersion()).resolves.toBeNull();
  });
});
