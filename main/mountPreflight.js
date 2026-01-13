function createMountPreflight(deps) {
    if (!deps) throw new Error('createMountPreflight requires deps');

    const { spawnCapture, getPreferredWslDistro } = deps;
    if (typeof spawnCapture !== 'function') throw new Error('spawnCapture dependency missing');
    if (typeof getPreferredWslDistro !== 'function') throw new Error('getPreferredWslDistro dependency missing');

    async function getWslDistroArgs() {
        const detectedDistro = await getPreferredWslDistro();
        return detectedDistro ? ['-d', detectedDistro] : [];
    }

    async function prepareWslMountpoint(mountPoint) {
        if (typeof mountPoint !== 'string' || !mountPoint.startsWith('/')) {
            return { ok: true, skipped: true };
        }

        const wslDistroArgs = await getWslDistroArgs();

        // Determine default user for this distro.
        const userRes = await spawnCapture('wsl', [...wslDistroArgs, '--exec', 'bash', '-lc', 'id -un'], {
            timeoutMs: 15000,
        });
        const defaultUser = (userRes.stdout || '').toString().trim();

        const prepScript =
            'MP="$1"; U="$2"; '
            + 'mkdir -p "$MP"; '
            + 'if [ -n "$U" ]; then chown "$U":"$U" "$MP" 2>/dev/null || true; fi; '
            + 'chmod 0777 "$MP" 2>/dev/null || true; '
            + 'test -d "$MP" && test -w "$MP"';

        const prep = await spawnCapture(
            'wsl',
            [...wslDistroArgs, '-u', 'root', '--exec', 'bash', '-lc', prepScript, 'winborg', mountPoint, defaultUser],
            { timeoutMs: 20000 }
        );

        if (prep.error || prep.code !== 0) {
            const detail = (prep.stderr || prep.stdout || prep.error || '').toString().slice(0, 2000);
            return {
                ok: false,
                error: `Mountpoint is not writable: ${mountPoint}. ${detail}`,
            };
        }

        return { ok: true };
    }

    return {
        getWslDistroArgs,
        prepareWslMountpoint,
    };
}

module.exports = {
    createMountPreflight,
};
