import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import App from './App';

const listArchives = vi.fn();
const getDownloadsPath = vi.fn();
const createDirectory = vi.fn();
const extractFiles = vi.fn();
const checkLockStatus = vi.fn();

vi.mock('./services/borgService', () => ({
  borgService: {
    listArchives: (...args: any[]) => listArchives(...args),
    getDownloadsPath: (...args: any[]) => getDownloadsPath(...args),
    createDirectory: (...args: any[]) => createDirectory(...args),
    extractFiles: (...args: any[]) => extractFiles(...args),
    checkLockStatus: (...args: any[]) => checkLockStatus(...args),
    runCommand: vi.fn(),
    stopCommand: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
    getArchiveInfo: vi.fn(),
    breakLock: vi.fn(),
    forceDeleteLockFiles: vi.fn(),
    deletePassphrase: vi.fn(),
    createArchive: vi.fn(),
    prune: vi.fn(),
    openPath: vi.fn(),
  }
}));

const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn(),
};

vi.mock('./services/electron', () => ({
  getIpcRendererOrNull: () => mockIpcRenderer
}));

vi.mock('./components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('./components/TitleBar', () => ({ default: () => <div data-testid="titlebar" /> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast-container" /> }));
vi.mock('./components/TerminalModal', () => ({ default: () => null }));
vi.mock('./components/FuseSetupModal', () => ({ default: () => null }));
vi.mock('./components/CreateBackupModal', () => ({ default: () => null }));
vi.mock('./components/OnboardingModal', () => ({ default: () => null }));
vi.mock('./components/UpdateModal', () => ({ default: () => null }));
vi.mock('./views/RepositoriesView', () => ({ default: () => null }));
vi.mock('./views/JobsView', () => ({ default: () => null }));
vi.mock('./views/MountsView', () => ({ default: () => null }));
vi.mock('./views/SettingsView', () => ({ default: () => null }));
vi.mock('./views/ActivityView', () => ({ default: () => null }));
vi.mock('./views/ArchivesView', () => ({ default: () => null }));
vi.mock('./views/RestoreView', () => ({ default: () => null }));
vi.mock('./views/ConnectionsView', () => ({ default: () => null }));
vi.mock('./views/DashboardView', () => ({
  default: ({ repos, onViewDetails }: any) => (
    <div data-testid="dashboard-view">
      <button onClick={() => onViewDetails(repos[0])}>Open Repo Details</button>
    </div>
  )
}));
vi.mock('./views/RepoDetailsView', () => ({
  default: ({ repo, onSaveRecoveryDrill, onRunRecoveryDrill }: any) => (
    <div data-testid="repo-details-view">
      <div data-testid="recovery-enabled">{String(!!repo.recoveryDrill?.enabled)}</div>
      <div data-testid="recovery-sample-count">{String(repo.recoveryDrill?.samplePaths?.length || 0)}</div>
      <div data-testid="recovery-status">{String(repo.recoveryDrillState?.status || 'unknown')}</div>
      <div data-testid="recovery-archive">{String(repo.recoveryDrillState?.lastArchiveName || '')}</div>
      <button onClick={() => onSaveRecoveryDrill(repo.id, {
        enabled: true,
        autoRunAfterBackup: false,
        samplePaths: ['Documents/important.docx', 'Photos/family.jpg']
      })}>Save Drill</button>
      <button onClick={() => onRunRecoveryDrill(repo.id)}>Run Drill</button>
    </div>
  )
}));

describe('App recovery workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockIpcRenderer.on.mockImplementation(() => undefined);
    mockIpcRenderer.removeListener.mockImplementation(() => undefined);
    mockIpcRenderer.send.mockImplementation(() => undefined);
    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'get-db') {
        return Promise.resolve({
          repos: [{
            id: 'repo-1',
            name: 'Repo One',
            url: 'ssh://user@example/./repo',
            status: 'disconnected',
            encryption: 'repokey',
            lastBackup: 'Never',
            size: 'Unknown',
            fileCount: 0,
            checkStatus: 'idle',
            lastCheckTime: 'Never'
          }],
          jobs: [],
          archives: [],
          activityLogs: [],
          connections: []
        });
      }
      if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
      if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
      if (channel === 'save-db') return Promise.resolve(true);
      return Promise.resolve(null);
    });

    listArchives.mockResolvedValue([
      { name: 'daily-2025-01-03', time: '2025-01-03T00:00:00.000Z' },
      { name: 'daily-2025-01-02', time: '2025-01-02T00:00:00.000Z' }
    ]);
    getDownloadsPath.mockResolvedValue('C:\\Users\\test\\Downloads');
    createDirectory.mockResolvedValue(true);
    extractFiles.mockResolvedValue(true);
    checkLockStatus.mockResolvedValue(false);
  });

  it('saves drill settings and records a successful manual recovery drill', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('dashboard-view')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /open repo details/i }));
    await waitFor(() => expect(screen.getByTestId('repo-details-view')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /save drill/i }));
    await waitFor(() => expect(screen.getByTestId('recovery-enabled')).toHaveTextContent('true'));
    expect(screen.getByTestId('recovery-sample-count')).toHaveTextContent('2');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /run drill/i }));
    });

    await waitFor(() => expect(extractFiles).toHaveBeenCalledWith(
      'ssh://user@example/./repo',
      'daily-2025-01-03',
      ['Documents/important.docx', 'Photos/family.jpg'],
      expect.stringContaining('WinBorg Recovery Drills'),
      expect.any(Function),
      expect.objectContaining({ repoId: 'repo-1' })
    ));

    await waitFor(() => expect(screen.getByTestId('recovery-status')).toHaveTextContent('success'));
    expect(screen.getByTestId('recovery-archive')).toHaveTextContent('daily-2025-01-03');
  });
});