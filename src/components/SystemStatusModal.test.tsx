import { render, screen, waitFor } from '@testing-library/react';

import SystemStatusModal from './SystemStatusModal';

vi.mock('../utils/appVersion', () => ({
  getAppVersion: vi.fn().mockResolvedValue('1.2.3'),
}));

describe('SystemStatusModal', () => {
  const invoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        invoke,
      },
    }));
  });

  it('invokes system checks when opened and renders results', async () => {
    invoke.mockImplementation((channel: string) => {
      if (channel === 'system-check-wsl') {
        return Promise.resolve({ installed: true, distro: 'Ubuntu' });
      }
      if (channel === 'system-check-borg') {
        return Promise.resolve({ installed: true, version: '1.2.3', path: '/usr/bin/borg' });
      }
      return Promise.resolve(null);
    });

    render(<SystemStatusModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('system-check-wsl');
      expect(invoke).toHaveBeenCalledWith('system-check-borg');
    });

    // WSL status
    expect(await screen.findByText(/Active \(Ubuntu\)/i)).toBeInTheDocument();

    // Borg status
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    expect(screen.getByText('/usr/bin/borg')).toBeInTheDocument();

    // App version shown
    expect(screen.getByText(/WinBorg Client v1\.2\.3/i)).toBeInTheDocument();
  });

  it('shows Not Found when checks report not installed', async () => {
    invoke.mockImplementation((channel: string) => {
      if (channel === 'system-check-wsl') {
        return Promise.resolve({ installed: false });
      }
      if (channel === 'system-check-borg') {
        return Promise.resolve({ installed: false });
      }
      return Promise.resolve(null);
    });

    render(<SystemStatusModal isOpen={true} onClose={() => {}} />);

    const matches = await screen.findAllByText('Not Found');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
