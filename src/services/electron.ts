// Centralized safe access to Electron APIs.
// This repo intentionally supports running the renderer in browser/Vite mode where `window.require('electron')` is unavailable.

export type IpcRendererLike = {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
  removeAllListeners?: (channel?: string) => void;
};

let cachedElectron: any | undefined;
let cachedRequireRef: unknown | undefined;
let warned = false;

function isTestEnvironment(): boolean {
  // Vitest/Jest typically run with NODE_ENV=test.
  // Avoid polluting test output with expected warnings (e.g., fallback-mode tests).
  try {
    const env = (globalThis as any)?.process?.env;
    return env?.NODE_ENV === 'test' && env?.WINBORG_ELECTRON_WARN_IN_TESTS !== '1';
  } catch {
    return false;
  }
}

function warnOnce(message: string, error?: unknown) {
  if (isTestEnvironment()) return;
  if (warned) return;
  warned = true;
  try {
    // eslint-disable-next-line no-console
    console.warn(message, error);
  } catch {
    // ignore
  }
}

export function getElectronModule(): any | null {
  // Only cache successful lookups.
  // In unit tests, `window.require` may be injected after module import.
  const currentRequire = (window as any)?.require;

  const isMockRequire =
    typeof currentRequire === 'function' &&
    (typeof (currentRequire as any).getMockImplementation === 'function' ||
      (currentRequire as any).mock != null);

  // In unit tests, `window.require` is often a vi.fn() whose implementation can
  // be swapped per-test. Avoid caching in that case so behavior tracks the mock.
  if (isMockRequire) {
    try {
      const w = window as any;
      if (w && typeof w.require === 'function') {
        return w.require('electron');
      }
    } catch (e) {
      warnOnce('WinBorg: Electron require failed', e);
    }
    return null;
  }

  if (cachedElectron !== undefined && cachedRequireRef === currentRequire) return cachedElectron;
  if (cachedRequireRef !== undefined && cachedRequireRef !== currentRequire) {
    // Test environments sometimes swap out window.require between tests.
    // Invalidate the cached Electron module so we respect the new mock.
    cachedElectron = undefined;
  }
  cachedRequireRef = currentRequire;

  try {
    const w = window as any;
    if (w && typeof w.require === 'function') {
      cachedElectron = w.require('electron');
      return cachedElectron;
    }
  } catch (e) {
    warnOnce('WinBorg: Electron require failed', e);
  }

  return null;
}

export function getIpcRendererOrNull(): IpcRendererLike | null {
  const electron = getElectronModule();
  const ipc = electron?.ipcRenderer;
  return ipc ? (ipc as IpcRendererLike) : null;
}

export function getIpcRendererSafe(): IpcRendererLike {
  const ipc = getIpcRendererOrNull();
  if (ipc) return ipc;

  warnOnce('WinBorg: Running in browser/mock mode. Electron features disabled.');

  return {
    invoke: async () => ({ success: false, error: 'Running in browser mode (Mock)' }),
    send: () => {},
    on: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
  };
}

export function getShellOrNull(): any | null {
  const electron = getElectronModule();
  return electron?.shell ?? null;
}
