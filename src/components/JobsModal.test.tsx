import { render, screen, fireEvent } from '@testing-library/react';
import { waitFor } from '@testing-library/react';

import JobsModal from './JobsModal';

vi.mock('../services/borgService', () => ({
  borgService: {
    selectDirectory: vi.fn().mockResolvedValue(['C:\\Temp']),
    getJobScheduleStatuses: vi.fn().mockResolvedValue({ success: true, statuses: {} }),
  },
}));

const { borgService } = await import('../services/borgService');

describe('JobsModal', () => {
  it('creates a job and calls onAddJob with expected fields', async () => {
    const onAddJob = vi.fn().mockResolvedValue(true);

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

    await waitFor(() => expect(onAddJob).toHaveBeenCalledTimes(1));

    const jobArg = onAddJob.mock.calls[0][0];

    expect(jobArg.repoId).toBe('repo1');
    expect(jobArg.name).toBe('Docs');
    expect(jobArg.archivePrefix).toBe('docs');
    expect(jobArg.sourcePaths).toEqual(['C:\\Temp']);
    // legacy field still populated
    expect(jobArg.sourcePath).toBe('C:\\Temp');
  });

  it('shows time controls for hourly and weekday plus time controls for weekly schedules', async () => {
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
        onAddJob={() => {}}
        onUpdateJob={() => {}}
        onDeleteJob={() => {}}
        onRunJob={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create First Job' }));
    fireEvent.click(screen.getByRole('button', { name: /Schedule/i }));
    fireEvent.click(screen.getByLabelText('Enable Schedule'));

    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'hourly' } });
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
    expect(screen.getByText(/Runs once per hour at the selected minute/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'weekly' } });
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Time')).toBeInTheDocument();
  });

  it('stores the Windows Task Scheduler backend when the checkbox is enabled', async () => {
    const onAddJob = vi.fn().mockResolvedValue(true);

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
    expect(await screen.findByText('C:\\Temp')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('e.g. docs'), { target: { value: 'docs' } });

    fireEvent.click(screen.getByRole('button', { name: /Schedule/i }));
    fireEvent.click(screen.getByLabelText('Enable Schedule'));
    fireEvent.click(screen.getByLabelText('Use Windows Task Scheduler'));

    fireEvent.click(screen.getByRole('button', { name: 'Save Job' }));

    await waitFor(() => expect(onAddJob).toHaveBeenCalledTimes(1));
    expect(onAddJob.mock.calls[0][0].scheduleBackend).toBe('windows-task-scheduler');
  });

  it('shows Windows Task status for existing external scheduler jobs', async () => {
    vi.mocked(borgService.getJobScheduleStatuses).mockResolvedValueOnce({
      success: true,
      statuses: {
        'job-1': {
          success: true,
          exists: true,
          taskName: 'WinBorg-Docs-job-1',
        },
      },
    });

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
        jobs={[{
          id: 'job-1',
          repoId: 'repo1',
          name: 'Docs',
          archivePrefix: 'docs',
          sourcePath: 'C:\\Temp',
          sourcePaths: ['C:\\Temp'],
          compression: 'zstd',
          excludePatterns: [],
          pruneEnabled: false,
          keepDaily: 7,
          keepWeekly: 4,
          keepMonthly: 6,
          keepYearly: 1,
          status: 'idle',
          lastRun: 'Never',
          scheduleEnabled: true,
          scheduleType: 'daily',
          scheduleTime: '14:00',
          scheduleBackend: 'windows-task-scheduler',
          scheduleTaskLastSyncedAt: '2026-01-13T12:00:00.000Z',
        }] as any}
        isOpen={true}
        onClose={() => {}}
        onAddJob={() => {}}
        onUpdateJob={() => {}}
        onDeleteJob={() => {}}
        onRunJob={() => {}}
      />
    );

    expect(await screen.findByText('Windows Task Present')).toBeInTheDocument();
    expect(screen.getByText(/Task synced:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Job' }));
    fireEvent.click(screen.getByRole('button', { name: /Schedule/i }));

    expect(await screen.findByText('Current Windows Task Status')).toBeInTheDocument();
    expect(screen.getByText('Task name: WinBorg-Docs-job-1')).toBeInTheDocument();
  });
});
