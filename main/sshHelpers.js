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

module.exports = {
    isHetznerStorageBoxTarget,
    extractRemoteUser,
    resolveSshKeyInstallOptions,
};
