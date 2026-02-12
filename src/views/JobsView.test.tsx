import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import JobsView from './JobsView';
import { BackupJob, Repository, View } from '../types';

vi.mock('../components/Button', () => ({
  default: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} data-testid="mock-button" {...props}>
      {children}
    </button>
  ),
}));

describe('JobsView', () => {
  const handlers = {
    onChangeView: vi.fn(),
    onAddJob: vi.fn(),
    onUpdateJob: vi.fn(),
    onDeleteJob: vi.fn(),
    onRunJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows "Create First Job" CTA for repos with 0 jobs and opens modal in create view', () => {
    const repo: Repository = {
      id: 'r1',
      name: 'Repo One',
      url: '/path/to/repo',
      encryption: 'none',
      status: 'connected',
      checkStatus: 'idle',
      lastBackup: null,
      size: '0 B',
      fileCount: 0,
    };

    render(
      <JobsView
        repos={[repo]}
        jobs={[]}
        {...handlers}
        onChangeView={(view: View) => handlers.onChangeView(view)}
      />
    );

    const cta = screen.getByRole('button', { name: /Create First Job/i });
    fireEvent.click(cta);

    expect(screen.getByRole('dialog', { name: /Jobs for Repo One/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Job/i })).toBeInTheDocument();
  });

  test('shows "Manage Jobs" CTA for repos with existing jobs', () => {
    const repo: Repository = {
      id: 'r1',
      name: 'Repo One',
      url: '/path/to/repo',
      encryption: 'none',
      status: 'connected',
      checkStatus: 'idle',
      lastBackup: null,
      size: '0 B',
      fileCount: 0,
    };

    const job: BackupJob = {
      id: 'j1',
      repoId: 'r1',
      name: 'Daily',
      sourcePath: 'C:\\',
      sourcePaths: ['C:\\'],
      archivePrefix: 'daily',
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
      scheduleTime: '00:00',
    };

    render(
      <JobsView
        repos={[repo]}
        jobs={[job]}
        {...handlers}
        onChangeView={(view: View) => handlers.onChangeView(view)}
      />
    );

    expect(screen.getByRole('button', { name: /Manage Jobs/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create First Job/i })).not.toBeInTheDocument();
  });
});
