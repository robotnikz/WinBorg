const fs = require('fs');
const path = require('path');

function safeReadJsonWithBackupSync(filePath, fallbackValue) {
    const backupPath = `${filePath}.bak`;
    const tryRead = (p) => {
        if (!fs.existsSync(p)) return { ok: false, value: null, reason: 'missing' };
        try {
            const raw = fs.readFileSync(p, 'utf8');
            if (!raw || !raw.trim()) return { ok: false, value: null, reason: 'empty' };
            return { ok: true, value: JSON.parse(raw) };
        } catch (e) {
            return { ok: false, value: null, reason: e };
        }
    };

    const primary = tryRead(filePath);
    if (primary.ok) return primary.value;

    const backup = tryRead(backupPath);
    if (backup.ok) {
        try {
            if (fs.existsSync(filePath)) {
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const corruptPath = `${filePath}.corrupt-${stamp}`;
                fs.renameSync(filePath, corruptPath);
            }
        } catch (e) {
            // Best-effort only
        }
        return backup.value;
    }

    return fallbackValue;
}

function atomicWriteFileSync(filePath, content, { encoding = 'utf8', makeBackup = true } = {}) {
    const dir = path.dirname(filePath);
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        // If we can't create the directory, let the write below throw.
    }

    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

    // Backup existing file first (best-effort)
    if (makeBackup && fs.existsSync(filePath)) {
        try {
            fs.copyFileSync(filePath, `${filePath}.bak`);
        } catch (e) {
            // Best-effort only
        }
    }

    fs.writeFileSync(tmpPath, content, encoding);

    // Best-effort flush to disk
    try {
        const fd = fs.openSync(tmpPath, 'r+');
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } catch (e) {
        // Best-effort only
    }

    // Replace target (Windows rename() doesn't overwrite reliably)
    try {
        fs.renameSync(tmpPath, filePath);
        return;
    } catch (e) {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            fs.renameSync(tmpPath, filePath);
            return;
        } catch (e2) {
            try {
                fs.copyFileSync(tmpPath, filePath);
            } finally {
                try { fs.unlinkSync(tmpPath); } catch (e3) {}
            }
        }
    }
}

module.exports = {
    safeReadJsonWithBackupSync,
    atomicWriteFileSync,
};
