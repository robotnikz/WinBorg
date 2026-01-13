type IpcRendererLike = {
  invoke?: (channel: string, payload?: any) => Promise<any>;
};

function getIpcRenderer(): IpcRendererLike | null {
  try {
    const req = (window as any)?.require;
    if (typeof req !== 'function') return null;
    const electron = req('electron');
    return electron?.ipcRenderer ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the app version as a plain semver string, preferring the main-process
 * value (app.getVersion()) to avoid relying on repo/package.json state.
 */
export async function getAppVersion(): Promise<string | null> {
  const ipcRenderer = getIpcRenderer();

  if (ipcRenderer?.invoke) {
    try {
      const value = await ipcRenderer.invoke('get-app-version');
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    } catch {
      // fall back
    }
  }

  const fallback = (process.env as any)?.APP_VERSION;
  return (typeof fallback === 'string' && fallback.trim().length > 0) ? fallback.trim() : null;
}
