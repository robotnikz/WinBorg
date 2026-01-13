function pad2(n) {
    return String(n).padStart(2, '0');
}

function getTimeString(now) {
    const currentHour = pad2(now.getHours());
    const currentMinute = pad2(now.getMinutes());
    return `${currentHour}:${currentMinute}`;
}

function getDayKey(now) {
    return now.toISOString().slice(0, 10);
}

function getTriggerKey(now, scheduleType) {
    return `${getDayKey(now)}|${getTimeString(now)}|${scheduleType}`;
}

function shouldTriggerScheduledJob(job, now, lastKey) {
    if (!job || !job.scheduleEnabled) return { shouldTrigger: false, triggerKey: null };

    const timeString = getTimeString(now);
    const currentMinute = pad2(now.getMinutes());
    const triggerKey = getTriggerKey(now, job.scheduleType);

    if (job.scheduleType === 'daily' && job.scheduleTime === timeString) {
        return { shouldTrigger: lastKey !== triggerKey, triggerKey };
    }

    if (job.scheduleType === 'hourly' && currentMinute === '00') {
        return { shouldTrigger: lastKey !== triggerKey, triggerKey };
    }

    return { shouldTrigger: false, triggerKey };
}

function tryStartJob(jobId, runningSet) {
    if (!runningSet || !jobId) return false;
    if (runningSet.has(jobId)) return false;
    runningSet.add(jobId);
    return true;
}

function finishJob(jobId, runningSet) {
    try {
        if (runningSet && jobId) runningSet.delete(jobId);
    } catch (e) {
        // best-effort
    }
}

module.exports = {
    getTimeString,
    getDayKey,
    getTriggerKey,
    shouldTriggerScheduledJob,
    tryStartJob,
    finishJob,
};
