function createSystemHandlers(deps) {
    if (!deps) throw new Error('createSystemHandlers requires deps');

    const {
        spawnCapture,
        spawn,
        exec,
        registerManagedChild,
        activeProcesses,
        getPreferredWslDistro,
        logger = console,
    } = deps;

    if (typeof spawnCapture !== 'function') throw new Error('spawnCapture dependency missing');
    if (typeof spawn !== 'function') throw new Error('spawn dependency missing');
    if (typeof exec !== 'function') throw new Error('exec dependency missing');
    if (typeof registerManagedChild !== 'function') throw new Error('registerManagedChild dependency missing');
    if (!activeProcesses) throw new Error('activeProcesses dependency missing');
    if (typeof getPreferredWslDistro !== 'function') throw new Error('getPreferredWslDistro dependency missing');

    return {
        reboot: async () => {
            exec('shutdown /r /t 0', (err) => {
                if (err) logger.error('Reboot failed:', err);
            });
            return true;
        },

        checkWsl: async () => {
            const status = await spawnCapture('wsl', ['--status'], { encoding: 'utf16le', timeoutMs: 15000 });
            if (status.error || status.code !== 0) {
                return { installed: false, error: 'WSL is not enabled on this machine.' };
            }

            const list = await spawnCapture('wsl', ['--list', '--verbose'], { encoding: 'utf16le', timeoutMs: 15000 });
            const stdout = list.stdout || '';
            let hasUbuntu = false;
            let defaultDistro = '';

            if (stdout) {
                const lines = stdout.split('\n').slice(1);
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine) continue;
                    const parts = cleanLine.split(/\s+/);
                    const isDefault = cleanLine.startsWith('*');
                    const nameIndex = isDefault ? 1 : 0;
                    const name = parts[nameIndex];

                    if (isDefault) defaultDistro = name;
                    if (name && (name.toLowerCase().includes('ubuntu') || name.toLowerCase().includes('debian'))) {
                        hasUbuntu = true;
                    }
                }
            }

            if ((defaultDistro || '').toLowerCase().includes('docker') && !hasUbuntu) {
                logger.warn('WSL Default is Docker, no Ubuntu found.');
                return { installed: false, error: `Default distro is '${defaultDistro}'. We need Ubuntu/Debian.` };
            }

            const echo = await spawnCapture('wsl', ['--exec', 'echo', 'wsl_active'], { timeoutMs: 15000 });
            const cleanStdout = (echo.stdout || '').toString().trim();
            if (echo.error || cleanStdout !== 'wsl_active') {
                return { installed: false, error: 'WSL installed but cannot execute commands (No distro?)' };
            }

            return { installed: true, details: `Default: ${defaultDistro}` };
        },

        installWsl: async () => {
            return new Promise((resolve) => {
                const cmd = 'Start-Process powershell -Verb RunAs -ArgumentList "wsl --install -d Ubuntu" -Wait';
                const child = spawn('powershell.exe', ['-Command', cmd], { windowsHide: true });
                registerManagedChild({
                    map: activeProcesses,
                    id: `sys-install-wsl-${Date.now()}`,
                    child,
                    kind: 'process',
                    timeoutMs: 30 * 60 * 1000,
                    onExit: (code) => resolve({ success: code === 0 }),
                    onError: (err, meta) =>
                        resolve({
                            success: false,
                            error: meta?.timedOut ? 'WSL install timed out.' : err.message,
                        }),
                });
            });
        },

        checkBorg: async () => {
            const distro = await getPreferredWslDistro();
            return new Promise((resolve) => {
                const runCheck = (checkArgs) => {
                    return new Promise((r) => {
                        const wslArgs = distro ? ['-d', distro] : [];
                        const finalArgs = [...wslArgs, ...checkArgs];
                        spawnCapture('wsl', finalArgs, { timeoutMs: 15000 }).then((res) => {
                            r({ success: res.code === 0, out: res.stdout || '' });
                        });
                    });
                };

                (async () => {
                    let res = await runCheck(['--exec', 'borg', '--version']);
                    if (res.success && res.out.includes('borg')) {
                        return resolve({ installed: true, version: res.out.trim(), distro: distro || 'Default' });
                    }

                    res = await runCheck(['--exec', '/usr/bin/borg', '--version']);
                    if (res.success && res.out.includes('borg')) {
                        return resolve({
                            installed: true,
                            version: res.out.trim(),
                            distro: distro || 'Default',
                            path: '/usr/bin/borg',
                        });
                    }

                    logger.log(`[Check] Borg check failed on distro '${distro || 'default'}'`);
                    resolve({ installed: false });
                })();
            });
        },

        installBorg: async () => {
            const targetDistro = await getPreferredWslDistro();

            return new Promise((resolve) => {
                let hasResolved = false;
                const resolveOnce = (value) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    resolve(value);
                };

                logger.log('[Setup] Installing Borg via WSL (root)...');
                if (targetDistro) logger.log(`[Setup] Targeted distro: '${targetDistro}'`);

                const script =
                    'export DEBIAN_FRONTEND=noninteractive && /usr/bin/apt-get update --allow-releaseinfo-change && /usr/bin/apt-get install -y --no-install-recommends --fix-missing borgbackup';

                const wslArgs = ['-u', 'root'];
                if (targetDistro) {
                    wslArgs.push('-d', targetDistro);
                }
                wslArgs.push('-e', 'sh', '-c', script);

                logger.log(`[Setup] Spawning: wsl ${wslArgs.join(' ')}`);
                const child = spawn('wsl', wslArgs, { windowsHide: true });

                let output = '';
                let errorOutput = '';

                registerManagedChild({
                    map: activeProcesses,
                    id: `sys-install-borg-${Date.now()}`,
                    child,
                    kind: 'process',
                    timeoutMs: 30 * 60 * 1000,
                    onStdout: (d) => {
                        output += d.toString();
                    },
                    onStderr: (d) => {
                        errorOutput += d.toString();
                    },
                    onExit: (code) => {
                        if (code === 0) {
                            logger.log('[Setup] Install command finished with code 0. Verifying...');

                            (async () => {
                                const wslDistroArgs = targetDistro ? ['-d', targetDistro] : [];

                                const verify = async (args) => {
                                    const finalArgs = [...wslDistroArgs, ...args];
                                    logger.log(`[Setup] Verifying with: wsl ${finalArgs.join(' ')}`);
                                    return await spawnCapture('wsl', finalArgs, { timeoutMs: 20000 });
                                };

                                let res = await verify(['--exec', 'borg', '--version']);
                                if (res.error || res.code !== 0 || !(res.stdout || '').includes('borg')) {
                                    logger.log("[Setup] Generic 'borg' check failed. Trying explicit /usr/bin/borg...");
                                    res = await verify(['--exec', '/usr/bin/borg', '--version']);
                                }

                                if (!res.error && res.code === 0 && (res.stdout || '').includes('borg')) {
                                    logger.log('[Setup] Verified: Borg is installed and runnable.');
                                    return resolveOnce({ success: true });
                                }

                                logger.warn('[Setup] Verification failed despite install exit code 0!', res.error || res.code);

                                const whichCheck = await verify(['--exec', 'which', 'borg']);
                                const logSnippet = output.slice(-2000) + '\n' + errorOutput.slice(-2000);
                                const debugInfo =
                                    `\n\nDebug Info:\nTarget Distro: ${targetDistro || 'Default'}\nVerify Code: ${res.code ?? 'null'}\nVerify Error: ${res.error || '(none)'}\nStdout: ${(res.stdout || '').slice(0, 4000)}\nStderr: ${(res.stderr || '').slice(0, 4000)}\n'which borg' output: ${(whichCheck.stdout || '').slice(0, 2000)}\n'which' error: ${(whichCheck.stderr || '').slice(0, 2000)}`;

                                return resolveOnce({
                                    success: false,
                                    error: `Installation appeared successful, but verification failed.\n\nCommand Output:\n${logSnippet}${debugInfo}`,
                                });
                            })();
                            return;
                        }

                        logger.error('[Setup] Install failed code:', code);
                        let friendlyError = `Installation failed (Code ${code}).`;
                        const lowerErr = (errorOutput || '').toLowerCase();

                        if (lowerErr.includes('apt-get: not found') || lowerErr.includes('command not found')) {
                            friendlyError +=
                                " It seems 'apt-get' is missing. WinBorg requires a Debian-based WSL distro (likely Ubuntu).";
                            friendlyError +=
                                "\nTry running 'wsl --list --verbose' in PowerShell to see which distro is default.";
                        } else {
                            const lines = (errorOutput || '').split('\n').filter((l) => l.trim().length > 0);
                            const snippet = lines.slice(-10).join('\n');
                            friendlyError += `\n\nError Details:\n${snippet}`;
                        }

                        resolveOnce({ success: false, error: friendlyError });
                    },
                    onError: (err, meta) => {
                        logger.error('[Setup] Spawn error:', err);
                        resolveOnce({
                            success: false,
                            error: meta?.timedOut
                                ? 'Borg install timed out.'
                                : 'Failed to start WSL process: ' + err.message,
                        });
                    },
                });
            });
        },
    };
}

module.exports = {
    createSystemHandlers,
};
