import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Types
import type { borgService as BorgServiceType } from './borgService';

// 1. Setup Data for Mocks
const mockInvoke = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();
const mockSend = vi.fn();

const mockIpcRenderer = {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
    send: mockSend,
};

// Mock Require
const mockRequire = vi.fn((moduleName: string) => {
    if (moduleName === 'electron') {
        return { ipcRenderer: mockIpcRenderer };
    }
    throw new Error(`Module ${moduleName} not found`);
});

// Helper to reset module if needed (Vitest might cache)
// But simply setting window.require BEFORE import is enough if we use dynamic import.

describe('borgService', () => {
    let borgService: typeof BorgServiceType;

    beforeAll(async () => {
        // Setup Window Mock
        Object.defineProperty(window, 'require', {
            value: mockRequire,
            writable: true,
            configurable: true
        });

        const localStorageMock = (() => {
            let store: Record<string, string> = {};
            return {
                getItem: vi.fn((key: string) => store[key] || null),
                setItem: vi.fn((key: string, value: string) => {
                    store[key] = value.toString();
                }),
                removeItem: vi.fn((key: string) => {
                    delete store[key];
                }),
                clear: vi.fn(() => {
                    store = {};
                }),
            };
        })();

        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Dynamic Import to ensure window.require is present when module initializes
        const module = await import('./borgService');
        borgService = module.borgService;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        
        // Default localStorage Setup
        (window.localStorage.getItem as any).mockImplementation((key: string) => {
            if (key === 'winborg_use_wsl') return 'true'; // Default test state
            return null;
        });
    });

    describe('Secrets Management', () => {
        it('savePassphrase calls ipcRenderer.invoke with correct args', async () => {
            mockInvoke.mockResolvedValue(true);
            await borgService.savePassphrase('repo1', 'secret123');
            expect(mockInvoke).toHaveBeenCalledWith('save-secret', { repoId: 'repo1', passphrase: 'secret123' });
        });

        it('deletePassphrase calls ipcRenderer.invoke', async () => {
            mockInvoke.mockResolvedValue(true);
            await borgService.deletePassphrase('repo1');
            expect(mockInvoke).toHaveBeenCalledWith('delete-secret', { repoId: 'repo1' });
        });

        it('hasPassphrase return value from ipcRenderer', async () => {
             mockInvoke.mockResolvedValue({ hasSecret: true });
             const result = await borgService.hasPassphrase('repo1');
             expect(result).toBe(true);
             expect(mockInvoke).toHaveBeenCalledWith('has-secret', { repoId: 'repo1' });
        });
    });

    describe('runCommand', () => {
        it('calls borg-spawn with correct default arguments (WSL enabled)', async () => {
             mockInvoke.mockResolvedValue({ success: true });
             
             const args = ['info', 'repo1'];
             const onLog = vi.fn();
             
             await borgService.runCommand(args, onLog);
             
             expect(mockInvoke).toHaveBeenCalledWith('borg-spawn', expect.objectContaining({
                 args: args,
                 useWsl: true,
                 executablePath: 'borg', // Default
                 envVars: expect.objectContaining({
                     BORG_DISPLAY_PASSPHRASE: 'no'
                 })
             }));
        });

        it('respects overrides for repoId (secure injection)', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const onLog = vi.fn();
            
            await borgService.runCommand(['check'], onLog, { repoId: 'repo-secure' });
            
            expect(mockInvoke).toHaveBeenCalledWith('borg-spawn', expect.objectContaining({
                repoId: 'repo-secure'
            }));
        });

        it('redirects logs to onLog callback', async () => {
            let listener: any = null;
            mockOn.mockImplementation((channel, fn) => {
                if (channel === 'terminal-log') {
                    listener = fn;
                }
            });
            
            mockInvoke.mockImplementation(async (channel, { commandId }) => {
                 // Simulate log 
                 // We can trigger the listener here or outside. 
                 // Since we have reference to listener via mockOn side effect, good.
                 if (listener) {
                    listener({}, { id: commandId, text: "Borg output line 1" });
                 }
                 return { success: true };
            });

            // To properly test the callback, let's provide a fixed commandId via overrides
            const fixedId = "test-cmd-id";
            const onLog = vi.fn();

            // Start the command
            const promise = borgService.runCommand(['list'], onLog, { commandId: fixedId });
            
            // Invoke returns promise, we wait for it. But invoke itself triggers the log in my mock above after 10ms.
            await promise;

            expect(onLog).toHaveBeenCalledWith("Borg output line 1");
            expect(mockRemoveListener).toHaveBeenCalledWith('terminal-log', expect.any(Function));
        });

        it('injects WSLENV when using WSL and custom env', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                 if (key === 'winborg_use_wsl') return 'true';
                 return null;
            });
            mockInvoke.mockResolvedValue({ success: true });

            await borgService.runCommand(['foo'], vi.fn(), { env: { MY_VAR: '123' } });

            expect(mockInvoke).toHaveBeenCalledWith('borg-spawn', expect.objectContaining({
                envVars: expect.objectContaining({
                    MY_VAR: '123'
                })
            }));
             // Check WSLENV specifically
             const call = mockInvoke.mock.calls[0];
             const params = call[1];
             expect(params.envVars.WSLENV).toContain('MY_VAR');
        });
    });

    describe('initRepo', () => {
        it('maps encryption repokey to repokey-blake2', async () => {
            const spy = vi.spyOn(borgService, 'runCommand').mockResolvedValue(true);
            
            await borgService.initRepo('ssh://repo', 'repokey', vi.fn());
            
            expect(spy).toHaveBeenCalledWith(
                ['init', '--encryption', 'repokey-blake2', 'ssh://repo'],
                expect.any(Function),
                undefined
            );
            
            spy.mockRestore();
        });
    });

    describe('SSH / Remote install helpers', () => {
        it('manageSSHKey calls ssh-key-manage with correct args', async () => {
            mockInvoke.mockResolvedValue({ success: true, exists: false });
            const res = await borgService.manageSSHKey('check', 'ed25519');
            expect(mockInvoke).toHaveBeenCalledWith('ssh-key-manage', { action: 'check', type: 'ed25519' });
            expect(res).toEqual({ success: true, exists: false });
        });

        it('installSSHKey calls ssh-key-install with correct args', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const res = await borgService.installSSHKey('user@host', 'pw', '23');
            expect(mockInvoke).toHaveBeenCalledWith('ssh-key-install', { target: 'user@host', password: 'pw', port: '23' });
            expect(res).toEqual({ success: true });
        });

        it('installBorg calls ssh-install-borg with correct args', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const res = await borgService.installBorg('user@host', 'pw', '22');
            expect(mockInvoke).toHaveBeenCalledWith('ssh-install-borg', { target: 'user@host', password: 'pw', port: '22' });
            expect(res).toEqual({ success: true });
        });

        it('testSshConnection calls ssh-test-connection with correct args', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const res = await borgService.testSshConnection('user@host', '2222');
            expect(mockInvoke).toHaveBeenCalledWith('ssh-test-connection', { target: 'user@host', port: '2222' });
            expect(res).toEqual({ success: true });
        });

        it('checkBorgInstalledRemote calls ssh-check-borg with correct args', async () => {
            mockInvoke.mockResolvedValue({ success: true, version: 'borg 1.2.7', path: '/usr/bin/borg' });
            const res = await borgService.checkBorgInstalledRemote('user@host', '2222');
            expect(mockInvoke).toHaveBeenCalledWith('ssh-check-borg', { target: 'user@host', port: '2222' });
            expect(res).toEqual({ success: true, version: 'borg 1.2.7', path: '/usr/bin/borg' });
        });
    });
});
