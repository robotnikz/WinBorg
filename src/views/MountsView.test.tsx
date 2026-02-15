import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import MountsView from './MountsView';

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
});
