import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import RepoDetailsView from './RepoDetailsView';

const openPath = vi.fn();
const listArchives = vi.fn();
const getArchiveInfo = vi.fn();

vi.mock('../services/borgService', () => ({
  borgService: {
    listArchives: (...args: any[]) => listArchives(...args),
    getArchiveInfo: (...args: any[]) => getArchiveInfo(...args),
    openPath: (...args: any[]) => openPath(...args),
  }
}));

vi.mock('../components/StorageChart', () => ({
  default: () => <div data-testid="storage-chart" />
}));

vi.mock('../components/ActivityHeatmap', () => ({
  default: () => <div data-testid="activity-heatmap" />
}));

describe('RepoDetailsView', () => {
  const repo: any = {
    id: 'repo-1',
    name: 'Repo One',
    url: 'ssh://user@example/./repo',
    trustHost: true,
    size: '10 GB',
    recoveryDrill: {
      enabled: true,
      autoRunAfterBackup: true,
      samplePaths: ['Documents/alpha.txt']
    },
    recoveryDrillState: {
      status: 'success',
      lastRunAt: '2025-01-01T12:00:00.000Z',
      lastArchiveName: 'daily-2025-01-01',
      lastDurationMs: 4200,
      lastVerifiedCount: 1,
      lastRestorePath: 'C:\\Recovery\\repo-1'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listArchives.mockResolvedValue([{ name: 'daily-2025-01-01', time: '2025-01-01T12:00:00.000Z' }]);
    getArchiveInfo.mockResolvedValue({
      originalSize: 100,
      compressedSize: 80,
      deduplicatedSize: 60
    });
  });

  it('saves recovery drill settings and runs a manual drill', async () => {
    const onSaveRecoveryDrill = vi.fn();
    const onRunRecoveryDrill = vi.fn();

    render(
      <RepoDetailsView
        repo={repo}
        onBack={vi.fn()}
        onSaveRecoveryDrill={onSaveRecoveryDrill}
        onRunRecoveryDrill={onRunRecoveryDrill}
      />
    );

    await waitFor(() => expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/recovery drill sample paths/i), {
      target: { value: 'Documents/alpha.txt\nPhotos/family.jpg' }
    });
    fireEvent.click(screen.getByRole('button', { name: /save drill settings/i }));

    expect(onSaveRecoveryDrill).toHaveBeenCalledWith('repo-1', {
      enabled: true,
      autoRunAfterBackup: true,
      samplePaths: ['Documents/alpha.txt', 'Photos/family.jpg']
    });

    fireEvent.click(screen.getByRole('button', { name: /run recovery drill/i }));
    expect(onRunRecoveryDrill).toHaveBeenCalledWith('repo-1');
  });

  it('opens the last recovery drill folder', async () => {
    render(
      <RepoDetailsView
        repo={repo}
        onBack={vi.fn()}
        onSaveRecoveryDrill={vi.fn()}
        onRunRecoveryDrill={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/recovery confidence/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /open last drill folder/i }));
    expect(openPath).toHaveBeenCalledWith('C:\\Recovery\\repo-1');
  });
});