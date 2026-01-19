// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

type ElectronModule = {
  ipcRenderer?: any;
  shell?: any;
};

async function importFresh() {
  vi.resetModules();
  return await import('./electron');
}

describe('services/electron', () => {
  const originalRequire = (window as any).require;
  const originalWarn = console.warn;
  const originalEnv = (globalThis as any)?.process?.env?.WINBORG_ELECTRON_WARN_IN_TESTS;

  beforeEach(() => {
    // Keep tests quiet and also let us assert warnOnce behavior.
    console.warn = vi.fn();

    // Ensure we start from a clean window.require each test.
    delete (window as any).require;
  });

  afterEach(() => {
    console.warn = originalWarn;

    if ((globalThis as any)?.process?.env) {
      if (originalEnv === undefined) {
        delete (globalThis as any).process.env.WINBORG_ELECTRON_WARN_IN_TESTS;
      } else {
        (globalThis as any).process.env.WINBORG_ELECTRON_WARN_IN_TESTS = originalEnv;
      }
    }

    if (originalRequire !== undefined) {
      (window as any).require = originalRequire;
    } else {
      delete (window as any).require;
    }

    vi.restoreAllMocks();
  });

  it('returns null electron module when window.require is missing', async () => {
    const { getElectronModule, getIpcRendererOrNull, getShellOrNull } = await importFresh();

    expect(getElectronModule()).toBeNull();
    expect(getIpcRendererOrNull()).toBeNull();
    expect(getShellOrNull()).toBeNull();
  });

  it('getIpcRendererSafe returns a no-op shim and warns only once', async () => {
    // We silence warnings by default in tests to avoid stderr noise.
    // This test opts in so we can still assert warnOnce behavior.
    (globalThis as any).process.env.WINBORG_ELECTRON_WARN_IN_TESTS = '1';

    const { getIpcRendererSafe } = await importFresh();

    const ipc1 = getIpcRendererSafe();
    const ipc2 = getIpcRendererSafe();

    const r1 = await ipc1.invoke('anything');
    expect(r1).toEqual({ success: false, error: 'Running in browser mode (Mock)' });

    // warnOnce should fire exactly once
    expect(console.warn).toHaveBeenCalledTimes(1);

    // Subsequent calls still work but do not warn again
    await ipc2.invoke('anything');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('does not cache the Electron module when window.require is a vi.fn (mock can change per-test)', async () => {
    const requireMock = vi.fn<(module: string) => ElectronModule>().mockImplementation(() => ({
      shell: { openExternal: vi.fn() },
    }));

    Object.defineProperty(window, 'require', {
      value: requireMock,
      writable: true,
      configurable: true,
    });

    const { getShellOrNull } = await importFresh();

    // First call should return shell.
    expect(getShellOrNull()).not.toBeNull();

    // Now change the mock implementation to throw: helper must respect it and return null.
    requireMock.mockImplementation(() => {
      throw new Error('Not found');
    });

    expect(getShellOrNull()).toBeNull();

    // Should have attempted to require twice.
    expect(requireMock).toHaveBeenCalledTimes(2);

    // warnOnce should have warned (at most once)
    expect((console.warn as any).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('caches successful non-mock require lookups but invalidates cache if window.require function identity changes', async () => {
    const electronA: ElectronModule = { shell: { id: 'A' } };
    const electronB: ElectronModule = { shell: { id: 'B' } };

    const requireA = (module: string) => {
      if (module !== 'electron') return {};
      return electronA;
    };

    Object.defineProperty(window, 'require', {
      value: requireA,
      writable: true,
      configurable: true,
    });

    const { getElectronModule, getShellOrNull } = await importFresh();

    expect(getElectronModule()).toBe(electronA);
    expect(getShellOrNull()?.id).toBe('A');

    // Swap window.require identity (simulates environment changing require binding)
    const requireB = (module: string) => {
      if (module !== 'electron') return {};
      return electronB;
    };

    (window as any).require = requireB;

    expect(getElectronModule()).toBe(electronB);
    expect(getShellOrNull()?.id).toBe('B');
  });
});
