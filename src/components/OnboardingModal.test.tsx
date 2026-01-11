import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OnboardingModal from './OnboardingModal';
import React from 'react';

// Mock window.require for Electron IPC
const mockInvoke = vi.fn();

// Mock window.require
(window as any).require = vi.fn(() => ({
  ipcRenderer: {
    invoke: mockInvoke
  }
}));

describe('OnboardingModal', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('shows checking state initially', async () => {
    // Hang the promise to keep it in checking state
    mockInvoke.mockImplementation(() => new Promise(() => {}));
    
    render(<OnboardingModal onComplete={() => {}} />);
    
    expect(screen.getByText('Checking prerequisites...')).toBeInTheDocument();
  });

  it('shows WSL missing error when update fails', async () => {
    mockInvoke.mockResolvedValueOnce({ installed: false, error: 'WSL not found' });
    
    render(<OnboardingModal onComplete={() => {}} />);
    
    await waitFor(() => {
        expect(screen.getByText('WSL Not Found')).toBeInTheDocument();
    });
    expect(screen.getByText('wsl --install')).toBeInTheDocument();
  });

  it('shows Borg missing error when WSL is present but Borg is not', async () => {
    // First call: WSL check -> true
    // Second call: Borg check -> false
    mockInvoke
      .mockResolvedValueOnce({ installed: true })
      .mockResolvedValueOnce({ installed: false });

    render(<OnboardingModal onComplete={() => {}} />);

    await waitFor(() => {
        expect(screen.getByText('BorgBackup Not Found')).toBeInTheDocument();
    });
    expect(screen.getByText('Install Borg (Auto)')).toBeInTheDocument();
  });

  it('calls onComplete when everything is installed', async () => {
    mockInvoke
      .mockResolvedValueOnce({ installed: true }) // WSL
      .mockResolvedValueOnce({ installed: true }); // Borg

    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);

    await waitFor(() => {
        expect(screen.getByText('System Ready!')).toBeInTheDocument();
    });
    
    // Wait for the timeout in the component
    await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('attempts to install borg when button clicked', async () => {
    mockInvoke
       .mockResolvedValueOnce({ installed: true }) // WSL Check
       .mockResolvedValueOnce({ installed: false }) // Borg Check
       .mockResolvedValueOnce({ success: true }); // Install call
    
    const onComplete = vi.fn();
    render(<OnboardingModal onComplete={onComplete} />);

    // Wait for button
    await waitFor(() => {
        expect(screen.getByText('Install Borg (Auto)')).toBeInTheDocument();
    });

    // Click install
    fireEvent.click(screen.getByText('Install Borg (Auto)'));

    // Check loading state
    expect(screen.getByText('Installing BorgBackup...')).toBeInTheDocument();
    expect(screen.getByText(/upgrade & install/)).toBeInTheDocument();

    // Check completion
    await waitFor(() => {
        expect(screen.getByText('System Ready!')).toBeInTheDocument();
    });
  });
});
