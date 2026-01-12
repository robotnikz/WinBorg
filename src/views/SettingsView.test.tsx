import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsView from './SettingsView';
import { borgService } from '../services/borgService';

// Mock dependencies
vi.mock('../services/borgService', () => ({
    borgService: {
        runCommand: vi.fn(),
    }
}));

// Mock Electron IPC
const mockInvoke = vi.fn();
const mockSend = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    (window as any).require = vi.fn(() => ({
      ipcRenderer: {
        invoke: mockInvoke,
        send: mockSend
      }
    }));

    // Default Mock for Settings Load
    mockInvoke.mockImplementation((channel) => {
         if (channel === 'get-db') return Promise.resolve({
             settings: {
                 useWsl: true,
                 borgPath: 'borg',
                 startWithWindows: false,
                 limitBandwidth: false,
                 bandwidthLimit: 1000
             }
         });
         if (channel === 'get-notification-config') return Promise.resolve({ 
             notifyOnSuccess: true,
             notifyOnError: true,
             notifyOnUpdate: false,
             emailEnabled: false,
             smtpHost: ''
         });
         return Promise.resolve(null);
    });
});

describe('SettingsView', () => {

    it('loads and displays general settings by default', async () => {
        render(<SettingsView />);
        
        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('get-db');
        });

        // Check for general tab content
        expect(screen.getByText('Application Behavior')).toBeInTheDocument();
        // Toggle switch label
        expect(screen.getByText('Start with Windows')).toBeInTheDocument();
    });

    it('navigates between tabs', async () => {
        render(<SettingsView />);
        await waitFor(() => expect(screen.getByText('Application Behavior')).toBeInTheDocument());

        // Switch to Automation
        fireEvent.click(screen.getByText('Performance & Rules'));
        await waitFor(() => {
            expect(screen.getByText('Performance & Limits')).toBeInTheDocument();
        });

        // Switch to Notifications
        fireEvent.click(screen.getByText('Notifications'));
        await waitFor(() => {
            expect(screen.getByText('Trigger Rules')).toBeInTheDocument();
        });

        // Switch to System
        fireEvent.click(screen.getByText('System & Backend'));
        await waitFor(() => {
            expect(screen.getByText('Backend Environment')).toBeInTheDocument();
        });
    });

    it('saves settings when Save button is clicked', async () => {
        render(<SettingsView />);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get-db'));

        // Change a toggle (Start with Windows is in General tab)
        const startToggle = screen.getByLabelText('Start with Windows');
        fireEvent.click(startToggle); 

        // Click Save
        const saveBtn = screen.getByRole('button', { name: "Save Changes" }); 
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
             expect(mockInvoke).toHaveBeenCalledWith('save-db', expect.objectContaining({
                 settings: expect.objectContaining({
                     startWithWindows: true
                 })
             }));
        });
        
        expect(screen.getByText('Saved')).toBeInTheDocument();
    });
});
