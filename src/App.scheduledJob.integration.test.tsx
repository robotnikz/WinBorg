import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import App from './App';

vi.mock('./components/TitleBar', () => ({ default: () => <div data-testid="titlebar" /> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast" /> }));
vi.mock('./components/UpdateModal', () => ({ default: () => null }));
vi.mock('./components/OnboardingModal', () => ({ default: () => null }));
vi.mock('./components/FuseSetupModal', () => ({ default: () => null }));

// Keep other views out of the way; this test exercises the real RepositoriesView (Connect button)
// together with App's background job listeners (job-started / job-complete from the main process).
vi.mock('./views/DashboardView', () => ({ default: () => <div data-testid="view-dashboard" /> }));
vi.mock('./views/MountsView', () => ({ default: () => <div data-testid="view-mounts" /> }));
vi.mock('./views/ActivityView', () => ({ default: () => <div data-testid="view-activity" /> }));
vi.mock('./views/SettingsView', () => ({ default: () => <div data-testid="view-settings" /> }));
vi.mock('./views/RepoDetailsView', () => ({ default: () => <div data-testid="view-repo-details" /> }));

// Minimal ArchivesView stub: shows which archives App currently holds in state.
vi.mock('./views/ArchivesView', () => ({
  default: ({ archives }: any) => (
    <ul data-testid="view-archives">
      {(archives || []).map((a: any) => (
        <li key={a.id ?? a.name}>{String(a.name)}</li>
      ))}
    </ul>
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
    warning: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    show: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
}));

const mockBorg = vi.hoisted(() => ({
  // App connect flow
  runCommand: vi.fn(),
  checkLockStatus: vi.fn(),
  getArchiveInfo: vi.fn(),

  // Safe defaults for other code paths touched by RepositoriesView / App startup.
  manageSSHKey: vi.fn(async () => ({ success: true, exists: false })),
  testConnection: vi.fn(),
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
  syncJobSchedules: vi.fn(async () => ({ success: true })),
  getJobScheduleStatuses: vi.fn(async () => ({ success: true, statuses: {} })),
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

const REPO_URL = 'ssh://user@example.com:22/./repo';

const listCalls = () =>
  mockBorg.runCommand.mock.calls.filter(([args]) => Array.isArray(args) && args[0] === 'list' && args.includes('--json'));

describe('App scheduled job completion (integration)', () => {
  let listeners: Record<string, (...args: any[]) => void>;
  let repoArchives: Array<{ id: string; name: string; time: string }>;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    Object.defineProperty(window, 'require', {
      value: mockRequire,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    // Capture the main -> renderer listeners App registers so tests can play the
    // main process ("a scheduled run just finished").
    listeners = {};
    mockIpcRenderer.on.mockImplementation((channel: string, cb: any) => {
      listeners[channel] = cb;
    });
    mockIpcRenderer.removeListener.mockImplementation((channel: string) => {
      delete listeners[channel];
    });

    mockIpcRenderer.invoke.mockImplementation((channel: string) => {
      if (channel === 'get-db') {
        return Promise.resolve({
          repos: [
            {
              id: 'repo-1',
              name: 'My Repo',
              url: REPO_URL,
              status: 'disconnected',
              lastBackup: 'Never',
              encryption: 'repokey',
              size: 'Unknown',
              fileCount: 0,
              trustHost: true,
            },
          ],
          jobs: [
            {
              id: 'job-1',
              repoId: 'repo-1',
              name: 'Docs',
              sourcePath: 'C:\\Docs',
              sourcePaths: ['C:\\Docs'],
              archivePrefix: 'docs',
              status: 'idle',
              scheduleEnabled: true,
            },
          ],
          archives: [],
          archivesRepoId: null,
          activityLogs: [],
          connections: [],
        });
      }
      if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
      if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
      return Promise.resolve(null);
    });

    // What `borg list --json` currently returns for the repo. A test appends to it to
    // simulate a scheduled run having created a new archive in the meantime.
    repoArchives = [{ id: 'a1', name: 'docs-2026-08-26-1000', time: '2026-08-26T10:00:00.000Z' }];

    mockBorg.checkLockStatus.mockResolvedValue(false);
    mockBorg.getArchiveInfo.mockResolvedValue({ size: '1MB', duration: '1s' });
    mockBorg.runCommand.mockImplementation(async (args: string[], onLog: (line: string) => void) => {
      if (args[0] === 'list' && args.includes('--json')) {
        onLog(JSON.stringify({ archives: repoArchives }));
        return true;
      }
      if (args[0] === 'info' && args.includes('--json')) {
        onLog(JSON.stringify({ repository: { stats: { unique_csize: 1024 ** 3, total_size: 2 * 1024 ** 3 } } }));
        return true;
      }
      return true;
    });

    // handleConnect schedules the archive stats (500ms) and repo stats (800ms) fetches.
    // Run those immediately so every connect settles inside the test instead of leaking
    // timers across tests. Leave 1000ms timers alone: Testing Library's waitFor uses them.
    const realSetTimeout = globalThis.setTimeout;
    setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: any, ms?: any, ...args: any[]) => {
      if (ms === 500 || ms === 800) {
        cb(...args);
        return 0 as any;
      }
      return realSetTimeout(cb, ms as any, ...args) as any;
    }) as any);
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  const connectRepo = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go to Repos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
    expect(listCalls()).toHaveLength(1);
  };

  const completeScheduledRun = async (success: boolean) => {
    expect(listeners['job-started']).toBeTypeOf('function');
    expect(listeners['job-complete']).toBeTypeOf('function');

    await act(async () => {
      listeners['job-started'](null, { jobId: 'job-1', repoId: 'repo-1', commandId: 'job-job-1-1' });
    });
    await act(async () => {
      listeners['job-complete'](null, { jobId: 'job-1', repoId: 'repo-1', commandId: 'job-job-1-1', success });
    });
  };

  it('reloads the archive list of the connected repo when a scheduled run succeeds', async () => {
    render(<App />);
    await connectRepo();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Archives' }));
    await waitFor(() => {
      expect(screen.getByText('docs-2026-08-26-1000')).toBeInTheDocument();
    });
    expect(screen.queryByText('docs-2026-08-27-1000')).not.toBeInTheDocument();

    // The scheduled run (internal scheduler or Task Scheduler handover) created a new
    // archive in the repo and the main process reports the run as finished.
    repoArchives.push({ id: 'a2', name: 'docs-2026-08-27-1000', time: '2026-08-27T10:00:00.000Z' });
    await completeScheduledRun(true);

    await waitFor(() => {
      expect(listCalls()).toHaveLength(2);
    });
    expect(listCalls()[1][0]).toEqual(['list', '--json', REPO_URL]);
    expect(listCalls()[1][2]).toEqual(expect.objectContaining({ repoId: 'repo-1' }));

    // The new archive shows up without the user pressing Refresh.
    await waitFor(() => {
      expect(screen.getByText('docs-2026-08-27-1000')).toBeInTheDocument();
    });
    expect(screen.getByText('docs-2026-08-26-1000')).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
  });

  it('does not reload the archive list when the scheduled run failed', async () => {
    render(<App />);
    await connectRepo();

    await completeScheduledRun(false);
    await act(async () => {
      await Promise.resolve();
    });

    expect(listCalls()).toHaveLength(1);
  });

  it('does not reload the archive list when the repo is not connected', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('view-dashboard')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(listeners['job-complete']).toBeTypeOf('function');
    });

    await completeScheduledRun(true);
    await act(async () => {
      await Promise.resolve();
    });

    // Nothing is listed for this repo yet, so there is nothing to refresh.
    expect(listCalls()).toHaveLength(0);
  });
});
