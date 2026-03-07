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

function parseTimeToMinutes(value) {
    if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
}

function isWithinActiveScheduleWindow(now, settings) {
    if (!settings || settings.scheduleEnabled !== true) return true;

    const startMinutes = parseTimeToMinutes(settings.scheduleStart);
    const endMinutes = parseTimeToMinutes(settings.scheduleEnd);
    if (startMinutes === null || endMinutes === null) return true;
    if (startMinutes === endMinutes) return true;

    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getScheduledSlotTime(job, now) {
    if (!job || !job.scheduleEnabled) return null;

    if (job.scheduleType === 'daily') {
        const scheduleMinutes = parseTimeToMinutes(job.scheduleTime);
        if (scheduleMinutes === null) return null;

        const slot = new Date(now);
        slot.setHours(Math.floor(scheduleMinutes / 60), scheduleMinutes % 60, 0, 0);
        return slot <= now ? slot : null;
    }

    if (job.scheduleType === 'hourly') {
        const slot = new Date(now);
        slot.setMinutes(0, 0, 0);
        return slot;
    }

    return null;
}

function parseLastRunAt(lastRunAt) {
    if (!lastRunAt || lastRunAt === 'Never') return null;
    const parsed = new Date(lastRunAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldTriggerScheduledJob(job, now, lastKey, options = {}) {
    if (!job || !job.scheduleEnabled) return { shouldTrigger: false, triggerKey: null };
    if (!isWithinActiveScheduleWindow(now, options.scheduleWindow)) {
        return { shouldTrigger: false, triggerKey: null };
    }

    const scheduledSlot = getScheduledSlotTime(job, now);
    if (!scheduledSlot) {
        return { shouldTrigger: false, triggerKey: null };
    }

    const triggerKey = getTriggerKey(scheduledSlot, job.scheduleType);
    if (lastKey === triggerKey) {
        return { shouldTrigger: false, triggerKey };
    }

    const exactMatch = getTimeString(now) === getTimeString(scheduledSlot);
    if (exactMatch) {
        return { shouldTrigger: true, triggerKey, mode: 'scheduled' };
    }

    if (options.allowCatchUp === false) {
        return { shouldTrigger: false, triggerKey };
    }

    const lastRunAt = parseLastRunAt(options.lastRunAt);
    if (lastRunAt && lastRunAt >= scheduledSlot) {
        return { shouldTrigger: false, triggerKey };
    }

    return { shouldTrigger: true, triggerKey, mode: 'catch-up' };
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
    isWithinActiveScheduleWindow,
    getScheduledSlotTime,
    shouldTriggerScheduledJob,
    tryStartJob,
    finishJob,
};
