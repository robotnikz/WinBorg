import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RepositoriesView from './RepositoriesView';
import { Repository, BackupJob } from '../types';

// Mock dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        initRepo: vi.fn(),
        testConnection: vi.fn(),
        runCommand: vi.fn()
    }
}));

// Mock child components to avoid deep rendering issues and speed up tests
// We keep it simple to verify passing props
vi.mock('../components/RepoCard', () => ({
    default: ({ repo, onConnect, onCheck }: any) => (
        <div data-testid="repo-card">
            <span>{repo.name}</span>
            <button onClick={() => onConnect(repo)}>Connect</button>
            <button onClick={() => onCheck(repo)}>Check</button>
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
        onDeleteJob: vi.fn(),
        onRunJob: vi.fn()
    };

    it('renders list of repositories', () => {
        render(<RepositoriesView {...defaultProps} />);
        expect(screen.getAllByTestId('repo-card')).toHaveLength(2);
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.getByText('Repo B')).toBeInTheDocument();
    });

    it('filters repositories by search', () => {
        render(<RepositoriesView {...defaultProps} />);
        const searchInput = screen.getByPlaceholderText('Search repositories...');
        fireEvent.change(searchInput, { target: { value: 'Repo A' } });
        
        expect(screen.getByText('Repo A')).toBeInTheDocument();
        expect(screen.queryByText('Repo B')).not.toBeInTheDocument();
    });

    it('opens add repository modal', () => {
        render(<RepositoriesView {...defaultProps} />);
        fireEvent.click(screen.getByText('Add Repository'));
        expect(screen.getByRole('button', { name: /Connect Existing/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Add Repository' })).toBeInTheDocument();
    });

    it('calls onConnect when connect button clicked in card', () => {
        render(<RepositoriesView {...defaultProps} />);
        const cards = screen.getAllByTestId('repo-card');
        const connectBtn = cards[0].querySelector('button');
        if (connectBtn) fireEvent.click(connectBtn);
        
        expect(defaultProps.onConnect).toHaveBeenCalledWith(mockRepos[0]);
    });
});
