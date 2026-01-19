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
        manageSSHKey: vi.fn(async (action: 'check' | 'generate' | 'read') => {
            if (action === 'check') return { success: true, exists: false };
            if (action === 'read') return { success: true, key: '' };
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
    const mockRepos: Repository[] = [
        { id: '1', name: 'Repo A', url: '/tmp/a', lastBackup: 'never', encryption: 'none', status: 'connected', size: '10GB', fileCount: 100 },
        { id: '2', name: 'Repo B', url: '/tmp/b', lastBackup: '2025-01-01', encryption: 'repokey', status: 'disconnected', size: '5GB', fileCount: 50 }
    ];

    const defaultProps = {
        repos: mockRepos,
        jobs: [],
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
        render(<RepositoriesView {...defaultProps} />);
        fireEvent.click(screen.getByText('Add Repository'));

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Add Repository' })).toBeInTheDocument();
            expect(screen.getByText('Quick Start Templates')).toBeInTheDocument();
        });

        // The modal triggers async SSH key checks; await them so React state updates are flushed.
        await waitFor(() => {
            expect((borgService as any).manageSSHKey).toHaveBeenCalled();
        });

        expect(screen.getByText('linux')).toBeInTheDocument();
    });

    it('adds a repository after a successful connection test', async () => {
        (borgService as any).testConnection.mockResolvedValue(true);

        render(<RepositoriesView {...defaultProps} />);
        fireEvent.click(screen.getByText('Add Repository'));

        // Fill minimal required fields (local path style)
        fireEvent.change(screen.getByPlaceholderText('e.g. Work Backups'), { target: { value: 'Local Repo' } });
        fireEvent.change(screen.getByPlaceholderText('ssh://user@example.com:22'), { target: { value: 'C:\\Backups' } });

        // Run connection test
        fireEvent.click(await screen.findByRole('button', { name: /Test Connection/i }));

        await waitFor(() => {
            expect((borgService as any).testConnection).toHaveBeenCalledWith(
                'C:\\Backups',
                expect.any(Function),
                expect.any(Object)
            );
        });

        await screen.findByText(/Connection successful/i);

        // Avoid passphrase requirement by choosing no encryption for this test.
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'none' } });

        // Connect should now be enabled
        fireEvent.click(screen.getByRole('button', { name: /^Connect$/i }));

        await waitFor(() => {
            expect(defaultProps.onAddRepo).toHaveBeenCalledTimes(1);
        });

        expect(defaultProps.onAddRepo).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Local Repo',
                url: 'C:\\Backups',
            })
        );
    });

    it('filters repositories by search', () => {
        render(<RepositoriesView {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search...');
        fireEvent.change(searchInput, { target: { value: 'Repo A' } });
        
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.queryByText('Repo B')).not.toBeInTheDocument();
    });
});
