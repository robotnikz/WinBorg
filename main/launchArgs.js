function getArgValue(argv, flag) {
    const list = Array.isArray(argv) ? argv : [];

    for (let index = 0; index < list.length; index += 1) {
        const value = list[index];
        if (typeof value !== 'string') continue;

        if (value === flag) {
            const nextValue = list[index + 1];
            return typeof nextValue === 'string' && nextValue.trim() ? nextValue.trim() : null;
        }

        if (value.startsWith(`${flag}=`)) {
            const inlineValue = value.slice(flag.length + 1).trim();
            return inlineValue || null;
        }
    }

    return null;
}

function getScheduledJobIdFromArgv(argv) {
    return getArgValue(argv, '--run-scheduled-job');
}

module.exports = {
    getArgValue,
    getScheduledJobIdFromArgv,
};