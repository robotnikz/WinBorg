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

(window as any).require = vi.fn(() => ({
  ipcRenderer: {
    invoke: mockInvoke,
    send: mockSend
  }
}));

describe('SettingsView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default Mock for Settings Load
        mockInvoke.mockImplementation((channel) => {
             if (channel === 'get-db') return Promise.resolve({
                 settings: {
                     useWsl: true,
                     borgPath: 'borg',
                     startWithWindows: false
                 }
             });
             if (channel === 'get-notification-config') return Promise.resolve({ notifyOnSuccess: true });
             return Promise.resolve(null);
        });
    });

    it('loads and displays existing settings', async () => {
        render(<SettingsView />);
        
        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('get-db');
        });

        // Check toggles
        // Since custom ToggleSwitch wraps input, we check input state
        // "Start with Windows"
        const startToggle = screen.getByLabelText('Start with Windows');
        expect(startToggle).not.toBeChecked(); // Default mock false
    });

    it('saves settings when Save button is clicked', async () => {
        render(<SettingsView />);
        
        // Wait for load
        await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get-db'));

        // Change a setting
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
        
        // Verify success feedback (toast or button state)
        expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('tests notification config', async () => {
        render(<SettingsView />);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get-notification-config'));
        
        // Find Discord Test Button
        // Need to locate by text potentially within a tab or section
        // Assuming Discord section is visible or accessible
        // Enter dummy webhook
        const webhookInput = screen.getByPlaceholderText(/https:\/\/discord\.com\/api\/webhooks/i);
        fireEvent.change(webhookInput, { target: { value: 'https://discord.gg/test' } });
        
        const testBtn = screen.getByRole('button', { name: /^Test$/i });
        fireEvent.click(testBtn);
        
        await waitFor(() => {
            expect(mockInvoke).toHaveBeenCalledWith('test-notification', 'discord');
        });
    });

    it('tests system integration (Borg Version)', async () => {
        render(<SettingsView />);
        
        // Wait for initial load
        await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get-db'));

        (borgService.runCommand as any).mockImplementation((args: any, cb: any) => {
            cb('borg 1.2.4');
            return Promise.resolve(true); 
        });

        const testBtn = screen.getByText('Test Borg Installation');
        fireEvent.click(testBtn);
        
        await waitFor(() => {
            expect(borgService.runCommand).toHaveBeenCalled();
            expect(screen.getByText('Borg Found & Working!')).toBeInTheDocument();
        });
    });
});
