

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

        it('prepends --remote-path and sets BORG_REMOTE_PATH + WSLENV when remotePath override is provided', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                if (key === 'winborg_use_wsl') return 'true';
                return null;
            });
            mockInvoke.mockResolvedValue({ success: true });

            await borgService.runCommand(['list', 'repo1'], vi.fn(), { remotePath: '/usr/local/bin/borg-alt' });

            expect(mockInvoke).toHaveBeenCalledWith('borg-spawn', expect.objectContaining({
                args: ['--remote-path', '/usr/local/bin/borg-alt', 'list', 'repo1'],
                envVars: expect.objectContaining({
                    BORG_REMOTE_PATH: '/usr/local/bin/borg-alt',
                }),
            }));

            const params = mockInvoke.mock.calls[0][1];
            expect(params.envVars.WSLENV).toContain('BORG_REMOTE_PATH/u');
        });

        it('adds StrictHostKeyChecking=no to BORG_RSH when disableHostCheck override is true', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                if (key === 'winborg_use_wsl') return 'true';
                return null;
            });
            mockInvoke.mockResolvedValue({ success: true });

            await borgService.runCommand(['info', 'repo1'], vi.fn(), { disableHostCheck: true });

            const params = mockInvoke.mock.calls[0][1];
            expect(String(params.envVars.BORG_RSH || '')).toContain('StrictHostKeyChecking=no');
            expect(String(params.envVars.BORG_RSH || '')).toContain('UserKnownHostsFile=/dev/null');
        });

        it('does not set WSLENV when WSL is disabled (even with custom env)', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                if (key === 'winborg_use_wsl') return 'false';
                return null;
            });
            mockInvoke.mockResolvedValue({ success: true });

            await borgService.runCommand(['list', 'repo1'], vi.fn(), { env: { MY_VAR: '123' } });

            const params = mockInvoke.mock.calls[0][1];
            expect(params.useWsl).toBe(false);
            expect(params.envVars.MY_VAR).toBe('123');
            expect(params.envVars.WSLENV).toBeUndefined();
        });
    });

    describe('createArchive', () => {
        it('adds --exclude arguments when provided (WSL enabled)', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                if (key === 'winborg_use_wsl') return 'true';
                return null;
            });

            const spy = vi.spyOn(borgService, 'runCommand').mockResolvedValue(true);
            const onLog = vi.fn();

            await borgService.createArchive(
                'ssh://repo',
                'arch-1',
                ['C:\\Data'],
                onLog,
                undefined,
                { excludePatterns: ['node_modules', 'C:\\Data\\tmp'] }
            );

            expect(spy).toHaveBeenCalledWith(
                expect.arrayContaining(['create', '--progress', '--stats']),
                onLog,
                undefined
            );

            const calledArgs = spy.mock.calls[0][0];
            expect(calledArgs).toContain('--exclude');
            expect(calledArgs).toContain('node_modules');
            expect(calledArgs).toContain('/mnt/c/Data/tmp');
            expect(calledArgs).toContain('/mnt/c/Data');
            expect(calledArgs).toContain('ssh://repo::arch-1');

            spy.mockRestore();
        });

        it('does not add --exclude when excludePatterns are empty/whitespace', async () => {
            const spy = vi.spyOn(borgService, 'runCommand').mockResolvedValue(true);
            const onLog = vi.fn();

            await borgService.createArchive(
                'ssh://repo',
                'arch-2',
                ['C:\\Data'],
                onLog,
                undefined,
                { excludePatterns: ['  ', '', '\n'] }
            );

            const calledArgs = spy.mock.calls[0][0];
            expect(calledArgs).not.toContain('--exclude');
            spy.mockRestore();
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

    describe('Filesystem helpers', () => {
        it('getDownloadsPath returns the string provided by IPC', async () => {
            mockInvoke.mockResolvedValue('C:\\Users\\me\\Downloads');
            const res = await borgService.getDownloadsPath();
            expect(mockInvoke).toHaveBeenCalledWith('get-downloads-path');
            expect(res).toBe('C:\\Users\\me\\Downloads');
        });

        it('createDirectory returns the boolean provided by IPC', async () => {
            mockInvoke.mockResolvedValue(true);
            const res = await borgService.createDirectory('C:\\Temp\\X');
            expect(mockInvoke).toHaveBeenCalledWith('create-directory', 'C:\\Temp\\X');
            expect(res).toBe(true);
        });

        it('selectDirectory returns filePaths when not canceled', async () => {
            mockInvoke.mockResolvedValue({ canceled: false, filePaths: ['C:\\Temp'] });
            const res = await borgService.selectDirectory();
            expect(mockInvoke).toHaveBeenCalledWith('select-directory');
            expect(res).toEqual(['C:\\Temp']);
        });

        it('selectDirectory returns null when canceled', async () => {
            mockInvoke.mockResolvedValue({ canceled: true, filePaths: ['C:\\Temp'] });
            const res = await borgService.selectDirectory();
            expect(res).toBeNull();
        });

        it('selectDirectory returns null when IPC throws', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockInvoke.mockRejectedValue(new Error('boom'));
            const res = await borgService.selectDirectory();
            expect(res).toBeNull();
            errorSpy.mockRestore();
        });
    });

    describe('Cancellation helpers', () => {
        it('stopCommand calls borg-stop and returns result.success', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const res = await borgService.stopCommand('cmd-1');
            expect(mockInvoke).toHaveBeenCalledWith('borg-stop', { commandId: 'cmd-1' });
            expect(res).toBe(true);
        });
    });

    describe('mount', () => {
        it('returns FUSE_MISSING when ensureFuseConfig fails (WSL enabled)', async () => {
            (window.localStorage.getItem as any).mockImplementation((key: string) => {
                if (key === 'winborg_use_wsl') return 'true';
                return null;
            });

            // ensureFuseConfig uses borg-spawn (root bash) and expects { success }
            mockInvoke.mockImplementation(async (channel: string) => {
                if (channel === 'borg-spawn') return { success: false };
                // should not attempt borg-mount when fuse setup fails
                if (channel === 'borg-mount') throw new Error('borg-mount should not be called');
                return { success: true };
            });

            const onLog = vi.fn();
            const res = await borgService.mount('ssh://repo', 'arch1', '/mnt/wsl/winborg/arch1', onLog, { repoId: 'r1' });
            expect(res).toMatchObject({ success: false, error: 'FUSE_MISSING' });
            expect(mockInvoke).toHaveBeenCalledWith('borg-spawn', expect.objectContaining({
                commandId: 'fuse-setup',
                useWsl: true,
                forceBinary: 'bash',
                wslUser: 'root',
            }));
        });
    });
});
