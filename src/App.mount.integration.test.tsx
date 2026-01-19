import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import App from './App';

vi.mock('./components/TitleBar', () => ({ default: () => <div data-testid="titlebar" /> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast" /> }));
vi.mock('./components/UpdateModal', () => ({ default: () => null }));
vi.mock('./components/OnboardingModal', () => ({ default: () => null }));
vi.mock('./components/FuseSetupModal', () => ({ default: () => null }));

// Keep other views out of the way; this test exercises the real MountsView + App handler.
vi.mock('./views/DashboardView', () => ({ default: () => <div data-testid="view-dashboard" /> }));
vi.mock('./views/RepositoriesView', () => ({ default: () => <div data-testid="view-repos" /> }));
vi.mock('./views/ArchivesView', () => ({ default: () => <div data-testid="view-archives" /> }));
vi.mock('./views/ActivityView', () => ({ default: () => <div data-testid="view-activity" /> }));
vi.mock('./views/SettingsView', () => ({ default: () => <div data-testid="view-settings" /> }));

vi.mock('./components/Sidebar', () => ({
  default: ({ onChangeView }: any) => (
    <div data-testid="sidebar">
      <button onClick={() => onChangeView('MOUNTS')}>Go to Mounts</button>
    </div>
  ),
}));

// Mock toast calls used by App during mount lifecycle.
vi.mock('./utils/eventBus', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    show: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
}));

const mockBorg = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
  checkLockStatus: vi.fn(),
  runCommand: vi.fn(),
  getArchiveInfo: vi.fn(),
  listArchives: vi.fn(),
  checkRepoIntegrity: vi.fn(),
  breakLock: vi.fn(),
  refreshRepo: vi.fn(),
}));

vi.mock('./services/borgService', () => ({ borgService: mockBorg }));

const mockIpcRenderer = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
  send: vi.fn(),
}));

const mockRequire = vi.fn((module) => {
  if (module === 'electron') return { ipcRenderer: mockIpcRenderer };
  return {};
});

describe('App mount flow (integration)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'require', {
      value: mockRequire,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('mounts an archive via MountsView and opens the path', async () => {
    const realSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: any, ms?: any, ...args: any[]) => {
        // App schedules a delayed lock check after mount/unmount.
        // For determinism (and no leaked timers), run that callback immediately.
        if (ms === 1000) {
          cb(...args);
          return 0 as any;
        }
        return realSetTimeout(cb, ms as any, ...args) as any;
      }) as any);

    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'get-db') {
        return Promise.resolve({
          repos: [
            {
              id: 'r1',
              name: 'Repo1',
              url: 'ssh://user@host/./repo',
              status: 'connected',
              lastBackup: 'Never',
              encryption: 'repokey',
              size: 'Unknown',
              fileCount: 0,
            },
          ],
          jobs: [],
          mounts: [],
          archives: [{ id: 'a1', name: 'arch 1', time: 'now', duration: '1s', size: '1MB' }],
          activityLogs: [],
        });
      }
      if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
      if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
      return Promise.resolve(null);
    });

    mockBorg.mount.mockResolvedValue({ success: true, mountId: 'm1' });
    mockBorg.checkLockStatus.mockResolvedValue(false);

    render(<App />);

    // Navigate to mounts
    fireEvent.click(screen.getByRole('button', { name: 'Go to Mounts' }));

    // Wait for MountsView to be visible
    await waitFor(() => expect(screen.getByText('Active Mounts')).toBeInTheDocument(), { timeout: 3000 });

    // Open mount creation
    fireEvent.click(screen.getByRole('button', { name: /New Mount/i }));

    // Trigger mount
    fireEvent.click(screen.getByRole('button', { name: /Mount Archive/i }));

    await waitFor(() => {
      expect(mockBorg.mount).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    expect(mockBorg.mount).toHaveBeenCalledWith(
      'ssh://user@host/./repo',
      'arch 1',
      '/mnt/wsl/winborg/arch_1',
      expect.any(Function),
      expect.objectContaining({ repoId: 'r1' })
    );

    // App auto-opens the path when mount succeeds
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('open-path', '/mnt/wsl/winborg/arch_1');

    // Mounted entry should appear in the list
    await waitFor(() => {
      expect(screen.getByText('arch 1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Folder/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    await act(async () => {
      // allow any immediately-invoked async lock check to complete
      await Promise.resolve();
    });

    setTimeoutSpy.mockRestore();
  });
});
