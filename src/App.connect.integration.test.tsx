import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import App from './App';

vi.mock('./components/TitleBar', () => ({ default: () => <div data-testid="titlebar" /> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast" /> }));
vi.mock('./components/UpdateModal', () => ({ default: () => null }));
vi.mock('./components/OnboardingModal', () => ({ default: () => null }));
vi.mock('./components/FuseSetupModal', () => ({ default: () => null }));

// Keep other views out of the way; this test exercises the real RepositoriesView + App handlers.
vi.mock('./views/DashboardView', () => ({ default: () => <div data-testid="view-dashboard" /> }));
vi.mock('./views/MountsView', () => ({ default: () => <div data-testid="view-mounts" /> }));
vi.mock('./views/ActivityView', () => ({ default: () => <div data-testid="view-activity" /> }));
vi.mock('./views/SettingsView', () => ({ default: () => <div data-testid="view-settings" /> }));
vi.mock('./views/RepoDetailsView', () => ({ default: () => <div data-testid="view-repo-details" /> }));

// Minimal ArchivesView stub: proves App state contains parsed archives after connect.
vi.mock('./views/ArchivesView', () => ({
  default: ({ archives }: any) => (
    <div data-testid="view-archives">
      <div>Archives</div>
      <ul>
        {(archives || []).map((a: any) => (
          <li key={a.id ?? a.name}>{String(a.name)}</li>
        ))}
      </ul>
    </div>
  ),
}));

vi.mock('./components/Sidebar', () => ({
  default: ({ onChangeView }: any) => (
    <div data-testid="sidebar">
      <button onClick={() => onChangeView('REPOSITORIES')}>Go to Repos</button>
      <button onClick={() => onChangeView('ARCHIVES')}>Go to Archives</button>
    </div>
  ),
}));

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
  // RepositoriesView add/connect flow
  manageSSHKey: vi.fn(async (action: 'check' | 'generate' | 'read') => {
    if (action === 'check') return { success: true, exists: false };
    if (action === 'read') return { success: true, key: '' };
    return { success: true };
  }),
  testConnection: vi.fn(),

  // App connect flow
  runCommand: vi.fn(),
  checkLockStatus: vi.fn(),
  getArchiveInfo: vi.fn(),

  // Safe defaults for other startup code paths.
  stopCommand: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
  listArchives: vi.fn(),
  checkRepoIntegrity: vi.fn(),
  breakLock: vi.fn(),
  forceDeleteLockFiles: vi.fn(),
  installBorg: vi.fn(),
  installSSHKey: vi.fn(),
  testSshConnection: vi.fn(),
  checkBorgInstalledRemote: vi.fn(),
  initRepo: vi.fn(),
  savePassphrase: vi.fn(),
  deletePassphrase: vi.fn(),
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

describe('App add repo + connect flow (integration)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'require', {
      value: mockRequire,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'get-db') {
        return Promise.resolve({
          repos: [],
          jobs: [],
          mounts: [],
          archives: [],
          activityLogs: [],
        });
      }
      if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
      if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
      return Promise.resolve(null);
    });

    mockBorg.testConnection.mockResolvedValue(true);
    mockBorg.checkLockStatus.mockResolvedValue(false);

    mockBorg.getArchiveInfo.mockResolvedValue({ size: '1MB', duration: '1s' });

    mockBorg.runCommand.mockImplementation(async (args: string[], onLog: (l: string) => void) => {
      // App uses borgService.runCommand for both `list --json` and `info --json`.
      if (args[0] === 'list') {
        onLog(
          JSON.stringify({
            archives: [
              {
                id: 'a1',
                name: 'arch-1',
                time: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'a2',
                name: 'arch-2',
                time: '2026-01-02T00:00:00.000Z',
              },
            ],
          })
        );
        return true;
      }

      if (args[0] === 'info') {
        onLog(
          JSON.stringify({
            repository: {
              stats: {
                unique_csize: 1024 * 1024 * 1024,
                total_size: 2 * 1024 * 1024 * 1024,
              },
            },
          })
        );
        return true;
      }

      return true;
    });
  });

  it('adds a repo, connects, and populates archive list', async () => {
    const realSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((cb: any, ms?: any, ...args: any[]) => {
        // App schedules archive stats fetch and repo stats fetch after connect.
        // Important: do NOT intercept 1000ms timers, because Testing Library's
        // waitFor uses a 1000ms overall timeout internally.
        if (ms === 500 || ms === 800) {
          cb(...args);
          return 0 as any;
        }
        return realSetTimeout(cb, ms as any, ...args) as any;
      }) as any);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Repos' }));

    // Add repo
    fireEvent.click(await screen.findByText('Add Repository'));

    fireEvent.change(screen.getByPlaceholderText('e.g. Work Backups'), {
      target: { value: 'My Repo' },
    });
    fireEvent.change(screen.getByPlaceholderText('ssh://user@example.com:22'), {
      target: { value: 'C:\\Backups' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Test Connection/i }));

    await waitFor(() => {
      expect(mockBorg.testConnection).toHaveBeenCalled();
    });

    await screen.findByText(/Connection successful/i);

    // Avoid passphrase requirement by choosing no encryption for this test.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'none' } });

    fireEvent.click(screen.getByRole('button', { name: /^Connect$/i }));

    // App handleAddRepo triggers handleConnect, which runs `borg list --json`.
    await waitFor(() => {
      expect(mockBorg.runCommand).toHaveBeenCalledWith(
        ['list', '--json', 'C:\\Backups'],
        expect.any(Function),
        expect.objectContaining({ repoId: expect.any(String) })
      );
    });

    // Repo should become connected; RepoCard shows "Online" and primary action changes to "Refresh".
    await waitFor(() => {
      expect(screen.getByText('My Repo')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to Archives' }));

    await waitFor(() => {
      expect(screen.getByTestId('view-archives')).toBeInTheDocument();
      expect(screen.getByText('arch-1')).toBeInTheDocument();
      expect(screen.getByText('arch-2')).toBeInTheDocument();
    });

    await act(async () => {
      await Promise.resolve();
    });

    setTimeoutSpy.mockRestore();
  });
});
