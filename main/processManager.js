const { spawn: defaultSpawn } = require('child_process');

function createProcessManager({
    updatePowerBlocker,
    processMap,
    spawn = defaultSpawn,
} = {}) {
    const safeUpdatePowerBlocker = typeof updatePowerBlocker === 'function' ? updatePowerBlocker : () => {};
    const defaultProcessMap = processMap || new Map();

    function killChildProcess(child) {
        if (!child) return;
        try { child.kill(); } catch (e) {}

        // On Windows, ensure the whole process tree is terminated.
        if (process.platform === 'win32' && child.pid) {
            try {
                const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
                killer.on('error', () => {});
            } catch (e) {}
        }
    }

    function stopTrackedProcessEntry(entry) {
        if (!entry) return;
        // Real ChildProcess
        if (typeof entry.pid === 'number' || typeof entry.kill === 'function') {
            killChildProcess(entry);
            return;
        }
        // Placeholder/fallback objects
        if (typeof entry.kill === 'function') {
            try { entry.kill(); } catch (e) {}
        }
    }

    function registerManagedChild({
        map,
        id,
        child,
        kind,
        timeoutMs,
        onStdout,
        onStderr,
        onExit,
        onError
    }) {
        if (!map || !id || !child) return { stop: () => {} };

        map.set(id, child);
        if (kind === 'process') safeUpdatePowerBlocker();
        if (kind === 'mount') safeUpdatePowerBlocker();

        let finished = false;
        const finishOnce = (fn) => {
            if (finished) return;
            finished = true;
            try { fn(); } catch (e) {}
        };

        let timer = null;
        if (typeof timeoutMs === 'number' && timeoutMs > 0) {
            timer = setTimeout(() => {
                finishOnce(() => {
                    try { map.delete(id); } catch (e) {}
                    safeUpdatePowerBlocker();
                    try { killChildProcess(child); } catch (e) {}
                    try { onError && onError(new Error(`Process timeout after ${timeoutMs}ms`), { timedOut: true }); } catch (e) {}
                });
            }, timeoutMs);
            try { timer.unref && timer.unref(); } catch (e) {}
        }

        if (typeof onStdout === 'function' && child.stdout) {
            child.stdout.on('data', onStdout);
        }
        if (typeof onStderr === 'function' && child.stderr) {
            child.stderr.on('data', onStderr);
        }

        child.once('close', (code, signal) => {
            finishOnce(() => {
                if (timer) clearTimeout(timer);
                try { map.delete(id); } catch (e) {}
                safeUpdatePowerBlocker();
                try { onExit && onExit(code, signal); } catch (e) {}
            });
        });

        child.once('error', (err) => {
            finishOnce(() => {
                if (timer) clearTimeout(timer);
                try { map.delete(id); } catch (e) {}
                safeUpdatePowerBlocker();
                try { onError && onError(err, { timedOut: false }); } catch (e) {}
            });
        });

        return {
            stop: () => {
                finishOnce(() => {
                    if (timer) clearTimeout(timer);
                    killChildProcess(child);
                    try { map.delete(id); } catch (e) {}
                    safeUpdatePowerBlocker();
                });
            }
        };
    }

    function spawnCapture(bin, args, {
        env,
        cwd,
        encoding = 'utf8',
        timeoutMs,
        stdin
    } = {}) {
        return new Promise((resolve) => {
            const id = `proc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const child = spawn(bin, args, {
                env: env || process.env,
                cwd: cwd || undefined,
                windowsHide: true
            });

            if (stdin !== undefined && stdin !== null) {
                try {
                    if (child.stdin) {
                        child.stdin.write(stdin);
                        child.stdin.end();
                    }
                } catch (e) {
                    // Best-effort only
                }
            }

            let stdout = '';
            let stderr = '';
            const decode = (data) => {
                try {
                    if (Buffer.isBuffer(data)) return data.toString(encoding);
                    return String(data ?? '');
                } catch (e) {
                    try { return Buffer.from(data).toString('utf8'); } catch (e2) { return ''; }
                }
            };

            registerManagedChild({
                map: defaultProcessMap,
                id,
                child,
                kind: 'process',
                timeoutMs,
                onStdout: (d) => { stdout += decode(d); },
                onStderr: (d) => { stderr += decode(d); },
                onExit: (code) => resolve({ code, stdout, stderr, error: null, timedOut: false }),
                onError: (err, meta) => resolve({ code: null, stdout, stderr, error: err?.message || String(err), timedOut: !!meta?.timedOut })
            });
        });
    }

    return {
        killChildProcess,
        stopTrackedProcessEntry,
        registerManagedChild,
        spawnCapture,
    };
}

module.exports = {
    createProcessManager,
};
