import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import JobsModal from './JobsModal';

vi.mock('../services/borgService', () => ({
  borgService: {
    selectDirectory: vi.fn().mockResolvedValue(['C:\\Temp']),
  },
}));

describe('JobsModal', () => {
  it('creates a job and calls onAddJob with expected fields', async () => {
    const onAddJob = vi.fn();

    render(
      <JobsModal
        repo={{
          id: 'repo1',
          name: 'My Repo',
          url: 'ssh://user@example.com:22/./repo',
          status: 'connected',
          lastBackup: 'Never',
          size: 'Unknown',
          fileCount: 0,
          encryption: 'repokey',
        } as any}
        jobs={[]}
        isOpen={true}
        onClose={() => {}}
        onAddJob={onAddJob}
        onUpdateJob={() => {}}
        onDeleteJob={() => {}}
        onRunJob={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create First Job' }));

    fireEvent.change(screen.getByPlaceholderText('e.g. My Documents'), { target: { value: 'Docs' } });

    fireEvent.click(screen.getByRole('button', { name: /Add Folder/i }));

    // Wait for folder to appear in the list.
    expect(await screen.findByText('C:\\Temp')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. docs'), { target: { value: 'docs' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Job' }));

    expect(onAddJob).toHaveBeenCalledTimes(1);
    const jobArg = onAddJob.mock.calls[0][0];

    expect(jobArg.repoId).toBe('repo1');
    expect(jobArg.name).toBe('Docs');
    expect(jobArg.archivePrefix).toBe('docs');
    expect(jobArg.sourcePaths).toEqual(['C:\\Temp']);
    // legacy field still populated
    expect(jobArg.sourcePath).toBe('C:\\Temp');
  });
});
