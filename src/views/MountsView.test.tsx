import { render, screen, fireEvent } from '@testing-library/react';

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

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        send,
      },
    }));
  });

  it('converts WSL paths to \\wsl.localhost UNC when opening folder', () => {
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
        onUnmount={() => {}}
        onMount={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Folder/i }));

    expect(send).toHaveBeenCalledTimes(1);
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
        onUnmount={() => {}}
        onMount={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Folder/i }));

    expect(send).toHaveBeenCalledWith('open-path', 'Z:');
  });
});
