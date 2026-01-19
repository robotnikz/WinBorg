import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import OnboardingModal from './OnboardingModal';

// Mock Electron IPC
const mockInvoke = vi.fn();

describe('OnboardingModal', () => {
    beforeAll(() => {
        // Mock global alert
        window.alert = vi.fn();

        // Mock window.require
        Object.defineProperty(window, 'require', {
            value: (module: string) => {
                if (module === 'electron') return { ipcRenderer: { invoke: mockInvoke } };
                return {};
            },
            writable: true
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs checks on mount and completes if all successful', async () => {
        const onComplete = vi.fn();
        
        mockInvoke.mockImplementation((channel) => {
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve({});
        });

        render(<OnboardingModal onComplete={onComplete} />);

        // Should start with checking
        expect(screen.getByText('Checking prerequisites...')).toBeInTheDocument();

        // Wait for success and timeout
        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('system-check-wsl');
            expect(mockInvoke).toHaveBeenCalledWith('system-check-borg');
        }, { timeout: 2000 });

        // Check for visible success indication or completion
        // The modal waits 1500ms before calling onComplete
        await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 });
    });

    it('shows WSL missing step when WSL check fails', async () => {
        const onComplete = vi.fn();
        
        mockInvoke.mockImplementation((channel) => {
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: false, error: 'Not found' });
            return Promise.resolve({});
        });

        render(<OnboardingModal onComplete={onComplete} />);

        await waitFor(() => {
            expect(screen.getByText('WSL Setup Required')).toBeInTheDocument();
        });

        expect(screen.getByText(/WinBorg requires Windows Subsystem for Linux/i)).toBeInTheDocument();
        expect(screen.getByText('Install WSL (Admin)')).toBeInTheDocument();
    });

    it('handles WSL installation triggers', async () => {
        const onComplete = vi.fn();
        
        mockInvoke.mockImplementation((channel) => {
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: false });
            if (channel === 'system-install-wsl') return Promise.resolve({ success: true });
            return Promise.resolve({});
        });

        render(<OnboardingModal onComplete={onComplete} />);

        // Wait for the UI to be ready
        await waitFor(() => expect(screen.getByText('Install WSL (Admin)')).toBeInTheDocument());

        // Click install
        fireEvent.click(screen.getByText('Install WSL (Admin)'));

        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('system-install-wsl');
            // Expect the UI to show the restart prompt instead of an alert
            expect(screen.getByText(/Restart Required!/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Restart Computer Now/i })).toBeInTheDocument();
        });
    });

    it('offers Ubuntu install when WSL enabled but no distro exists', async () => {
        const onComplete = vi.fn();
        let wslChecks = 0;

        mockInvoke.mockImplementation((channel) => {
            if (channel === 'system-check-wsl') {
                wslChecks += 1;
                if (wslChecks === 1) {
                    return Promise.resolve({ installed: false, reason: 'no-distro', error: 'No distro installed' });
                }
                return Promise.resolve({ installed: true });
            }
            if (channel === 'system-install-ubuntu') return Promise.resolve({ success: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: true });
            return Promise.resolve({});
        });

        render(<OnboardingModal onComplete={onComplete} />);

        await waitFor(() => {
            expect(screen.getByText('WSL Setup Required')).toBeInTheDocument();
            expect(screen.getByText(/WSL is enabled, but Ubuntu\/Debian is not installed yet\./i)).toBeInTheDocument();
        });

        expect(screen.getByText('Install Ubuntu (WSL)')).toBeInTheDocument();
        expect(screen.queryByText('Install WSL (Admin)')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Install Ubuntu (WSL)'));

        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('system-install-ubuntu');
        });
        expect(mockInvoke).not.toHaveBeenCalledWith('system-install-wsl');

        await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 4000 });
    });

    it('shows Borg missing step and handles installation', async () => {
        const onComplete = vi.fn();
        
        mockInvoke.mockImplementation((channel) => {
            // WSL is installed, but Borg is not
            if (channel === 'system-check-wsl') return Promise.resolve({ installed: true });
            if (channel === 'system-check-borg') return Promise.resolve({ installed: false });
            if (channel === 'system-install-borg') return Promise.resolve({ success: true });
            return Promise.resolve({});
        });

        render(<OnboardingModal onComplete={onComplete} />);

        await waitFor(() => {
            expect(screen.getByText(/BorgBackup Not Found/i)).toBeInTheDocument();
        });

        // Find and click install
        const installBtn = screen.getByRole('button', { name: /Install Borg/i });
        fireEvent.click(installBtn);

        // Expect installing state
        await waitFor(() => {
            expect(screen.getByText(/Installing/i)).toBeInTheDocument();
        });

        // Expect completion
        await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 });
    });
});
