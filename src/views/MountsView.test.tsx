import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import MountsView, { ALL_ARCHIVES_VALUE } from './MountsView';

vi.mock('../components/Button', () => ({
  default: ({ children, onClick, ...props }: any) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('MountsView', () => {
  const send = vi.fn();
  const invoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'get-preferred-wsl-distro') return Promise.resolve('Ubuntu');
    return Promise.resolve(null);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        send,
        invoke,
      },
    }));
  });

  it('converts WSL paths to \\wsl.localhost UNC when opening folder', async () => {
    render(
      <MountsView
        mounts={[
          {
            id: 'm1',
            repoId: 'r1',
            archiveName: 'a1',
            localPath: '/mnt/wsl/winborg/a1',
          } as any,
        ]}
        repos={[{ id: 'r1', name: 'Repo1', status: 'connected' } as any]}
        archives={[]}
        archivesRepoId={'r1'}
        onUnmount={() => {}}
        onMount={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Folder/i }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledTimes(1);
    });
    expect(send).toHaveBeenCalledWith(
      'open-path',
      '\\\\wsl.localhost\\Ubuntu\\mnt\\wsl\\winborg\\a1'
    );
  });

  it('does not convert non-WSL paths when opening folder', () => {
    render(
      <MountsView
        mounts={[
          {
            id: 'm1',
            repoId: 'r1',
            archiveName: 'a1',
            localPath: 'Z:',
          } as any,
        ]}
        repos={[{ id: 'r1', name: 'Repo1', status: 'connected' } as any]}
        archives={[]}
        archivesRepoId={'r1'}
        onUnmount={() => {}}
        onMount={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Folder/i }));

    expect(send).toHaveBeenCalledWith('open-path', 'Z:');
  });

  it('calls onUnmount when Unmount is clicked', () => {
    const onUnmount = vi.fn();

    render(
      <MountsView
        mounts={[
          {
            id: 'm1',
            repoId: 'r1',
            archiveName: 'a1',
            localPath: '/mnt/wsl/winborg/a1',
          } as any,
        ]}
        repos={[{ id: 'r1', name: 'Repo1', status: 'connected' } as any]}
        archives={[]}
        archivesRepoId={'r1'}
        onUnmount={onUnmount}
        onMount={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Unmount/i }));
    expect(onUnmount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledWith('m1');
  });

  it('mounts with sanitized WSL path by default', () => {
    const onMount = vi.fn();

    // default: localStorage winborg_use_wsl not set => true
    render(
      <MountsView
        mounts={[]}
        repos={[{ id: 'r1', name: 'Repo1', status: 'connected', url: 'ssh://x' } as any]}
        archives={[{ id: 'a1', name: 'my archive (1)', time: 'now' } as any]}
        archivesRepoId={'r1'}
        onUnmount={() => {}}
        onMount={onMount}
      />
    );

    // Open creation panel
    fireEvent.click(screen.getByRole('button', { name: /New Mount/i }));

    // Trigger mount
    fireEvent.click(screen.getByRole('button', { name: /Mount Archive/i }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onMount).toHaveBeenCalledWith('r1', 'my archive (1)', '/mnt/wsl/winborg/my_archive__1_');
  });

  describe('mount all archives', () => {
    const repo = { id: 'r1', name: 'Repo1', status: 'connected', url: 'ssh://user@host/./repo' } as any;
    const archives = [
      { id: 'a1', name: 'daily-2026-01-03', time: '2026-01-03' },
      { id: 'a2', name: 'daily-2026-01-02', time: '2026-01-02' },
    ] as any[];

    const renderCreating = (props: Partial<React.ComponentProps<typeof MountsView>> = {}) => {
      const onMount = vi.fn();
      const utils = render(
        <MountsView
          mounts={[]}
          repos={[repo]}
          archives={archives}
          archivesRepoId={'r1'}
          onUnmount={() => {}}
          onMount={onMount}
          {...props}
        />
      );
      if (!screen.queryByText('Mount Configuration')) {
        fireEvent.click(screen.getByRole('button', { name: /New Mount/i }));
      }
      const archiveSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
      return { ...utils, onMount: (props.onMount as any) || onMount, archiveSelect };
    };

    it('offers "All archives" first but keeps the newest archive selected by default', () => {
      const { archiveSelect } = renderCreating();

      const options = Array.from(archiveSelect.options);
      expect(options[0].value).toBe(ALL_ARCHIVES_VALUE);
      expect(options[0].textContent).toContain('All archives (2)');
      expect(options.slice(1).map((o) => o.value)).toEqual(['daily-2026-01-03', 'daily-2026-01-02']);
      expect(archiveSelect.value).toBe('daily-2026-01-03');
      expect(screen.getByRole('button', { name: 'Mount Archive' })).toBeInTheDocument();
      expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });

    it('previews and mounts the whole repository without an archive name', () => {
      const { archiveSelect, onMount } = renderCreating();

      fireEvent.change(archiveSelect, { target: { value: ALL_ARCHIVES_VALUE } });

      expect(screen.getByText('borg mount -o allow_other ssh://user@host/./repo /mnt/wsl/winborg/all-archives-Repo1')).toBeInTheDocument();
      expect(screen.getByText('/mnt/wsl/winborg/all-archives-Repo1')).toBeInTheDocument();
      expect(screen.getByRole('note')).toHaveTextContent('Every archive appears as its own folder');

      fireEvent.click(screen.getByRole('button', { name: 'Mount All Archives' }));

      expect(onMount).toHaveBeenCalledTimes(1);
      expect(onMount).toHaveBeenCalledWith('r1', null, '/mnt/wsl/winborg/all-archives-Repo1');
      // The configuration panel closes after mounting.
      expect(screen.queryByText('Mount Configuration')).not.toBeInTheDocument();
    });

    it('keeps "All archives" selected when the archive list refreshes', () => {
      const onMount = vi.fn();
      const { archiveSelect, rerender } = renderCreating({ onMount });
      fireEvent.change(archiveSelect, { target: { value: ALL_ARCHIVES_VALUE } });

      rerender(
        <MountsView
          mounts={[]}
          repos={[repo]}
          archives={[{ id: 'a0', name: 'daily-2026-01-04', time: '2026-01-04' } as any, ...archives]}
          archivesRepoId={'r1'}
          onUnmount={() => {}}
          onMount={onMount}
        />
      );

      expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe(ALL_ARCHIVES_VALUE);
      expect(screen.getAllByRole('combobox')[1].querySelector('option')?.textContent).toContain('All archives (3)');
      fireEvent.click(screen.getByRole('button', { name: 'Mount All Archives' }));
      expect(onMount).toHaveBeenCalledWith('r1', null, '/mnt/wsl/winborg/all-archives-Repo1');
    });

    it('still mounts a single archive as before', () => {
      const { archiveSelect, onMount } = renderCreating();

      fireEvent.change(archiveSelect, { target: { value: 'daily-2026-01-02' } });
      expect(screen.getByText('borg mount -o allow_other ssh://user@host/./repo::daily-2026-01-02 /mnt/wsl/winborg/daily-2026-01-02')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Mount Archive' }));

      expect(onMount).toHaveBeenCalledWith('r1', 'daily-2026-01-02', '/mnt/wsl/winborg/daily-2026-01-02');
    });

    it('shows the same sanitized WSL path that is used for mounting', () => {
      renderCreating({ archives: [{ id: 'x', name: 'my archive (1)', time: 'now' } as any] });

      // Mount point details and command preview both use the sanitized path.
      expect(screen.getAllByText(/\/mnt\/wsl\/winborg\/my_archive__1_/).length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('/mnt/wsl/winborg/my archive (1)')).not.toBeInTheDocument();
    });

    it('blocks mounting the same repository twice', () => {
      const { archiveSelect, onMount } = renderCreating({
        mounts: [{
          id: 'm1', repoId: 'r1', archiveName: 'All archives', allArchives: true,
          localPath: '/mnt/wsl/winborg/all-archives-Repo1', status: 'mounted',
        } as any],
      });

      fireEvent.change(archiveSelect, { target: { value: ALL_ARCHIVES_VALUE } });

      const button = screen.getByRole('button', { name: 'Mount All Archives' });
      expect(button).toBeDisabled();
      expect(screen.getByText(/Already mounted at \/mnt\/wsl\/winborg\/all-archives-Repo1/)).toBeInTheDocument();
      fireEvent.click(button);
      expect(onMount).not.toHaveBeenCalled();

      // A single archive of the same repository can still be mounted next to it.
      fireEvent.change(archiveSelect, { target: { value: 'daily-2026-01-03' } });
      expect(screen.getByRole('button', { name: 'Mount Archive' })).not.toBeDisabled();
    });

    it('blocks mounting an archive that is already mounted', () => {
      renderCreating({
        mounts: [{
          id: 'm1', repoId: 'r1', archiveName: 'daily-2026-01-03',
          localPath: '/mnt/wsl/winborg/daily-2026-01-03', status: 'mounted',
        } as any],
      });

      expect(screen.getByRole('button', { name: 'Mount Archive' })).toBeDisabled();
      expect(screen.getByText(/Already mounted at/)).toBeInTheDocument();
    });

    it('uses the drive letter path when WSL mode is disabled', () => {
      window.localStorage.setItem('winborg_use_wsl', 'false');
      const { archiveSelect, onMount } = renderCreating();

      fireEvent.change(archiveSelect, { target: { value: ALL_ARCHIVES_VALUE } });
      fireEvent.click(screen.getByRole('button', { name: 'Mount All Archives' }));

      expect(onMount).toHaveBeenCalledWith('r1', null, 'Z:');
    });

    it('does not offer "All archives" while the repository is not connected', () => {
      render(
        <MountsView
          mounts={[]}
          repos={[{ ...repo, status: 'disconnected' }]}
          archives={archives}
          archivesRepoId={'r1'}
          onUnmount={() => {}}
          onMount={() => {}}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /New Mount/i }));

      const archiveSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
      expect(Array.from(archiveSelect.options).map((o) => o.value)).not.toContain(ALL_ARCHIVES_VALUE);
      expect(screen.getByRole('button', { name: 'Mount Archive' })).toBeDisabled();
    });

    it('lists a repository mount with its label and opens its folder', async () => {
      render(
        <MountsView
          mounts={[{
            id: 'm1', repoId: 'r1', archiveName: 'All archives', allArchives: true,
            localPath: '/mnt/wsl/winborg/all-archives-Repo1', status: 'mounted',
          } as any]}
          repos={[repo]}
          archives={[]}
          archivesRepoId={'r1'}
          onUnmount={() => {}}
          onMount={() => {}}
        />
      );

      expect(screen.getByRole('heading', { name: 'All archives' })).toBeInTheDocument();
      expect(screen.getByText('Repo1')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Open Folder/i }));
      await waitFor(() => {
        expect(send).toHaveBeenCalledWith('open-path', '\\\\wsl.localhost\\Ubuntu\\mnt\\wsl\\winborg\\all-archives-Repo1');
      });
    });
  });
});
