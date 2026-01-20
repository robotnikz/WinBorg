import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import RepositoriesView from './RepositoriesView';
import { Repository } from '../types';
import { borgService } from '../services/borgService';

// Mock dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        initRepo: vi.fn(),
        testConnection: vi.fn(),
        testSshConnection: vi.fn(),
        checkBorgInstalledRemote: vi.fn(),
        runCommand: vi.fn(),
        savePassphrase: vi.fn(),
        deletePassphrase: vi.fn(),
        manageSSHKey: vi.fn(async (action: 'check' | 'generate' | 'read' | 'import') => {
            if (action === 'check') return { success: true, exists: false };
            if (action === 'read') return { success: true, key: '' };
            if (action === 'import') return { success: true };
            return { success: true };
        })
    }
}));

// Mock child components
vi.mock('../components/RepoCard', () => ({
    default: ({ repo, onConnect }: any) => (
        <div data-testid="repo-card">
            <span>{repo.name}</span>
            <button onClick={() => onConnect(repo)}>Connect Repo</button>
        </div>
    )
}));

describe('RepositoriesView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockRepos: Repository[] = [
        { id: '1', name: 'Repo A', url: 'ssh://alice@example.com:22/./a', lastBackup: 'never', encryption: 'none', status: 'connected', size: '10GB', fileCount: 100 },
        { id: '2', name: 'Repo B', url: 'ssh://bob@example.com:22/./b', lastBackup: '2025-01-01', encryption: 'repokey', status: 'disconnected', size: '5GB', fileCount: 50 }
    ];

    const defaultProps = {
        repos: mockRepos,
        jobs: [],
        connections: [{ id: 'c1', name: 'Test Connection', serverUrl: 'ssh://alice@example.com:2222' } as any],
        onAddRepo: vi.fn(),
        onEditRepo: vi.fn(),
        onConnect: vi.fn(),
        onMount: vi.fn(),
        onCheck: vi.fn(),
        onDelete: vi.fn(),
        onBreakLock: vi.fn(),
        onAddJob: vi.fn(),
        onUpdateJob: vi.fn(),
        onDeleteJob: vi.fn(),
        onRunJob: vi.fn()
    };

    it('renders list of repositories', () => {
        render(<RepositoriesView {...defaultProps} />);
        expect(screen.getAllByTestId('repo-card')).toHaveLength(2);
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.getByText('Repo B')).toBeInTheDocument();
    });

    it('opens add repository modal and shows Quick Start Templates', async () => {
        render(<RepositoriesView {...defaultProps} connections={[]} />);
        fireEvent.click(screen.getByText('Add Repository'));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Add Repository' })).toBeInTheDocument();
            expect(screen.getByText('Quick Start Templates')).toBeInTheDocument();
        });

        expect(screen.getByText('linux')).toBeInTheDocument();
    });

    it('adds a repository after a successful connection test', async () => {
        (borgService as any).testSshConnection.mockResolvedValue({ success: true });
        (borgService as any).checkBorgInstalledRemote.mockResolvedValue({ success: true, version: '1.2.3' });

        render(<RepositoriesView {...defaultProps} />);
        fireEvent.click(screen.getByText('Add Repository'));

        // Fill minimal required fields (SSH-only)
        fireEvent.change(screen.getByPlaceholderText('e.g. Work Backups'), { target: { value: 'SSH Repo' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. /home/user/backups/repo1'), { target: { value: '/./repo' } });

        // Run connection test
        fireEvent.click(await screen.findByRole('button', { name: /Test SSH & Remote Connection/i }));

        await waitFor(() => {
            expect((borgService as any).testSshConnection).toHaveBeenCalledWith('alice@example.com', '2222');
        });

        await screen.findByText(/Connection successful/i);

        // Avoid passphrase requirement by choosing no encryption for this test.
        const selects = screen.getAllByRole('combobox');
        const encryptionSelect = selects.find((el) => (el as HTMLSelectElement).value === 'repokey') ?? selects[0];
        fireEvent.change(encryptionSelect, { target: { value: 'none' } });

        // Connect should now be enabled
        fireEvent.click(screen.getByRole('button', { name: /^Connect$/i }));

        await waitFor(() => {
            expect(defaultProps.onAddRepo).toHaveBeenCalledTimes(1);
        });

        expect(defaultProps.onAddRepo).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'SSH Repo',
                url: 'ssh://alice@example.com:2222/./repo',
                connectionId: 'c1',
            })
        );
    });

    it('rejects non-SSH URLs (SSH-only repositories)', async () => {
        render(<RepositoriesView {...defaultProps} connections={[]} />);
        fireEvent.click(screen.getByText('Add Repository'));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Add Repository' })).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('e.g. Work Backups'), { target: { value: 'Bad Repo' } });
        fireEvent.change(screen.getByPlaceholderText('ssh://user@example.com:22'), { target: { value: 'C:\\Backups' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. /home/user/backups/repo1'), { target: { value: '/./repo' } });

        // SSH-only hint should be shown
        expect(screen.getByText(/SSH-only: please enter a valid ssh:\/\/ server URL\./i)).toBeInTheDocument();

        // Cannot test or connect with non-ssh URL
        expect(screen.queryByRole('button', { name: /Test SSH & Remote Connection/i })).not.toBeInTheDocument();
        const connectButton = screen.getByRole('button', { name: /^Connect$/i });
        expect(connectButton).toBeDisabled();
        expect(defaultProps.onAddRepo).not.toHaveBeenCalled();
    });

    it('filters repositories by search', () => {
        render(<RepositoriesView {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search...');
        fireEvent.change(searchInput, { target: { value: 'Repo A' } });
        
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.queryByText('Repo B')).not.toBeInTheDocument();
    });
});
