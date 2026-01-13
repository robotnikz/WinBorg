// @vitest-environment node

import { describe, it, expect, vi } from 'vitest';

const { createSystemHandlers } = require('../../main/systemHandlers');

describe('systemHandlers (main-process logic)', () => {
    it('checkWsl returns installed=false when wsl is not available', async () => {
        const spawnCapture = vi.fn().mockResolvedValueOnce({ code: 1, error: new Error('no wsl') });
        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkWsl();
        expect(res).toEqual({ installed: false, error: 'WSL is not enabled on this machine.' });
        expect(spawnCapture).toHaveBeenCalledWith('wsl', ['--status'], expect.any(Object));
    });

    it('checkWsl rejects Docker default when no Ubuntu/Debian exists', async () => {
        const listOut = `NAME            STATE           VERSION\n* docker-desktop Running         2\n`;
        const spawnCapture = vi
            .fn()
            .mockResolvedValueOnce({ code: 0, stdout: 'ok' })
            .mockResolvedValueOnce({ code: 0, stdout: listOut });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkWsl();
        expect(res.installed).toBe(false);
        expect(res.error).toContain("Default distro is 'docker-desktop'");
    });

    it('checkWsl returns installed=false when exec echo fails', async () => {
        const listOut = `NAME            STATE           VERSION\n* Ubuntu         Running         2\n`;
        const spawnCapture = vi
            .fn()
            .mockResolvedValueOnce({ code: 0, stdout: 'ok' })
            .mockResolvedValueOnce({ code: 0, stdout: listOut })
            .mockResolvedValueOnce({ code: 0, stdout: 'not_ok' });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkWsl();
        expect(res).toEqual({
            installed: false,
            error: 'WSL installed but cannot execute commands (No distro?)',
        });
    });

    it('checkWsl returns installed=true when status/list/exec succeeds', async () => {
        const listOut = `NAME            STATE           VERSION\n* Ubuntu         Running         2\n  Debian         Stopped         2\n`;
        const spawnCapture = vi
            .fn()
            .mockResolvedValueOnce({ code: 0, stdout: 'ok' })
            .mockResolvedValueOnce({ code: 0, stdout: listOut })
            .mockResolvedValueOnce({ code: 0, stdout: 'wsl_active\n' });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkWsl();
        expect(res).toEqual({ installed: true, details: 'Default: Ubuntu' });
    });

    it('checkBorg returns installed=true when borg is in PATH', async () => {
        const spawnCapture = vi.fn().mockResolvedValueOnce({ code: 0, stdout: 'borg 1.2.7\n' });
        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn().mockResolvedValue('Ubuntu'),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkBorg();
        expect(res).toEqual({ installed: true, version: 'borg 1.2.7', distro: 'Ubuntu' });
        expect(spawnCapture).toHaveBeenCalledWith('wsl', ['-d', 'Ubuntu', '--exec', 'borg', '--version'], { timeoutMs: 15000 });
    });

    it('checkBorg falls back to /usr/bin/borg', async () => {
        const spawnCapture = vi
            .fn()
            .mockResolvedValueOnce({ code: 1, stdout: '' })
            .mockResolvedValueOnce({ code: 0, stdout: 'borg 1.2.7\n' });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn(),
            exec: vi.fn(),
            registerManagedChild: vi.fn(),
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn().mockResolvedValue(undefined),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.checkBorg();
        expect(res).toEqual({ installed: true, version: 'borg 1.2.7', distro: 'Default', path: '/usr/bin/borg' });
    });

    it('installWsl resolves success=true on exit code 0', async () => {
        const registerManagedChild = vi.fn(({ onExit }: any) => onExit(0));
        const handlers = createSystemHandlers({
            spawnCapture: vi.fn(),
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installWsl();
        expect(res).toEqual({ success: true });
    });

    it('installWsl resolves timed-out error when registerManagedChild reports timeout', async () => {
        const registerManagedChild = vi.fn(({ onError }: any) => onError(new Error('x'), { timedOut: true }));
        const handlers = createSystemHandlers({
            spawnCapture: vi.fn(),
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installWsl();
        expect(res).toEqual({ success: false, error: 'WSL install timed out.' });
    });

    it('installBorg returns success=true when verification succeeds', async () => {
        const spawnCapture = vi.fn().mockResolvedValueOnce({ code: 0, stdout: 'borg 1.2.7\n' });
        const registerManagedChild = vi.fn(({ onExit }: any) => onExit(0));

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn().mockResolvedValue('Ubuntu'),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installBorg();
        expect(res).toEqual({ success: true });
    });

    it('installBorg returns helpful message when apt-get is missing', async () => {
        const spawnCapture = vi.fn();
        const registerManagedChild = vi.fn(({ onStderr, onExit }: any) => {
            onStderr(Buffer.from('apt-get: not found'));
            onExit(127);
        });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn().mockResolvedValue(undefined),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installBorg();
        expect(res.success).toBe(false);
        expect(res.error).toContain("apt-get");
        expect(res.error).toContain('Debian-based');
    });

    it('installBorg returns timed-out error when registerManagedChild reports timeout', async () => {
        const spawnCapture = vi.fn();
        const registerManagedChild = vi.fn(({ onError }: any) => onError(new Error('x'), { timedOut: true }));

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn(),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installBorg();
        expect(res).toEqual({ success: false, error: 'Borg install timed out.' });
    });

    it('installBorg surfaces verification failure details when install exits 0 but borg is not runnable', async () => {
        const spawnCapture = vi
            .fn()
            // verify: borg --version fails
            .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'not found' })
            // verify: /usr/bin/borg --version fails
            .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'not found' })
            // verify: which borg
            .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'nope' });

        const registerManagedChild = vi.fn(({ onStdout, onStderr, onExit }: any) => {
            onStdout(Buffer.from('apt output...'));
            onStderr(Buffer.from('apt err...'));
            onExit(0);
        });

        const handlers = createSystemHandlers({
            spawnCapture,
            spawn: vi.fn().mockReturnValue({}),
            exec: vi.fn(),
            registerManagedChild,
            activeProcesses: new Map(),
            getPreferredWslDistro: vi.fn().mockResolvedValue('Ubuntu'),
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        });

        const res = await handlers.installBorg();
        expect(res.success).toBe(false);
        expect(res.error).toContain('verification failed');
        expect(res.error).toContain('Debug Info');
    });
});
