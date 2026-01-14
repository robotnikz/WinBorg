import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import App from './App';

// Mock Child Components to Isolate App Logic
vi.mock('./components/Sidebar', () => ({
    default: ({ currentView, onChangeView }: any) => (
        <div data-testid="sidebar">
            <button onClick={() => onChangeView('REPOSITORIES')}>Go to Repos</button>
            <button onClick={() => onChangeView('SETTINGS')}>Go to Settings</button>
        </div>
    )
}));
vi.mock('./components/TitleBar', () => ({
    default: () => (
        <div data-testid="titlebar">TitleBar</div>
    )
}));
vi.mock('./views/DashboardView', () => ({
    default: ({ toggleTheme, repos = [], jobs = [] }: any) => (
        <div data-testid="view-dashboard">
            Dashboard
            <button onClick={toggleTheme} title="Toggle Theme">Toggle Theme</button>
            <div data-testid="repos-props">
                {repos.map((r: any) => (
                    <div key={r.id} data-testid={`repo-${r.id}`}>
                        <span data-testid={`repo-${r.id}-backupStatus`}>{String(r.backupStatus ?? 'unset')}</span>
                        <span data-testid={`repo-${r.id}-activeCommandId`}>{String(r.activeBackupCommandId ?? '')}</span>
                    </div>
                ))}
            </div>
            <div data-testid="jobs-props">
                {jobs.map((j: any) => (
                    <div key={j.id} data-testid={`job-${j.id}`}>
                        <span data-testid={`job-${j.id}-status`}>{String(j.status ?? 'unset')}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}));
vi.mock('./views/RepositoriesView', () => ({ default: () => <div data-testid="view-repos">Repositories</div> }));
vi.mock('./views/MountsView', () => ({ default: () => <div data-testid="view-mounts">Mounts</div> }));
vi.mock('./views/SettingsView', () => ({ default: () => <div data-testid="view-settings">Settings</div> }));
vi.mock('./views/ActivityView', () => ({ default: () => <div data-testid="view-activity">Activity</div> }));
vi.mock('./views/ArchivesView', () => ({ default: () => <div data-testid="view-archives">Archives</div> }));
vi.mock('./components/OnboardingModal', () => ({ default: () => <div data-testid="onboarding-modal">Onboarding</div> }));
vi.mock('./components/ToastContainer', () => ({ ToastContainer: () => <div data-testid="toast-container" /> }));

// Constants
const mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    send: vi.fn()
};

// Mock Electron
const mockRequire = vi.fn((module) => {
    if (module === 'electron') return { ipcRenderer: mockIpcRenderer };
    return {};
});

describe('App', () => {
    let listeners: Record<string, any>;

    beforeAll(() => {
        Object.defineProperty(window, 'require', {
            value: mockRequire,
            writable: true
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();

        listeners = {};
        mockIpcRenderer.on.mockImplementation((channel: string, cb: any) => {
            listeners[channel] = cb;
        });
        mockIpcRenderer.removeListener.mockImplementation((channel: string) => {
            delete listeners[channel];
        });
        
        // Default Mock Responses
        mockIpcRenderer.invoke.mockImplementation((channel) => {
            if (channel === 'get-db') return Promise.resolve({ repos: [], jobs: [], archives: [], activityLogs: [] });
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve(null);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders loading state initially', async () => {
        render(<App />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        // Wait for connection initial loads to settle to avoid act warnings
        await waitFor(() => expect(mockIpcRenderer.invoke).toHaveBeenCalled());
    });

    it('loads data from backend on mount', async () => {
        const dbData = {
            repos: [{ id: '1', name: 'Repo1' }],
            jobs: [],
            archives: [],
            activityLogs: []
        };
        mockIpcRenderer.invoke.mockResolvedValueOnce(dbData); // get-db

        render(<App />);

        await waitFor(() => {
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-db');
        });
    });

    it('handles legacy migration from localStorage', async () => {
        // Empty DB
        mockIpcRenderer.invoke.mockImplementation((c) => {
            if (c === 'get-db') return Promise.resolve({ repos: [], jobs: [] });
            if (c === 'system-check-wsl') return Promise.resolve({ installed: true });
            return Promise.resolve({ success: true });
        });

        // Setup LocalStorage
        const legacyRepo = [{ id: 'legacy', name: 'LegacyRepo', passphrase: 'plain' }];
        window.localStorage.setItem('winborg_repos', JSON.stringify(legacyRepo));

        render(<App />);

        await waitFor(() => {
            // Should call save-db with migrated data
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-db', expect.objectContaining({
                repos: expect.arrayContaining([
                    expect.objectContaining({ id: 'legacy', name: 'LegacyRepo' })
                ])
            }));
            // Also ensure system checks are called to clean up promises
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('system-check-wsl');
        });
    });

    it('migrates legacy jobs to multi-source format', async () => {
        // Empty DB
        mockIpcRenderer.invoke.mockImplementation((c) => {
            if (c === 'get-db') return Promise.resolve({ repos: [], jobs: [] });
            if (c === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (c === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve({ success: true });
        });

        window.localStorage.setItem('winborg_jobs', JSON.stringify([
            {
                id: 'job1',
                repoId: 'r1',
                name: 'Job 1',
                sourcePath: 'C:\\Data',
                archivePrefix: 'job',
                lastRun: 'Never',
                status: 'idle',
                compression: 'zstd',
                pruneEnabled: false,
                keepDaily: 0,
                keepWeekly: 0,
                keepMonthly: 0,
                keepYearly: 0,
                scheduleEnabled: false,
                scheduleType: 'manual',
                scheduleTime: '00:00'
            }
        ]));

        render(<App />);

        await waitFor(() => {
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('save-db', expect.objectContaining({
                jobs: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'job1',
                        sourcePath: 'C:\\Data',
                        sourcePaths: ['C:\\Data']
                    })
                ])
            }));
        });
    });

    it('toggles theme correctly', async () => {
        render(<App />);

        // Ensure initial loading finished so the mocked DashboardView is mounted
        await waitFor(() => expect(screen.getByTestId('view-dashboard')).toBeInTheDocument());

        const toggleBtn = await screen.findByRole('button', { name: /toggle theme/i });

        const wasDark = document.documentElement.classList.contains('dark');
        fireEvent.click(toggleBtn);
        await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(!wasDark));

        fireEvent.click(toggleBtn);
        await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(wasDark));
    });

    it('navigates between views', async () => {
        render(<App />);
        await waitFor(() => screen.getByTestId('view-dashboard'));

        const reposBtn = screen.getByText('Go to Repos');
        fireEvent.click(reposBtn);
        expect(screen.getByTestId('view-repos')).toBeInTheDocument();

        const settingsBtn = screen.getByText('Go to Settings');
        fireEvent.click(settingsBtn);
        expect(screen.getByTestId('view-settings')).toBeInTheDocument();
    });

    it('shows onboarding modal if system checks fail', async () => {
        mockIpcRenderer.invoke.mockImplementation((c) => {
             if (c === 'get-db') return Promise.resolve({ repos: [], jobs: [] });
               if (c === 'system-check-wsl') return Promise.resolve({ installed: false });
               if (c === 'system-check-borg') return Promise.resolve({ installed: false });
             return Promise.resolve(null);
        });

        render(<App />);

        await waitFor(() => {
            expect(screen.getByTestId('onboarding-modal')).toBeInTheDocument();
        });
    });

    it('updates repo backup state from scheduled job IPC payloads', async () => {
        const t0 = 1735689600000; // 2025-01-01T00:00:00.000Z
        const t1 = t0 + 5000;
        const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => t0);

        mockIpcRenderer.invoke.mockImplementation((channel) => {
            if (channel === 'get-db') {
                return Promise.resolve({
                    repos: [{ id: 'r1', name: 'Repo1' }],
                    jobs: [{ id: 'j1', repoId: 'r1', name: 'Job 1', status: 'idle' }],
                    archives: [],
                    activityLogs: []
                });
            }
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve(null);
        });

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('view-dashboard')).toBeInTheDocument());

        expect(listeners['job-started']).toBeTypeOf('function');
        expect(listeners['job-complete']).toBeTypeOf('function');

        await act(async () => {
            listeners['job-started'](null, { jobId: 'j1', repoId: 'r1', commandId: 'job-j1-123' });
        });

        expect(screen.getByTestId('job-j1-status')).toHaveTextContent('running');
        expect(screen.getByTestId('repo-r1-backupStatus')).toHaveTextContent('running');
        expect(screen.getByTestId('repo-r1-activeCommandId')).toHaveTextContent('job-j1-123');

        nowSpy.mockImplementation(() => t1);

        await act(async () => {
            listeners['job-complete'](null, { jobId: 'j1', repoId: 'r1', commandId: 'job-j1-123', success: true });
        });

        expect(screen.getByTestId('job-j1-status')).toHaveTextContent('success');
        expect(screen.getByTestId('repo-r1-backupStatus')).toHaveTextContent('idle');

        const raw = window.localStorage.getItem('winborg_backup_duration_ms');
        expect(raw).toBeTruthy();
        const parsed = raw ? JSON.parse(raw) : {};
        expect(parsed.r1).toBe(5000);

        nowSpy.mockRestore();
    });

    it('still supports legacy job-started payload (jobId string)', async () => {
        mockIpcRenderer.invoke.mockImplementation((channel) => {
            if (channel === 'get-db') {
                return Promise.resolve({
                    repos: [{ id: 'r1', name: 'Repo1' }],
                    jobs: [{ id: 'j1', repoId: 'r1', name: 'Job 1', status: 'idle' }],
                    archives: [],
                    activityLogs: []
                });
            }
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve(null);
        });

        render(<App />);
        await waitFor(() => expect(screen.getByTestId('view-dashboard')).toBeInTheDocument());

        await act(async () => {
            listeners['job-started'](null, 'j1');
        });

        expect(screen.getByTestId('job-j1-status')).toHaveTextContent('running');
        // Legacy payload doesn't provide repo context, so repo backup state remains untouched.
        expect(screen.getByTestId('repo-r1-backupStatus')).toHaveTextContent('unset');
    });
});
