import { render, screen, fireEvent } from '@testing-library/react';

import RepoCard from './RepoCard';

describe('RepoCard', () => {
  const baseRepo: any = {
    id: 'repo1',
    name: 'Repo One',
    url: 'ssh://user@host/./repo',
    status: 'connected',
    lastBackup: 'Never',
    encryption: 'repokey',
    size: '10GB',
    fileCount: 123,
    isLocked: true,
  };

  it('wires up Unlock/Edit/Jobs/One-off Backup actions', () => {
    const onBreakLock = vi.fn();
    const onEdit = vi.fn();
    const onManageJobs = vi.fn();
    const onBackup = vi.fn();

    render(
      <RepoCard
        repo={baseRepo}
        jobs={[]}
        onBreakLock={onBreakLock}
        onEdit={onEdit}
        onManageJobs={onManageJobs}
        onBackup={onBackup}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Unlock/i }));
    expect(onBreakLock).toHaveBeenCalledTimes(1);
    expect(onBreakLock).toHaveBeenCalledWith(baseRepo);

    fireEvent.click(screen.getByTitle('Edit Connection Settings'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(baseRepo);

    fireEvent.click(screen.getByTitle('Create First Job'));
    expect(onManageJobs).toHaveBeenCalledTimes(1);
    expect(onManageJobs).toHaveBeenCalledWith(baseRepo, 'create');

    fireEvent.click(screen.getByTitle('Create a One-off Snapshot now'));
    expect(onBackup).toHaveBeenCalledTimes(1);
    expect(onBackup).toHaveBeenCalledWith(baseRepo);
  });

  it('does not show Jobs/Backup quick buttons when disconnected', () => {
    render(
      <RepoCard
        repo={{ ...baseRepo, status: 'disconnected' }}
        jobs={[]}
        onManageJobs={vi.fn()}
        onBackup={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Create First Job')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Create a One-off Snapshot now')).not.toBeInTheDocument();
  });

  it('shows recovery confidence when a drill is configured', () => {
    render(
      <RepoCard
        repo={{
          ...baseRepo,
          recoveryDrill: { enabled: true, autoRunAfterBackup: false, samplePaths: ['Documents/important.docx'] },
          recoveryDrillState: {
            status: 'success',
            lastRunAt: new Date().toISOString(),
            lastVerifiedCount: 1,
            lastArchiveName: 'archive-1'
          }
        }}
        jobs={[]}
      />
    );

    expect(screen.getByText(/recovery verified/i)).toBeInTheDocument();
  });
});
