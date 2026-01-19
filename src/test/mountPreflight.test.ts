// @vitest-environment node



const { createMountPreflight } = require('../../main/mountPreflight');

describe('mountPreflight', () => {
    it('skips when mountPoint is not an absolute linux path', async () => {
        const spawnCapture = vi.fn();
        const getPreferredWslDistro = vi.fn();
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        await expect(p.prepareWslMountpoint(null)).resolves.toEqual({ ok: true, skipped: true });
        await expect(p.prepareWslMountpoint('C:\\tmp')).resolves.toEqual({ ok: true, skipped: true });
        expect(spawnCapture).not.toHaveBeenCalled();
    });

    it('adds -d when preferred distro exists', async () => {
        const spawnCapture = vi.fn();
        const getPreferredWslDistro = vi.fn().mockResolvedValue('Ubuntu');
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        await expect(p.getWslDistroArgs()).resolves.toEqual(['-d', 'Ubuntu']);
    });

    it('returns empty distro args when no preferred distro', async () => {
        const spawnCapture = vi.fn();
        const getPreferredWslDistro = vi.fn().mockResolvedValue(undefined);
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        await expect(p.getWslDistroArgs()).resolves.toEqual([]);
    });

    it('prepares mountpoint successfully when prep command succeeds', async () => {
        const spawnCapture = vi
            .fn()
            // id -un
            .mockResolvedValueOnce({ code: 0, stdout: 'bob\n' })
            // prep as root
            .mockResolvedValueOnce({ code: 0, stdout: '' });

        const getPreferredWslDistro = vi.fn().mockResolvedValue('Ubuntu');
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        const res = await p.prepareWslMountpoint('/mnt/wsl/winborg/archive');
        expect(res).toEqual({ ok: true });

        expect(spawnCapture).toHaveBeenNthCalledWith(
            1,
            'wsl',
            ['-d', 'Ubuntu', '--exec', 'bash', '-lc', 'id -un'],
            expect.objectContaining({ timeoutMs: 15000 })
        );

        // second call should run as root and include the mountpoint
        const call2 = (spawnCapture as any).mock.calls[1];
        expect(call2[0]).toBe('wsl');
        expect(call2[1]).toContain('-u');
        expect(call2[1]).toContain('root');
        expect(call2[1]).toContain('/mnt/wsl/winborg/archive');
        expect(call2[2]).toEqual({ timeoutMs: 20000 });
    });

    it('fails with readable error when prep command fails', async () => {
        const spawnCapture = vi
            .fn()
            // id -un
            .mockResolvedValueOnce({ code: 0, stdout: 'bob\n' })
            // prep fails
            .mockResolvedValueOnce({ code: 1, stderr: 'permission denied' });

        const getPreferredWslDistro = vi.fn().mockResolvedValue(undefined);
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        const res = await p.prepareWslMountpoint('/mnt/wsl/winborg/archive');
        expect(res.ok).toBe(false);
        expect(res.error).toContain('Mountpoint is not writable');
        expect(res.error).toContain('permission denied');
    });

    it('fails when spawnCapture returns error', async () => {
        const spawnCapture = vi
            .fn()
            .mockResolvedValueOnce({ code: 0, stdout: 'bob\n' })
            .mockResolvedValueOnce({ code: null, error: 'boom' });

        const getPreferredWslDistro = vi.fn().mockResolvedValue(undefined);
        const p = createMountPreflight({ spawnCapture, getPreferredWslDistro });

        const res = await p.prepareWslMountpoint('/mnt/wsl/winborg/archive');
        expect(res.ok).toBe(false);
        expect(res.error).toContain('boom');
    });
});
