import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import App from './App';

vi.mock('./components/TitleBar', () => ({ default: () => <div data-testid="titlebar" /> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast" /> }));
vi.mock('./components/UpdateModal', () => ({ default: () => null }));
vi.mock('./components/OnboardingModal', () => ({ default: () => null }));
vi.mock('./components/FuseSetupModal', () => ({ default: () => null }));

// Keep other views out of the way; this test exercises the real RepositoriesView + RepoCard + App handler.
vi.mock('./views/DashboardView', () => ({ default: () => <div data-testid="view-dashboard" /> }));
vi.mock('./views/MountsView', () => ({ default: () => <div data-testid="view-mounts" /> }));
vi.mock('./views/ArchivesView', () => ({ default: () => <div data-testid="view-archives" /> }));
vi.mock('./views/ActivityView', () => ({ default: () => <div data-testid="view-activity" /> }));
vi.mock('./views/SettingsView', () => ({ default: () => <div data-testid="view-settings" /> }));
vi.mock('./views/RepoDetailsView', () => ({ default: () => <div data-testid="view-repo-details" /> }));

vi.mock('./components/Sidebar', () => ({
  default: ({ onChangeView }: any) => (
    <div data-testid="sidebar">
      <button onClick={() => onChangeView('REPOSITORIES')}>Go to Repos</button>
    </div>
  ),
}));

// Prevent toast/event bus calls from throwing.
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
  breakLock: vi.fn(),
  forceDeleteLockFiles: vi.fn(),
  checkLockStatus: vi.fn(),

  // App can reference these during startup in other code paths; keep safe defaults.
  runCommand: vi.fn(),
  stopCommand: vi.fn(),
  mount: vi.fn(),
  unmount: vi.fn(),
  getArchiveInfo: vi.fn(),
  listArchives: vi.fn(),
  installBorg: vi.fn(),
  installSSHKey: vi.fn(),
  manageSSHKey: vi.fn(),
  testConnection: vi.fn(),
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

describe('App unlock flow (integration)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'require', {
      value: mockRequire,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    (window.confirm as any).mockRestore?.();
  });

  it('runs break-lock + deletes lock files and clears lock badge', async () => {
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
              isLocked: true,
            },
          ],
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

    mockBorg.breakLock.mockResolvedValue(true);
    mockBorg.forceDeleteLockFiles.mockResolvedValue(true);
    // After unlock, lock status should become false.
    mockBorg.checkLockStatus.mockResolvedValue(false);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Repos' }));

    // Ensure RepoCard is visible.
    await waitFor(() => expect(screen.getByText('Repo1')).toBeInTheDocument(), { timeout: 3000 });

    // Locked badge initially present.
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Unlock/i }));

    await waitFor(() => {
      expect(mockBorg.breakLock).toHaveBeenCalledTimes(1);
      expect(mockBorg.forceDeleteLockFiles).toHaveBeenCalledTimes(1);
      expect(mockBorg.checkLockStatus).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    expect(mockBorg.breakLock).toHaveBeenCalledWith(
      'ssh://user@host/./repo',
      expect.any(Function),
      expect.objectContaining({ repoId: 'r1' })
    );

    expect(mockBorg.forceDeleteLockFiles).toHaveBeenCalledWith(
      'ssh://user@host/./repo',
      expect.any(Function),
      expect.objectContaining({ disableHostCheck: undefined, remotePath: undefined })
    );

    // Lock badge should disappear after checkRepoLock updates state.
    await waitFor(() => {
      expect(screen.queryByText(/Locked/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
