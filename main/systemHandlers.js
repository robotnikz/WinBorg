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
                const detail = (status.stderr || status.stdout || status.error || '').toString();
                const lower = detail.toLowerCase();

                // Common in VMs: nested virtualization disabled
                if (lower.includes('virtual machine platform') || lower.includes('enable virtualization') || lower.includes('hypervisor') || lower.includes('0x80370102')) {
                    return {
                        installed: false,
                        reason: 'virtualization-missing',
                        error:
                            'WSL is present but cannot start because virtualization is not available. In VirtualBox, enable nested virtualization (VT-x/AMD-V) for the VM, then try again.',
                    };
                }

                return {
                    installed: false,
                    reason: 'wsl-missing',
                    error: detail.trim() || 'WSL is not enabled on this machine.',
                };
            }

            // Some systems return exit code 0 but still indicate missing/disabled WSL in stdout/stderr.
            // Be defensive to avoid mis-classifying WSL as enabled.
            {
                const detail = (status.stderr || status.stdout || '').toString();
                const lower = detail.toLowerCase();
                if (
                    lower.includes('optional component is not enabled') ||
                    lower.includes('not enabled') ||
                    lower.includes('is not installed') ||
                    lower.includes('wsl is not installed') ||
                    lower.includes('windows-subsystem für linux ist nicht aktiviert') ||
                    lower.includes('windows-subsystem für linux wurde nicht aktiviert')
                ) {
                    return {
                        installed: false,
                        reason: 'wsl-missing',
                        error: detail.trim() || 'WSL is not enabled on this machine.',
                    };
                }
            }

            const list = await spawnCapture('wsl', ['--list', '--verbose'], { encoding: 'utf16le', timeoutMs: 15000 });
            if (list.error || list.code !== 0) {
                const detail = (list.stderr || list.stdout || list.error || '').toString();
                return {
                    installed: false,
                    reason: 'wsl-list-failed',
                    error: detail.trim() || 'WSL is enabled but listing distributions failed.',
                };
            }

            const stdout = (list.stdout || '').toString();
            let defaultDistro = '';
            const distros = [];
            const ubuntuOrDebian = [];

            if (stdout) {
                const lines = stdout.split(/\r?\n/);
                for (const line of lines) {
                    const cleanLine = (line || '').trim();
                    if (!cleanLine) continue;

                    // Only accept lines that look like: "* Ubuntu Running 2" or "Ubuntu Stopped 2".
                    // This avoids mis-parsing localized "no distributions installed" messages.
                    const m = cleanLine.match(/^\*?\s*([^\s]+)\s+([^\s]+)\s+(\d+)\s*$/);
                    if (!m) continue;

                    const isDefault = cleanLine.startsWith('*');
                    const name = m[1];
                    if (!name) continue;

                    distros.push(name);
                    if (isDefault) defaultDistro = name;
                    if (name.toLowerCase().includes('ubuntu') || name.toLowerCase().includes('debian')) {
                        ubuntuOrDebian.push(name);
                    }
                }
            }

            if (distros.length === 0) {
                // WSL is enabled, but there's no distro installed/initialized.
                return {
                    installed: false,
                    reason: 'no-distro',
                    error:
                        'WSL is enabled but no Linux distribution is installed yet. Install Ubuntu and complete the first-run user setup (username/password), then retry.',
                };
            }

            // WinBorg needs a Debian-based distro (Ubuntu/Debian) for apt-get and borg install.
            // If none exists, we should offer installing Ubuntu even if some other distro is present.
            if (ubuntuOrDebian.length === 0) {
                // IMPORTANT: Only claim "WSL is enabled" if WSL can actually execute commands.
                // Systems can have registered distros (e.g. docker-desktop) even if WSL features aren't enabled.
                const probe = await spawnCapture('wsl', ['--exec', 'echo', 'wsl_core_active'], { timeoutMs: 15000 });
                const probeOut = (probe.stdout || '').toString().trim();
                if (probe.error || probe.code !== 0 || probeOut !== 'wsl_core_active') {
                    const detail = (probe.stderr || probe.stdout || probe.error || '').toString();
                    const lower = detail.toLowerCase();
                    if (
                        lower.includes('virtual machine platform') ||
                        lower.includes('enable virtualization') ||
                        lower.includes('hypervisor') ||
                        lower.includes('0x80370102')
                    ) {
                        return {
                            installed: false,
                            reason: 'virtualization-missing',
                            error:
                                'WSL is present but cannot start because virtualization is not available. Enable virtualization (VT-x/AMD-V) and the Windows features "Virtual Machine Platform" + "Windows Subsystem for Linux", then retry.',
                        };
                    }

                    return {
                        installed: false,
                        reason: 'wsl-missing',
                        error: detail.trim() || 'WSL is not enabled on this machine.',
                    };
                }

                const lowerDefault = (defaultDistro || '').toLowerCase();
                if (lowerDefault.includes('docker')) {
                    logger.warn('WSL Default is Docker, no Ubuntu found.');
                    return {
                        installed: false,
                        reason: 'docker-default',
                        error: `Default distro is '${defaultDistro}'. We need Ubuntu/Debian.`,
                    };
                }

                const hintDefault = defaultDistro ? ` Default is '${defaultDistro}'.` : '';
                return {
                    installed: false,
                    reason: 'no-supported-distro',
                    error: `No Ubuntu/Debian WSL distribution found.${hintDefault} Install Ubuntu (WSL) and complete the first-run setup.`,
                };
            }

            const preferredDistro = ubuntuOrDebian[0] || defaultDistro || '';
            const execArgs = preferredDistro ? ['-d', preferredDistro, '--exec', 'echo', 'wsl_active'] : ['--exec', 'echo', 'wsl_active'];
            const echo = await spawnCapture('wsl', execArgs, { timeoutMs: 15000 });
            const cleanStdout = (echo.stdout || '').toString().trim();
            if (echo.error || cleanStdout !== 'wsl_active') {
                const detail = (echo.stderr || echo.stdout || echo.error || '').toString();
                return {
                    installed: false,
                    reason: 'distro-not-ready',
                    distro: preferredDistro || null,
                    error:
                        detail.trim() || 'WSL is enabled but cannot execute commands. The distro may not be initialized yet.',
                };
            }

            return { installed: true, distro: preferredDistro || defaultDistro || null, details: `Default: ${defaultDistro}` };
        },

        installWsl: async () => {
            return new Promise((resolve) => {
                // Install/enable WSL features as admin, but avoid installing a distro in the elevated context.
                // Distro installation is per-user, so we do that in a separate step (see installUbuntu).
                const cmd = 'Start-Process powershell -Verb RunAs -ArgumentList "wsl --install --no-distribution" -Wait';
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

        installUbuntu: async () => {
            return new Promise((resolve) => {
                // Run as the current user so Ubuntu is installed for the correct account.
                // We still open a visible PowerShell window so the user can complete the first-run username/password prompt.
                const cmd = 'Start-Process powershell -ArgumentList "wsl --install -d Ubuntu" -Wait';
                const child = spawn('powershell.exe', ['-Command', cmd], { windowsHide: true });
                registerManagedChild({
                    map: activeProcesses,
                    id: `sys-install-ubuntu-${Date.now()}`,
                    child,
                    kind: 'process',
                    timeoutMs: 30 * 60 * 1000,
                    onExit: (code) => {
                        if (code !== 0) return resolve({ success: false });
                        (async () => {
                            try {
                                const distro = await getPreferredWslDistro();
                                if (distro) {
                                    await spawnCapture('wsl', ['--set-default', distro], {
                                        encoding: 'utf16le',
                                        timeoutMs: 15000,
                                    });
                                }
                            } catch (e) {
                                logger.warn('[Setup] Failed to set default WSL distro after Ubuntu install:', e);
                            }
                            resolve({ success: true });
                        })();
                    },
                    onError: (err, meta) =>
                        resolve({
                            success: false,
                            error: meta?.timedOut ? 'Ubuntu install timed out.' : err.message,
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

                // Borg mount requires user-space FUSE + python bindings (llfuse/pyfuse3) in the distro.
                // On fresh WSL installs, borgbackup alone is not enough and `borg mount` fails with
                // "borg mount not available: no FUSE support, BORG_FUSE_IMPL=pyfuse3,llfuse."
                // We install the baseline deps and then try llfuse/pyfuse3 (tolerate if one isn't available).
                const script =
                    'set -e; '
                    + 'export DEBIAN_FRONTEND=noninteractive; '
                    + '/usr/bin/apt-get update --allow-releaseinfo-change; '
                    + '/usr/bin/apt-get install -y --no-install-recommends --fix-missing borgbackup fuse3 libfuse2; '
                    + '(/usr/bin/apt-get install -y --no-install-recommends --fix-missing python3-llfuse || '
                    + ' /usr/bin/apt-get install -y --no-install-recommends --fix-missing python3-pyfuse3 || true); '
                    + 'touch /etc/fuse.conf; '
                    + "sed -i 's/^#\\s*user_allow_other/user_allow_other/' /etc/fuse.conf || true; "
                    + 'grep -q "^user_allow_other" /etc/fuse.conf || echo "user_allow_other" >> /etc/fuse.conf; '
                    + 'chmod 666 /dev/fuse 2>/dev/null || true; ';

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
