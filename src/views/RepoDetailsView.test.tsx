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

vi.mock('../components/ArchiveBrowserModal', () => ({
  default: ({ isOpen, archive, onUsePaths }: any) =>
    isOpen ? (
      <div data-testid="archive-browser-modal">
        <span>browsing {archive?.name}</span>
        <button onClick={() => onUsePaths(['mnt/d/Project/info.yaml', 'Documents/alpha.txt'])}>
          mock-use-paths
        </button>
      </div>
    ) : null
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

  it('picks paths from an archive and merges them without duplicates', async () => {
    render(
      <RepoDetailsView
        repo={repo}
        onBack={vi.fn()}
        onSaveRecoveryDrill={vi.fn()}
        onRunRecoveryDrill={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /choose from archive/i }));

    // Latest archive is loaded and handed to the browser
    await waitFor(() => expect(screen.getByTestId('archive-browser-modal')).toBeInTheDocument());
    expect(listArchives).toHaveBeenCalled();
    expect(screen.getByText(/browsing daily-2025-01-01/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('mock-use-paths'));

    // Existing 'Documents/alpha.txt' is kept once; new archive path is appended
    const textarea = screen.getByLabelText(/recovery drill sample paths/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Documents/alpha.txt\nmnt/d/Project/info.yaml');
  });

  it('warns when a Windows-style path is entered', async () => {
    render(
      <RepoDetailsView
        repo={repo}
        onBack={vi.fn()}
        onSaveRecoveryDrill={vi.fn()}
        onRunRecoveryDrill={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument());

    expect(screen.queryByText(/looks like a local Windows path/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/recovery drill sample paths/i), {
      target: { value: 'D:\\Project\\Name\\info.yaml' }
    });

    expect(screen.getByText(/looks like a local Windows path/i)).toBeInTheDocument();
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