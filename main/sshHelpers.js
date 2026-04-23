function isHetznerStorageBoxTarget(target) {
    return typeof target === 'string' && target.includes('storagebox.de');
}

function extractRemoteUser(target) {
    if (typeof target !== 'string') return '';
    const parts = target.split('@');
    return parts.length > 1 ? parts[0] : '';
}

function resolveSshKeyInstallOptions(target, port) {
    let finalPort = port;
    let isHetzner = false;

    if (isHetznerStorageBoxTarget(target)) {
        isHetzner = true;
        if (!finalPort || finalPort === '22') {
            finalPort = '23';
        }
    }

    return {
        isHetzner,
        finalPort,
        remoteUser: extractRemoteUser(target),
    };
}

/**
 * Normalize an SSH key string for writing to disk:
 * - Convert Windows (CRLF) and old-Mac (CR) line endings to Unix (LF)
 * - Ensure the content ends with exactly one newline (required by OpenSSH / libcrypto)
 */
function normalizeSshKey(key) {
    const s = String(key).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    return s.endsWith('\n') ? s : s + '\n';
}

module.exports = {
    isHetznerStorageBoxTarget,
    extractRemoteUser,
    resolveSshKeyInstallOptions,
    normalizeSshKey,
};
