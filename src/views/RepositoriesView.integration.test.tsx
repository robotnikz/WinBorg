import { render, screen, fireEvent } from '@testing-library/react';

import RepositoriesView from './RepositoriesView';
import type { Repository } from '../types';

// Keep borg service minimal; this test focuses on UI wiring.
vi.mock('../services/borgService', () => ({
  borgService: {
    manageSSHKey: vi.fn(async () => ({ success: true, exists: true })),
  },
}));

// Stub heavy modals used by RepositoriesView so the integration test stays deterministic.
vi.mock('../components/MaintenanceModal', () => ({ default: () => null }));
vi.mock('../components/KeyExportModal', () => ({ default: () => null }));
vi.mock('../components/DeleteRepoModal', () => ({ default: () => null }));

vi.mock('../components/CreateBackupModal', () => ({
  default: ({ isOpen, initialRepo }: any) =>
    isOpen ? (
      <div data-testid="create-backup-modal">CreateBackupModal for {initialRepo?.id}</div>
    ) : null,
}));

vi.mock('../components/JobsModal', () => ({
  default: ({ repo, isOpen }: any) =>
    isOpen ? <div data-testid="jobs-modal">JobsModal for {repo?.id}</div> : null,
}));

// TerminalModal only renders when logs exist; keep it inert.
vi.mock('../components/TerminalModal', () => ({ default: () => null }));

describe('RepositoriesView (integration wiring)', () => {
  const connectedRepo: Repository = {
    id: 'r1',
    name: 'Repo1',
    url: 'ssh://user@host/./repo',
    status: 'connected',
    lastBackup: 'Never',
    encryption: 'repokey',
    size: 'Unknown',
    fileCount: 0,
    isLocked: true,
  };

  const baseProps = {
    repos: [connectedRepo],
    jobs: [],
    connections: [],
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
    onRunJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens Jobs modal from RepoCard quick action', () => {
    render(<RepositoriesView {...baseProps} />);

    fireEvent.click(screen.getByTitle('Create First Job'));

    expect(screen.getByTestId('jobs-modal')).toHaveTextContent('JobsModal for r1');
  });

  it('opens CreateBackup modal from RepoCard quick action', () => {
    render(<RepositoriesView {...baseProps} />);

    fireEvent.click(screen.getByTitle('Create a One-off Snapshot now'));

    expect(screen.getByTestId('create-backup-modal')).toHaveTextContent('CreateBackupModal for r1');
  });

  it('wires Unlock and Mount actions through to handlers', () => {
    render(<RepositoriesView {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Unlock/i }));
    expect(baseProps.onBreakLock).toHaveBeenCalledTimes(1);
    expect(baseProps.onBreakLock).toHaveBeenCalledWith(connectedRepo);

    fireEvent.click(screen.getByRole('button', { name: 'Mount' }));
    expect(baseProps.onMount).toHaveBeenCalledTimes(1);
    expect(baseProps.onMount).toHaveBeenCalledWith(connectedRepo);
  });
});
